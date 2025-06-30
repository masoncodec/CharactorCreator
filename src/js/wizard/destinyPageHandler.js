// destinyPageHandler.js
// REFACTORED: This module handles the 'destiny' selection page and its own logic.

import { ItemSelectorComponent } from './ItemSelectorComponent.js';
import { EquipmentSelectorComponent } from './EquipmentSelectorComponent.js'; // MODIFIED: Import added
import { RuleEngine } from './RuleEngine.js';

class DestinyPageHandler {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.selectorPanel = null;
    this.ruleEngine = new RuleEngine(this.stateManager);
    this.activeItemSelectors = [];

    this._boundDestinyOptionClickHandler = this._handleDestinyOptionClick.bind(this);
    this._boundHandleStateChange = this._handleStateChange.bind(this);
    console.log('DestinyPageHandler: Initialized (Refactored).');
  }

  setupPage(selectorPanel, informerPanel, pageNavigator, informerUpdater) {
    this.selectorPanel = selectorPanel;
    this._attachEventListeners();
    this._renderDestinyOptions();
    this._restoreState();
  }

  _attachEventListeners() {
    this.selectorPanel.querySelector('#destiny-options-container')?.addEventListener('click', this._boundDestinyOptionClickHandler);
    document.addEventListener('wizard:stateChange', this._boundHandleStateChange);
  }

  _handleStateChange(event) {
    if (event.detail.key === 'selections') {
      this.activeItemSelectors.forEach(selector => selector.render());
    }
  }
  
  _handleDestinyOptionClick(e) {
    const destinyOptionDiv = e.target.closest('.destiny-option');
    if (!destinyOptionDiv) return;

    const selectedDestinyId = destinyOptionDiv.dataset.destinyId;
    if (this.stateManager.get('destiny') === selectedDestinyId) return;
    
    this.selectorPanel.querySelectorAll('.destiny-option').forEach(opt => opt.classList.remove('selected'));
    destinyOptionDiv.classList.add('selected');
    this.stateManager.setState('destiny', selectedDestinyId);
    this._renderAbilityGroupsSection();
  }

  _restoreState() {
    const currentDestinyId = this.stateManager.get('destiny');
    if (currentDestinyId) {
      const destinyOptionDiv = this.selectorPanel.querySelector(`.destiny-option[data-destiny-id="${currentDestinyId}"]`);
      if (destinyOptionDiv) {
        destinyOptionDiv.classList.add('selected');
        this._renderAbilityGroupsSection();
      }
    }
  }

  _renderDestinyOptions() {
    const container = this.selectorPanel.querySelector('#destiny-options-container');
    if (!container) return;
    container.innerHTML = '';
    const moduleData = this.stateManager.getModule(this.stateManager.get('module'));
    if (!moduleData || !moduleData.destinies) {
      container.innerHTML = '<p>Please select a Module first to see available Destinies.</p>';
      return;
    }
    moduleData.destinies.forEach(destinyId => {
      const destiny = this.stateManager.getDestiny(destinyId);
      if (destiny) {
        container.innerHTML += `<div class="destiny-option" data-destiny-id="${destinyId}"><span class="destiny-name">${destiny.displayName}</span></div>`;
      }
    });
  }

  _renderAbilityGroupsSection() {
    this._cleanupItemSelectors(); 
    const scrollArea = this.selectorPanel.querySelector('.destiny-content-scroll-area');
    if (!scrollArea) return;
    let abilitiesSectionContainer = scrollArea.querySelector('.abilities-section');
    if (!abilitiesSectionContainer) {
        abilitiesSectionContainer = document.createElement('div');
        abilitiesSectionContainer.className = 'abilities-section';
        scrollArea.appendChild(abilitiesSectionContainer);
    }
    abilitiesSectionContainer.innerHTML = ''; 
    const destinyId = this.stateManager.get('destiny');
    if (!destinyId) return;
    const destiny = this.stateManager.getDestiny(destinyId);
    if (!destiny.choiceGroups) return;
    
    const destinyContext = {
      sourcePrefix: 'destiny',
      getDefinition: () => this.stateManager.getDestiny(this.stateManager.get('destiny'))
    };

    const allItemDefs = this.stateManager.getItemData();

    Object.entries(destiny.choiceGroups).forEach(([groupId, groupDef]) => {
      // Validate the group definition
      if (!groupDef.type) {
        console.error(`Destiny choice group '${groupId}' is missing the required 'type' property. Skipping.`);
        return; // Use return instead of continue in forEach
      }
      if (!Array.isArray(groupDef.items)) {
        console.error(`Destiny choice group '${groupId}' is missing a valid 'items' array. Skipping.`);
        return;
      }

      const groupContainer = document.createElement('div');
      groupContainer.className = 'ability-group-container';
      const maxChoicesText = groupDef.maxChoices === 1 ? 'Choose 1' : `Choose up to ${groupDef.maxChoices}`;
      groupContainer.innerHTML = `<h5 class="group-header">${groupDef.name} (${maxChoicesText})</h5>`;
      
      const componentContainer = document.createElement('div');
      componentContainer.className = 'abilities-grid-container';
      groupContainer.appendChild(componentContainer);
      abilitiesSectionContainer.appendChild(groupContainer);
      
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
        'destiny',
        this.stateManager, 
        this.ruleEngine,
        destinyContext
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

    if (!currentState.destiny) {
      return '<p>Select your destiny</p>';
    }

    const destiny = this.stateManager.getDestiny(currentState.destiny);
    const destinySelections = currentState.selections.filter(sel => sel.source === 'destiny');
    
    const renderItems = (itemType, title) => {
        const items = destinySelections.filter(sel => allItemDefs[sel.id]?.itemType === itemType);
        if (items.length === 0) return '';
        return `<h4>${title}</h4>` + items.map(sel => {
            const itemDef = allItemDefs[sel.id];
            return `<div class="selected-item-display-card"><h5>${itemDef.name}</h5><p>${itemDef.description}</p></div>`;
        }).join('');
    };

    return `
      <h3>${destiny.displayName}</h3>
      <p>${destiny.description}</p>
      <div class="stats"><strong>Health:</strong> ${destiny.health.title} (${destiny.health.value})</div>
      <div class="selected-items-summary">
        ${renderItems('flaw', 'Chosen Flaws')}
        ${renderItems('perk', 'Chosen Perks')}
        ${renderItems('ability', 'Chosen Abilities')}
        ${renderItems('equipment', 'Chosen Equipment')}
        ${renderItems('loot', 'Chosen Loot')}
      </div>`;
  }

  isComplete(currentState) {
    if (!currentState.destiny) return false;
    const destinyDef = this.stateManager.getDestiny(currentState.destiny);
    if (!destinyDef || !destinyDef.choiceGroups) return true; 

    const allItemDefs = this.stateManager.getItemData();
    return Object.entries(destinyDef.choiceGroups).every(([groupId, groupDef]) => {
      // Add guard clauses to prevent errors on incomplete definitions
      if (!groupDef.type || !Array.isArray(groupDef.items)) return true; // Skip validation for invalid groups

      const selectionsInGroup = currentState.selections.filter(
        sel => sel.source === 'destiny' && sel.groupId === groupId
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

    if (!currentState.destiny) {
      return 'Please select a Destiny to continue.';
    }

    const destinyDef = this.stateManager.getDestiny(currentState.destiny);
    if (!destinyDef || !destinyDef.choiceGroups) return '';

    const allItemDefs = this.stateManager.getItemData();

    Object.entries(destinyDef.choiceGroups).forEach(([groupId, groupDef]) => {
      // Add guard clauses to prevent errors on incomplete definitions
      if (!groupDef.type || !Array.isArray(groupDef.items)) return;

      const selectionsInGroup = currentState.selections.filter(
        sel => sel.source === 'destiny' && sel.groupId === groupId
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

    return 'Please ensure all choices for your Destiny are complete.';
  }

  cleanup() {
    this.selectorPanel.querySelector('#destiny-options-container')?.removeEventListener('click', this._boundDestinyOptionClickHandler);
    document.removeEventListener('wizard:stateChange', this._boundHandleStateChange);
    this._cleanupItemSelectors();
  }
}

export { DestinyPageHandler };