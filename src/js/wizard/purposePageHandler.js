// js/wizard/purposePageHandler.js
// This module handles the 'purpose' selection page.

import { ItemSelectorComponent } from './ItemSelectorComponent.js';
import { EquipmentSelectorComponent } from './EquipmentSelectorComponent.js';
import { RuleEngine } from './RuleEngine.js';

class PurposePageHandler {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.selectorPanel = null;
    this.ruleEngine = new RuleEngine(this.stateManager);
    this.activeItemSelectors = [];

    this._boundPurposeOptionClickHandler = this._handlePurposeOptionClick.bind(this);
    this._boundHandleStateChange = this._handleStateChange.bind(this);
    console.log('PurposePageHandler: Initialized.');
  }

  setupPage(selectorPanel, informerPanel, pageNavigator, informerUpdater) {
    this.selectorPanel = selectorPanel;
    this._attachEventListeners();
    this._renderPurposeOptions();
    this._restoreState();
  }

  _attachEventListeners() {
    this.selectorPanel.querySelector('#purpose-options-container')?.addEventListener('click', this._boundPurposeOptionClickHandler);
    document.addEventListener('wizard:stateChange', this._boundHandleStateChange);
  }

  _handleStateChange(event) {
    if (event.detail.key === 'selections') {
      this.activeItemSelectors.forEach(selector => selector.render());
    }
  }
  
  _handlePurposeOptionClick(e) {
    const purposeOptionDiv = e.target.closest('.purpose-option');
    if (!purposeOptionDiv) return;

    const selectedPurposeId = purposeOptionDiv.dataset.purposeId;
    if (this.stateManager.get('purpose') === selectedPurposeId) return;
    
    this.selectorPanel.querySelectorAll('.purpose-option').forEach(opt => opt.classList.remove('selected'));
    purposeOptionDiv.classList.add('selected');
    this.stateManager.setState('purpose', selectedPurposeId);
    this._renderChoiceGroupsSection();
  }

  _restoreState() {
    const currentPurposeId = this.stateManager.get('purpose');
    if (currentPurposeId) {
      const purposeOptionDiv = this.selectorPanel.querySelector(`.purpose-option[data-purpose-id="${currentPurposeId}"]`);
      if (purposeOptionDiv) {
        purposeOptionDiv.classList.add('selected');
        this._renderChoiceGroupsSection();
      }
    }
  }

  _renderPurposeOptions() {
    const container = this.selectorPanel.querySelector('#purpose-options-container');
    if (!container) return;
    container.innerHTML = '';
    const moduleData = this.stateManager.getModule(this.stateManager.get('module'));
    if (!moduleData || !moduleData.purposes) {
      container.innerHTML = '<p>No Purposes available for this module.</p>';
      return;
    }
    moduleData.purposes.forEach(purposeId => {
      const purpose = this.stateManager.getPurpose(purposeId);
      if (purpose) {
        container.innerHTML += `<div class="purpose-option" data-purpose-id="${purposeId}"><span class="purpose-name">${purpose.displayName}</span></div>`;
      }
    });
  }

  _renderChoiceGroupsSection() {
    this._cleanupItemSelectors(); 
    const scrollArea = this.selectorPanel.querySelector('.purpose-content-scroll-area');
    if (!scrollArea) return;
    let choiceGroupsContainer = scrollArea.querySelector('.choice-groups-section');
    if (!choiceGroupsContainer) {
        choiceGroupsContainer = document.createElement('div');
        choiceGroupsContainer.className = 'choice-groups-section';
        scrollArea.appendChild(choiceGroupsContainer);
    }
    choiceGroupsContainer.innerHTML = ''; 
    const purposeId = this.stateManager.get('purpose');
    if (!purposeId) return;
    const purpose = this.stateManager.getPurpose(purposeId);
    if (!purpose.choiceGroups) return;
    
    const purposeContext = {
      sourcePrefix: 'purpose',
      getDefinition: () => this.stateManager.getPurpose(this.stateManager.get('purpose'))
    };

    const allItemDefs = this.stateManager.getItemData();
    Object.entries(purpose.choiceGroups).forEach(([groupId, groupDef]) => {
      // Validate the group definition
      if (!groupDef.type) {
        console.error(`Purpose choice group '${groupId}' is missing the required 'type' property. Skipping.`);
        return;
      }
      if (!Array.isArray(groupDef.items)) {
        console.error(`Purpose choice group '${groupId}' is missing a valid 'items' array. Skipping.`);
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
        'purpose',
        this.stateManager, 
        this.ruleEngine,
        purposeContext
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

    if (!currentState.purpose) {
      return '<p>Select your purpose</p>';
    }

    const purpose = this.stateManager.getPurpose(currentState.purpose);
    const purposeSelections = currentState.selections.filter(sel => sel.source === 'purpose');
    
    const renderItems = (itemType, title) => {
        const items = purposeSelections.filter(sel => allItemDefs[sel.id]?.itemType === itemType);
        if (items.length === 0) return '';
        return `<h4>${title}</h4>` + items.map(sel => {
            const itemDef = allItemDefs[sel.id];
            return `<div class="selected-item-display-card"><h5>${itemDef.name}</h5><p>${itemDef.description}</p></div>`;
        }).join('');
    };

    return `
      <h3>${purpose.displayName}</h3>
      <p>${purpose.description}</p>
      <div class="selected-items-summary">
        ${renderItems('flaw', 'Chosen Flaws')}
        ${renderItems('perk', 'Chosen Perks')}
        ${renderItems('ability', 'Chosen Abilities')}
        ${renderItems('equipment', 'Chosen Equipment')}
        ${renderItems('loot', 'Chosen Loot')}
      </div>`;
  }

  isComplete(currentState) {
    if (!currentState.purpose) return false;
    const purposeDef = this.stateManager.getPurpose(currentState.purpose);
    if (!purposeDef || !purposeDef.choiceGroups) return true; 

    const allItemDefs = this.stateManager.getItemData();
    return Object.entries(purposeDef.choiceGroups).every(([groupId, groupDef]) => {
      // MODIFICATION: Add guard clauses
      if (!groupDef.type || !Array.isArray(groupDef.items)) return true;

      const selectionsInGroup = currentState.selections.filter(
        sel => sel.source === 'purpose' && sel.groupId === groupId
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

    if (!currentState.purpose) {
      return 'Please select a Purpose to continue.';
    }

    const purposeDef = this.stateManager.getPurpose(currentState.purpose);
    if (!purposeDef || !purposeDef.choiceGroups) return '';

    const allItemDefs = this.stateManager.getItemData();

    Object.entries(purposeDef.choiceGroups).forEach(([groupId, groupDef]) => {
      // Add guard clauses
      if (!groupDef.type || !Array.isArray(groupDef.items)) return;
      
      const selectionsInGroup = currentState.selections.filter(
        sel => sel.source === 'purpose' && sel.groupId === groupId
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

    return 'Please ensure all choices for your Purpose are complete.';
  }

  cleanup() {
    this.selectorPanel.querySelector('#purpose-options-container')?.removeEventListener('click', this._boundPurposeOptionClickHandler);
    document.removeEventListener('wizard:stateChange', this._boundHandleStateChange);
    this._cleanupItemSelectors();
  }
}

export { PurposePageHandler };