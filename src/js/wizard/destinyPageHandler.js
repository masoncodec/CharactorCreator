// destinyPageHandler.js
// This module handles the UI for the 'destiny' selection page.
// It manages the primary destiny choice and then delegates all sub-item
// selections to instances of the reusable ItemSelectorComponent.

import { ItemSelectorComponent } from './ItemSelectorComponent.js';
import { RuleEngine } from './RuleEngine.js';

class DestinyPageHandler {
  /**
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   * @param {InformerUpdater} informerUpdater - The instance of the InformerUpdater.
   * @param {PageNavigator} pageNavigator - The instance of the PageNavigator.
   */
  constructor(stateManager, informerUpdater, pageNavigator) {
    this.stateManager = stateManager;
    this.informerUpdater = informerUpdater;
    this.pageNavigator = pageNavigator;
    this.selectorPanel = null;
    this.ruleEngine = new RuleEngine(this.stateManager);
    this.activeItemSelectors = [];

    this._boundDestinyOptionClickHandler = this._handleDestinyOptionClick.bind(this);

    // --- FIX START ---
    // Bind the new state change handler to the class instance.
    this._boundHandleStateChange = this._handleStateChange.bind(this);
    // --- FIX END ---

    console.log('DestinyPageHandler: Initialized.');
  }

  /**
   * Sets up the destiny page by rendering options and attaching event listeners.
   * @param {HTMLElement} selectorPanel - The DOM element for the selector panel.
   */
  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;
    console.log('DestinyPageHandler.setupPage: Setting up destiny page.');

    this._attachEventListeners();
    this._renderDestinyOptions(); 
    this._restoreState(); 

    this.informerUpdater.update('destiny');
    this.pageNavigator.updateNav();
  }

  /**
   * Attaches event listeners for destiny selection and global state changes.
   * @private
   */
  _attachEventListeners() {
    const destinyOptionsContainer = this.selectorPanel.querySelector('#destiny-options-container');
    if (destinyOptionsContainer) {
        destinyOptionsContainer.removeEventListener('click', this._boundDestinyOptionClickHandler);
        destinyOptionsContainer.addEventListener('click', this._boundDestinyOptionClickHandler);
    }
    
    // --- FIX START ---
    // Add a listener for global state changes to trigger component re-renders.
    document.addEventListener('wizard:stateChange', this._boundHandleStateChange);
    // --- FIX END ---
  }

  // --- FIX START ---
  /**
   * Handles the global state change event to re-render child components.
   * This is the missing piece that keeps the UI in sync with the state.
   * @param {CustomEvent} event - The 'wizard:stateChange' event.
   */
  _handleStateChange(event) {
    // We only need to act if a selection changed.
    if (event.detail.key === 'selections') {
      console.log('DestinyPageHandler: Detected selection change, re-rendering item selectors.');
      // Tell all active ItemSelectorComponent instances to re-render themselves.
      this.activeItemSelectors.forEach(selector => selector.render());
    }
  }
  // --- FIX END ---
  
  _handleDestinyOptionClick(e) {
    const destinyOptionDiv = e.target.closest('.destiny-option');
    if (!destinyOptionDiv) return;

    const selectedDestinyId = destinyOptionDiv.dataset.destinyId;
    const currentDestiny = this.stateManager.get('destiny');

    if (currentDestiny === selectedDestinyId) {
        return;
    }
    
    this.selectorPanel.querySelectorAll('.destiny-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    destinyOptionDiv.classList.add('selected');

    // Set new destiny. This will clear old selections via the state manager's logic.
    // NOTE: This call to setState will dispatch 'wizard:stateChange', which will
    // now be caught by our new _handleStateChange method.
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
    const currentModuleId = this.stateManager.get('module');
    const moduleData = this.stateManager.getModule(currentModuleId);

    if (!moduleData || !moduleData.destinies) {
      container.innerHTML = '<p>Please select a Module first to see available Destinies.</p>';
      return;
    }

    moduleData.destinies.forEach(destinyId => {
      const destiny = this.stateManager.getDestiny(destinyId);
      if (destiny) {
        container.innerHTML += `
          <div class="destiny-option" data-destiny-id="${destinyId}">
            <span class="destiny-name">${destiny.displayName}</span>
          </div>`;
      }
    });
  }

  _renderAbilityGroupsSection() {
    this._cleanupItemSelectors(); 

    const scrollArea = this.selectorPanel.querySelector('.destiny-content-scroll-area');
    if (!scrollArea) {
        console.error("DestinyPageHandler Error: The '.destiny-content-scroll-area' container was not found.");
        return;
    }

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
    
    const allItemDefs = this.stateManager.getItemData();

    Object.entries(destiny.choiceGroups).forEach(([groupId, groupDef]) => {
      const groupContainer = document.createElement('div');
      groupContainer.className = 'ability-group-container';
      const maxChoicesText = groupDef.maxChoices === 1 ? 'Choose 1' : `Choose up to ${groupDef.maxChoices}`;
      groupContainer.innerHTML = `<h5 class="group-header">${groupDef.name} (${maxChoicesText})</h5>`;

      const componentContainer = document.createElement('div');
      componentContainer.className = 'abilities-grid-container';
      groupContainer.appendChild(componentContainer);
      abilitiesSectionContainer.appendChild(groupContainer);
      
      const itemsForGroup = groupDef.abilities.reduce((acc, itemId) => {
        if (allItemDefs[itemId]) {
          acc[itemId] = { ...allItemDefs[itemId], groupId: groupId };
        }
        return acc;
      }, {});
      
      const selector = new ItemSelectorComponent(
        componentContainer,
        itemsForGroup,
        `destiny-${groupId}`,
        this.stateManager,
        this.ruleEngine
      );

      this.activeItemSelectors.push(selector);
      selector.render();
    });
  }

  _cleanupItemSelectors() {
    this.activeItemSelectors.forEach(selector => selector.cleanup());
    this.activeItemSelectors = [];
  }

  /**
   * Cleans up all event listeners when the page is unloaded.
   */
  cleanup() {
    console.log('DestinyPageHandler.cleanup: Cleaning up destiny page resources.');
    const destinyOptionsContainer = this.selectorPanel.querySelector('#destiny-options-container');
    if (destinyOptionsContainer) {
        destinyOptionsContainer.removeEventListener('click', this._boundDestinyOptionClickHandler);
    }
    this._cleanupItemSelectors();
    
    // --- FIX START ---
    // Remove the global state change listener to prevent memory leaks.
    document.removeEventListener('wizard:stateChange', this._boundHandleStateChange);
    // --- FIX END ---
  }
}

export { DestinyPageHandler };