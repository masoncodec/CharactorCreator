// js/wizard/ChoicePageHandler.js
// This is a generic base class for wizard pages that involve selecting a primary option
// (like Destiny, Purpose, or Nurture) and then making sub-choices from defined groups.
// UPDATED: Validation logic now correctly handles level-up mode.

import { ItemSelectorComponent } from './ItemSelectorComponent.js';
import { EquipmentSelectorComponent } from './EquipmentSelectorComponent.js';
import { RuleEngine } from './RuleEngine.js';

class ChoicePageHandler {
  constructor(stateManager, config) {
    this.stateManager = stateManager;
    this.config = config;
    this.selectorPanel = null;
    this.ruleEngine = new RuleEngine(this.stateManager);
    this.activeItemSelectors = [];
    this._boundOptionClickHandler = this._handleOptionClick.bind(this);
    this._boundHandleStateChange = this._handleStateChange.bind(this);
  }

  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;
    this._attachEventListeners();
    this._renderOptions();
    this._restoreState();
  }

  _attachEventListeners() {
    this.selectorPanel.querySelector(this.config.optionsContainerId)?.addEventListener('click', this._boundOptionClickHandler);
    document.addEventListener('wizard:stateChange', this._boundHandleStateChange);
  }

  _handleStateChange(event) {
    if (event.detail.key === 'selections' || event.detail.key === 'creationLevel') {
      this._renderChoiceGroupsSection();
      if(event.detail.key === 'creationLevel'){
          document.dispatchEvent(new CustomEvent('wizard:informerUpdate'));
      }
    }
  }
  
  _handleOptionClick(e) {
    if (this.stateManager.get('isLevelUpMode')) {
        return;
    }
    const optionDiv = e.target.closest(this.config.optionClassName);
    if (!optionDiv) return;
    const selectedId = optionDiv.getAttribute(this.config.dataAttribute);
    if (this.stateManager.get(this.config.stateKey) === selectedId) return;
    this.selectorPanel.querySelectorAll(this.config.optionClassName).forEach(opt => opt.classList.remove('selected'));
    optionDiv.classList.add('selected');
    this.stateManager.setState(this.config.stateKey, selectedId);
    this._autoSelectChoiceGroups(selectedId);
    this._renderChoiceGroupsSection();
    document.dispatchEvent(new CustomEvent('wizard:stateChange', { detail: { key: this.config.stateKey }}));
    document.dispatchEvent(new CustomEvent('wizard:informerUpdate'));
  }

  _autoSelectChoiceGroups(selectedId) {
    const mainDefinition = this.stateManager[this.config.getDataMethodName](selectedId);
    if (!mainDefinition || !Array.isArray(mainDefinition.levels)) return;
    const allItemDefs = this.stateManager.getItemData();
    const creationLevel = this.stateManager.get('creationLevel');
    for (const levelData of mainDefinition.levels) {
        if (levelData.level > creationLevel) continue;
        if (!levelData.choiceGroups) continue;
        Object.entries(levelData.choiceGroups).forEach(([groupId, groupDef]) => {
            if (groupDef.items && groupDef.items.length === groupDef.maxChoices) {
                groupDef.items.forEach(itemId => {
                    const itemDef = allItemDefs[itemId];
                    if (itemDef && !this.stateManager.itemManager.isItemSelected(itemId)) {
                        const payload = groupDef.type === 'inventory' ? { quantity: 1 } : {};
                        this.stateManager.itemManager.selectItem(itemDef, this.config.stateKey, groupId, payload);
                    }
                });
            }
        });
    }
  }

  _restoreState() {
    const currentId = this.stateManager.get(this.config.stateKey);
    if (currentId) {
      const optionDiv = this.selectorPanel.querySelector(`${this.config.optionClassName}[${this.config.dataAttribute}="${currentId}"]`);
      if (optionDiv) {
        optionDiv.classList.add('selected');
        this._renderChoiceGroupsSection();
      }
    }
  }

  _renderOptions() {
    const container = this.selectorPanel.querySelector(this.config.optionsContainerId);
    if (!container) return;
    container.innerHTML = '';
    const moduleData = this.stateManager.getModule(this.stateManager.get('module'));
    const options = moduleData ? moduleData[this.config.getOptionsKey] : [];
    const isLevelUpMode = this.stateManager.get('isLevelUpMode');
    if (!options || options.length === 0) {
      container.innerHTML = `<p>No ${this.config.pageName}s available for this module.</p>`;
      return;
    }
    options.forEach(optionId => {
      const optionDef = this.stateManager[this.config.getDataMethodName](optionId);
      if (optionDef) {
        const disabledClass = isLevelUpMode ? 'disabled' : '';
        container.innerHTML += `<div class="${this.config.optionClassName.substring(1)} ${disabledClass}" ${this.config.dataAttribute}="${optionId}"><span class="${this.config.stateKey}-name">${optionDef.displayName}</span></div>`;
      }
    });
  }

  _renderChoiceGroupsSection() {
    this._cleanupItemSelectors();
    const scrollArea = this.selectorPanel.querySelector(this.config.contentScrollAreaClass);
    if (!scrollArea) return;
    let choiceGroupsContainer = scrollArea.querySelector('.choice-groups-section');
    if (!choiceGroupsContainer) {
        choiceGroupsContainer = document.createElement('div');
        choiceGroupsContainer.className = 'choice-groups-section';
        scrollArea.appendChild(choiceGroupsContainer);
    }
    choiceGroupsContainer.innerHTML = '';
    const currentId = this.stateManager.get(this.config.stateKey);
    if (!currentId) return;
    const mainDefinition = this.stateManager[this.config.getDataMethodName](currentId);
    if (!mainDefinition || !Array.isArray(mainDefinition.levels)) return;
    const isLevelUpMode = this.stateManager.get('isLevelUpMode');
    const originalLevel = this.stateManager.get('originalLevel');
    const targetLevel = this.stateManager.get('creationLevel');
    const allItemDefs = this.stateManager.getItemData();
    const pageContext = {
      sourcePrefix: this.config.stateKey,
      getDefinition: () => this.stateManager[this.config.getDataMethodName](this.stateManager.get(this.config.stateKey))
    };
    for (const levelData of mainDefinition.levels) {
        if (levelData.level > targetLevel) continue;
        if (!levelData.choiceGroups) continue;
        const isLocked = isLevelUpMode && levelData.level <= originalLevel;
        const headerText = isLocked 
            ? `Level ${levelData.level} Choices (Locked)`
            : `Level ${levelData.level} Choices`;
        const levelHeader = document.createElement('h4');
        levelHeader.className = 'level-group-header';
        if(isLocked) levelHeader.classList.add('locked-header');
        levelHeader.textContent = headerText;
        choiceGroupsContainer.appendChild(levelHeader);
        Object.entries(levelData.choiceGroups).forEach(([groupId, groupDef]) => {
            const groupContainer = document.createElement('div');
            groupContainer.className = 'ability-group-container';
            const maxChoicesText = groupDef.maxChoices === 1 ? 'Choose 1' : `Choose up to ${groupDef.maxChoices}`;
            groupContainer.innerHTML = `<h5 class="group-header">${groupDef.name} (${maxChoicesText})</h5>`;
            const componentContainer = document.createElement('div');
            componentContainer.className = 'abilities-grid-container';
            groupContainer.appendChild(componentContainer);
            choiceGroupsContainer.appendChild(groupContainer);
            const itemsForGroup = groupDef.items.reduce((acc, itemId) => {
                if (allItemDefs[itemId]) {
                    acc[itemId] = { ...allItemDefs[itemId], groupId: groupId };
                }
                return acc;
            }, {});
            const SelectorComponent = groupDef.type === 'inventory' ? EquipmentSelectorComponent : ItemSelectorComponent;
            const selector = new SelectorComponent(
                componentContainer, itemsForGroup, this.config.stateKey,
                this.stateManager, this.ruleEngine, pageContext, isLocked
            );
            this.activeItemSelectors.push(selector);
            selector.render();
        });
    }
  }

  getInformerContent() {
    const currentState = this.stateManager.getState();
    const currentId = currentState[this.config.stateKey];
    if (!currentId) {
      return `<p>Select your ${this.config.stateKey}</p>`;
    }
    const mainDefinition = this.stateManager[this.config.getDataMethodName](currentId);
    const selections = currentState.selections.filter(sel => sel.source === this.config.stateKey);
    const allItemDefs = this.stateManager.getItemData();
    const healthContent = '';
    const renderItems = (itemType, title) => {
        const items = selections.filter(s => allItemDefs[s.id]?.itemType === itemType);
        if (items.length === 0) return '';
        let listItems = items.map(item => `<li>${allItemDefs[item.id].name}</li>`).join('');
        return `<h4>${title}</h4><ul>${listItems}</ul>`;
    };
    let content = `<h3>${mainDefinition.displayName}</h3><p>${mainDefinition.description}</p>${healthContent}`;
    content += this._getAdditionalInformerContent(mainDefinition);
    content += renderItems('ability', 'Abilities');
    content += renderItems('perk', 'Perks');
    content += renderItems('flaw', 'Flaws');
    content += renderItems('community', 'Communities');
    content += renderItems('relationship', 'Relationships');
    return content;
  }

  _getAdditionalInformerContent(mainDefinition) {
    return '';
  }
  
  /**
   * --- REPLACED: Now only validates new levels when in level-up mode. ---
   */
  isComplete(currentState) {
    const currentId = currentState[this.config.stateKey];
    if (!currentId) return false;

    const mainDefinition = this.stateManager[this.config.getDataMethodName](currentId);
    if (!mainDefinition || !Array.isArray(mainDefinition.levels)) return true;

    const targetLevel = currentState.creationLevel;
    const isLevelUpMode = currentState.isLevelUpMode;
    const originalLevel = currentState.originalLevel;
    const allItemDefs = this.stateManager.getItemData();

    for (const levelData of mainDefinition.levels) {
        if (levelData.level > targetLevel) continue;

        // In level-up mode, we only validate levels GREATER than the character's original level.
        if (isLevelUpMode && levelData.level <= originalLevel) {
            continue;
        }

        if (!levelData.choiceGroups) continue;

        for (const [groupId, groupDef] of Object.entries(levelData.choiceGroups)) {
            const selectionsInGroup = currentState.selections.filter(
                sel => sel.source === this.config.stateKey && sel.groupId === groupId
            );
            if (selectionsInGroup.length !== groupDef.maxChoices) return false;

            const isSubChoiceComplete = selectionsInGroup.every(sel => {
                const itemDef = allItemDefs[sel.id];
                return !(itemDef?.options && itemDef.maxChoices && sel.selections.length !== itemDef.maxChoices);
            });
            if (!isSubChoiceComplete) return false;
        }
    }
    return true;
  }
  
  /**
   * --- REPLACED: Now only generates errors for new levels in level-up mode. ---
   */
  getCompletionError() {
    const currentState = this.stateManager.getState();
    const errors = [];
    const currentId = currentState[this.config.stateKey];
    if (!currentId) return `Please select a ${this.config.pageName} to continue.`;
    
    const mainDefinition = this.stateManager[this.config.getDataMethodName](currentId);
    if (!mainDefinition || !Array.isArray(mainDefinition.levels)) return '';

    const targetLevel = currentState.creationLevel;
    const isLevelUpMode = currentState.isLevelUpMode;
    const originalLevel = currentState.originalLevel;
    const allItemDefs = this.stateManager.getItemData();

    for (const levelData of mainDefinition.levels) {
        if (levelData.level > targetLevel) continue;
        
        // In level-up mode, we only validate levels GREATER than the character's original level.
        if (isLevelUpMode && levelData.level <= originalLevel) {
            continue;
        }

        if (!levelData.choiceGroups) continue;

        for (const [groupId, groupDef] of Object.entries(levelData.choiceGroups)) {
            const selectionsInGroup = currentState.selections.filter(
                sel => sel.source === this.config.stateKey && sel.groupId === groupId
            );
          
            const needed = groupDef.maxChoices;
            const chosen = selectionsInGroup.length;

            if (chosen < needed) {
                const remaining = needed - chosen;
                const itemLabel = remaining === 1 ? 'item' : 'items';
                errors.push(`From "${groupDef.name}" (Lvl ${levelData.level}), you must choose ${remaining} more ${itemLabel}.`);
            }

            selectionsInGroup.forEach(sel => {
                const itemDef = allItemDefs[sel.id];
                if (itemDef?.options && itemDef.maxChoices && sel.selections.length < itemDef.maxChoices) {
                    errors.push(`The item "${itemDef.name}" requires a selection.`);
                }
            });
        }
    }

    return errors.length > 0 ? errors.join('\n') : `Please ensure all choices for your ${this.config.pageName} are complete.`;
  }

  _cleanupItemSelectors() {
    this.activeItemSelectors.forEach(selector => selector.cleanup());
    this.activeItemSelectors = [];
  }

  cleanup() {
    const optionsContainer = this.selectorPanel.querySelector(this.config.optionsContainerId);
    if (optionsContainer) {
      optionsContainer.removeEventListener('click', this._boundOptionClickHandler);
    }
    document.removeEventListener('wizard:stateChange', this._boundHandleStateChange);
    this._cleanupItemSelectors();
  }
}

export { ChoicePageHandler };