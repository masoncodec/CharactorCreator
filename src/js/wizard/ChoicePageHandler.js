// js/wizard/ChoicePageHandler.js
// This is a generic base class for wizard pages that involve selecting a primary option
// (like Destiny, Purpose, or Nurture) and then making sub-choices from defined groups.

import { ItemSelectorComponent } from './ItemSelectorComponent.js';
import { EquipmentSelectorComponent } from './EquipmentSelectorComponent.js';
import { RuleEngine } from './RuleEngine.js';

class ChoicePageHandler {
  /**
   * @param {WizardStateManager} stateManager The central state manager.
   * @param {object} config Configuration object for the specific page handler.
   * @param {string} config.stateKey The key in the wizard state to manage (e.g., 'destiny').
   * @param {string} config.pageName The display name of the page (e.g., 'Destiny').
   * @param {string} config.optionsContainerId The DOM ID for the container of the primary options.
   * @param {string} config.optionClassName The CSS class for a single primary option.
   * @param {string} config.dataAttribute The data attribute used to store the option's ID.
   * @param {string} config.contentScrollAreaClass The CSS class for the scrollable content area.
   * @param {string} config.getDataMethodName The method name on the stateManager to get a specific definition (e.g., 'getDestiny').
   * @param {string} config.getOptionsKey The key in the module definition that lists the available options (e.g., 'destinies').
   */
  constructor(stateManager, config) {
    this.stateManager = stateManager;
    this.config = config;
    
    this.selectorPanel = null;
    this.ruleEngine = new RuleEngine(this.stateManager);
    this.activeItemSelectors = [];

    this._boundOptionClickHandler = this._handleOptionClick.bind(this);
    this._boundHandleStateChange = this._handleStateChange.bind(this);

    console.log(`${this.config.pageName}PageHandler: Initialized using ChoicePageHandler base.`);
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
    // Re-render item selectors if any selection changes
    if (event.detail.key === 'selections') {
      this.activeItemSelectors.forEach(selector => selector.render());
    }
  }

