// js/wizard/nurturePageHandler.js
// This module handles the 'nurture' selection page.

import { ItemSelectorComponent } from './ItemSelectorComponent.js';
import { EquipmentSelectorComponent } from './EquipmentSelectorComponent.js';
import { RuleEngine } from './RuleEngine.js';

class NurturePageHandler {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.selectorPanel = null;
    this.ruleEngine = new RuleEngine(this.stateManager);
    this.activeItemSelectors = [];

    this._boundNurtureOptionClickHandler = this._handleNurtureOptionClick.bind(this);
    this._boundHandleStateChange = this._handleStateChange.bind(this);
    console.log('NurturePageHandler: Initialized.');
  }

  setupPage(selectorPanel, informerPanel, pageNavigator, informerUpdater) {
    this.selectorPanel = selectorPanel;
    this._attachEventListeners();
    this._renderNurtureOptions();
    this._restoreState();
  }

  _attachEventListeners() {
    this.selectorPanel.querySelector('#nurture-options-container')?.addEventListener('click', this._boundNurtureOptionClickHandler);
    document.addEventListener('wizard:stateChange', this._boundHandleStateChange);
  }

  _handleStateChange(event) {
    if (event.detail.key === 'selections') {
      this.activeItemSelectors.forEach(selector => selector.render());
    }
  }
  
  _handleNurtureOptionClick(e) {
    const nurtureOptionDiv = e.target.closest('.nurture-option');
    if (!nurtureOptionDiv) return;

    const selectedNurtureId = nurtureOptionDiv.dataset.nurtureId;
    if (this.stateManager.get('nurture') === selectedNurtureId) return;
    
    this.selectorPanel.querySelectorAll('.nurture-option').forEach(opt => opt.classList.remove('selected'));
    nurtureOptionDiv.classList.add('selected');
    this.stateManager.setState('nurture', selectedNurtureId);
    this._renderChoiceGroupsSection();
  }

  _restoreState() {
    const currentNurtureId = this.stateManager.get('nurture');
    if (currentNurtureId) {
      const nurtureOptionDiv = this.selectorPanel.querySelector(`.nurture-option[data-nurture-id="${currentNurtureId}"]`);
      if (nurtureOptionDiv) {
        nurtureOptionDiv.classList.add('selected');
        this._renderChoiceGroupsSection();
      }
    }
  }

  _renderNurtureOptions() {
    const container = this.selectorPanel.querySelector('#nurture-options-container');
    if (!container) return;
    container.innerHTML = '';
    const moduleData = this.stateManager.getModule(this.stateManager.get('module'));
    if (!moduleData || !moduleData.nurtures) {
      container.innerHTML = '<p>No Nurtures available for this module.</p>';
      return;
    }
    moduleData.nurtures.forEach(nurtureId => {
      const nurture = this.stateManager.getNurture(nurtureId);
      if (nurture) {
        container.innerHTML += `<div class="nurture-option" data-nurture-id="${nurtureId}"><span class="nurture-name">${nurture.displayName}</span></div>`;
      }
    });
  }

  _renderChoiceGroupsSection() {
    this._cleanupItemSelectors(); 
    const scrollArea = this.selectorPanel.querySelector('.nurture-content-scroll-area');
    if (!scrollArea) return;
    let choiceGroupsContainer = scrollArea.querySelector('.choice-groups-section');
    if (!choiceGroupsContainer) {
        choiceGroupsContainer = document.createElement('div');
        choiceGroupsContainer.className = 'choice-groups-section';
        scrollArea.appendChild(choiceGroupsContainer);
    }
    choiceGroupsContainer.innerHTML = ''; 
    const nurtureId = this.stateManager.get('nurture');
    if (!nurtureId) return;
    const nurture = this.stateManager.getNurture(nurtureId);
    if (!nurture.choiceGroups) return;
    
    const nurtureContext = {
      sourcePrefix: 'nurture',
      getDefinition: () => this.stateManager.getNurture(this.stateManager.get('nurture'))
    };

    const allItemDefs = this.stateManager.getItemData();
    Object.entries(nurture.choiceGroups).forEach(([groupId, groupDef]) => {
      // Validate the group definition
      if (!groupDef.type) {
        console.error(`Nurture choice group '${groupId}' is missing the required 'type' property. Skipping.`);
        return;
      }
      if (!Array.isArray(groupDef.items)) {
        console.error(`Nurture choice group '${groupId}' is missing a valid 'items' array. Skipping.`);
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

      // Use the generic "items" property
      const itemsForGroup = groupDef.items.reduce((acc, itemId) => {
        if (allItemDefs[itemId]) {
          acc[itemId] = { ...allItemDefs[itemId], groupId: groupId };
        }
        return acc;
      }, {});
      
      // Use the group's "type" to determine the component
      const SelectorComponent = groupDef.type === 'inventory' ? EquipmentSelectorComponent : ItemSelectorComponent;

      const selector = new SelectorComponent(
        componentContainer, 
        itemsForGroup, 
        'nurture',
        this.stateManager, 
        this.ruleEngine,
        nurtureContext
      );

      this.activeItemSelectors.push(selector);
      selector.render();
    });
  }

  _cleanupItemSelectors() {
    this.activeItemSelectors.forEach(selector => selector.cleanup());
    this.activeItemSelectors = [];
  }

  getInformerContent() {
    const currentState = this.stateManager.getState();
    const allItemDefs = this.stateManager.getItemData();

    if (!currentState.nurture) {
      return '<p>Select your nurture</p>';
    }

    const nurture = this.stateManager.getNurture(currentState.nurture);
    const nurtureSelections = currentState.selections.filter(sel => sel.source === 'nurture');
    
    const renderItems = (itemType, title) => {
        const items = nurtureSelections.filter(sel => allItemDefs[sel.id]?.itemType === itemType);
        if (items.length === 0) return '';
        return `<h4>${title}</h4>` + items.map(sel => {
            const itemDef = allItemDefs[sel.id];
            return `<div class="selected-item-display-card"><h5>${itemDef.name}</h5><p>${itemDef.description}</p></div>`;
        }).join('');
    };

    return `
      <h3>${nurture.displayName}</h3>
      <p>${nurture.description}</p>
      <div class="selected-items-summary">
        ${renderItems('flaw', 'Chosen Flaws')}
        ${renderItems('perk', 'Chosen Perks')}
        ${renderItems('ability', 'Chosen Abilities')}
        ${renderItems('equipment', 'Chosen Equipment')}
        ${renderItems('loot', 'Chosen Loot')}
      </div>`;
  }

  isComplete(currentState) {
    if (!currentState.nurture) return false;
    const nurtureDef = this.stateManager.getNurture(currentState.nurture);
    if (!nurtureDef || !nurtureDef.choiceGroups) return true; 

    const allItemDefs = this.stateManager.getItemData();
    return Object.entries(nurtureDef.choiceGroups).every(([groupId, groupDef]) => {
      // Add guard clauses
      if (!groupDef.type || !Array.isArray(groupDef.items)) return true;

      const selectionsInGroup = currentState.selections.filter(
        sel => sel.source === 'nurture' && sel.groupId === groupId
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

  /**
   * MODIFIED: Generates a detailed list of all remaining choices.
   * @returns {string} A comprehensive error message.
   */
  getCompletionError() {
    const currentState = this.stateManager.getState();
    const errors = [];

    if (!currentState.nurture) {
      return 'Please select a Nurture to continue.';
    }

    const nurtureDef = this.stateManager.getNurture(currentState.nurture);
    if (!nurtureDef || !nurtureDef.choiceGroups) return '';

    const allItemDefs = this.stateManager.getItemData();

    Object.entries(nurtureDef.choiceGroups).forEach(([groupId, groupDef]) => {
      // Add guard clauses
      if (!groupDef.type || !Array.isArray(groupDef.items)) return;

      const selectionsInGroup = currentState.selections.filter(
        sel => sel.source === 'nurture' && sel.groupId === groupId
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

    return 'Please ensure all choices for your Nurture are complete.';
  }

  cleanup() {
    this.selectorPanel.querySelector('#nurture-options-container')?.removeEventListener('click', this._boundNurtureOptionClickHandler);
    document.removeEventListener('wizard:stateChange', this._boundHandleStateChange);
    this._cleanupItemSelectors();
  }
}

export { NurturePageHandler };