  _handleOptionClick(e) {
    const optionDiv = e.target.closest(this.config.optionClassName);
    if (!optionDiv) return;

    const selectedId = optionDiv.getAttribute(this.config.dataAttribute);
    if (this.stateManager.get(this.config.stateKey) === selectedId) return;

    this.selectorPanel.querySelectorAll(this.config.optionClassName).forEach(opt => opt.classList.remove('selected'));
    optionDiv.classList.add('selected');
    
    this.stateManager.setState(this.config.stateKey, selectedId);
    this._renderChoiceGroupsSection();
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

    if (!options || options.length === 0) {
      container.innerHTML = `<p>No ${this.config.pageName}s available for this module.</p>`;
      return;
    }

    options.forEach(optionId => {
      const optionDef = this.stateManager[this.config.getDataMethodName](optionId);
      if (optionDef) {
        container.innerHTML += `<div class="${this.config.optionClassName.substring(1)}" ${this.config.dataAttribute}="${optionId}"><span class="${this.config.stateKey}-name">${optionDef.displayName}</span></div>`;
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
    if (!mainDefinition || !mainDefinition.choiceGroups) return;

    const pageContext = {
      sourcePrefix: this.config.stateKey,
      getDefinition: () => this.stateManager[this.config.getDataMethodName](this.stateManager.get(this.config.stateKey))
    };

    const allItemDefs = this.stateManager.getItemData();

    Object.entries(mainDefinition.choiceGroups).forEach(([groupId, groupDef]) => {
      if (!groupDef.type) {
        console.error(`${this.config.pageName} choice group '${groupId}' is missing the required 'type' property. Skipping.`);
        return;
      }
      if (!Array.isArray(groupDef.items)) {
        console.error(`${this.config.pageName} choice group '${groupId}' is missing a valid 'items' array. Skipping.`);
        return;
      }

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
        componentContainer,
        itemsForGroup,
        this.config.stateKey,
        this.stateManager,
        this.ruleEngine,
        pageContext
      );

      this.activeItemSelectors.push(selector);
      selector.render();
    });
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

    const renderItems = (itemType, title) => {
      const items = selections.filter(sel => allItemDefs[sel.id]?.itemType === itemType);
      if (items.length === 0) return '';
      return `<h4>${title}</h4>` + items.map(sel => {
        const itemDef = allItemDefs[sel.id];
        return `<div class="selected-item-display-card"><h5>${itemDef.name}</h5><p>${itemDef.description}</p></div>`;
      }).join('');
    };

    let content = `<h3>${mainDefinition.displayName}</h3><p>${mainDefinition.description}</p>`;
    
    // This part can be extended by child classes
    content += this._getAdditionalInformerContent(mainDefinition);

    content += `
      <div class="selected-items-summary">
        ${renderItems('flaw', 'Chosen Flaws')}
        ${renderItems('perk', 'Chosen Perks')}
        ${renderItems('ability', 'Chosen Abilities')}
        ${renderItems('equipment', 'Chosen Equipment')}
        ${renderItems('loot', 'Chosen Loot')}
      </div>`;
      
    return content;
  }

  // Hook for child classes to add unique content to the informer panel.
  _getAdditionalInformerContent(mainDefinition) {
    return '';
  }

  isComplete(currentState) {
    const currentId = currentState[this.config.stateKey];
    if (!currentId) return false;

    const mainDefinition = this.stateManager[this.config.getDataMethodName](currentId);
    if (!mainDefinition || !mainDefinition.choiceGroups) return true;

    const allItemDefs = this.stateManager.getItemData();
    return Object.entries(mainDefinition.choiceGroups).every(([groupId, groupDef]) => {
      if (!groupDef.type || !Array.isArray(groupDef.items)) return true;

      const selectionsInGroup = currentState.selections.filter(
        sel => sel.source === this.config.stateKey && sel.groupId === groupId
      );

      if (selectionsInGroup.length !== groupDef.maxChoices) return false;

      return selectionsInGroup.every(sel => {
        const itemDef = allItemDefs[sel.id];
        if (itemDef?.options && itemDef.maxChoices) {
          return sel.selections.length === itemDef.maxChoices;
        }
        return true;
      });
    });
  }

  getCompletionError() {
    const currentState = this.stateManager.getState();
    const errors = [];
    const currentId = currentState[this.config.stateKey];

    if (!currentId) {
      return `Please select a ${this.config.pageName} to continue.`;
    }

    const mainDefinition = this.stateManager[this.config.getDataMethodName](currentId);
    if (!mainDefinition || !mainDefinition.choiceGroups) return '';

    const allItemDefs = this.stateManager.getItemData();

    Object.entries(mainDefinition.choiceGroups).forEach(([groupId, groupDef]) => {
      if (!groupDef.type || !Array.isArray(groupDef.items)) return;

      const selectionsInGroup = currentState.selections.filter(
        sel => sel.source === this.config.stateKey && sel.groupId === groupId
      );
      
      const needed = groupDef.maxChoices;
      const chosen = selectionsInGroup.length;

      if (chosen < needed) {
        const remaining = needed - chosen;
        const itemLabel = remaining === 1 ? 'item' : 'items';
        errors.push(`From "${groupDef.name}", you must choose ${remaining} more ${itemLabel}.`);
      }

      selectionsInGroup.forEach(sel => {
        const itemDef = allItemDefs[sel.id];
        if (itemDef?.options && itemDef.maxChoices) {
          if (sel.selections.length < itemDef.maxChoices) {
            errors.push(`The item "${itemDef.name}" requires a selection. Please make a choice.`);
          }
        }
      });
    });

    if (errors.length > 0) {
      return errors.join('\n');
    }

    return `Please ensure all choices for your ${this.config.pageName} are complete.`;
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
