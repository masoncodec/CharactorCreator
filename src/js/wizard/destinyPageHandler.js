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

    // A single RuleEngine for all components created by this handler
    this.ruleEngine = new RuleEngine(this.stateManager);
    
    // To keep track of the dynamic components we create
    this.activeItemSelectors = [];

    this._boundDestinyOptionClickHandler = this._handleDestinyOptionClick.bind(this);

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
    this._renderDestinyOptions(); // Render the top-level destiny choices
    this._restoreState(); // Restore the selected destiny, which in turn renders its item groups

    this.informerUpdater.update('destiny');
    this.pageNavigator.updateNav();
  }

  /**
   * Attaches the primary event listener for destiny selection.
   * @private
   */
  _attachEventListeners() {
    // Using event delegation on the container for destiny options
    const destinyOptionsContainer = this.selectorPanel.querySelector('#destiny-options-container');
    if (destinyOptionsContainer) {
        destinyOptionsContainer.removeEventListener('click', this._boundDestinyOptionClickHandler);
        destinyOptionsContainer.addEventListener('click', this._boundDestinyOptionClickHandler);
    }
  }

  /**
   * Handles the click on a top-level destiny option.
   * @param {Event} e - The click event.
   * @private
   */
  _handleDestinyOptionClick(e) {
    const destinyOptionDiv = e.target.closest('.destiny-option');
    if (!destinyOptionDiv) return;

    const selectedDestinyId = destinyOptionDiv.dataset.destinyId;
    const currentDestiny = this.stateManager.get('destiny');

    if (currentDestiny === selectedDestinyId) {
        console.log(`DestinyPageHandler: Re-selected same destiny: ${selectedDestinyId}. No state change.`);
        return;
    }
    
    // Update visual selection
    this.selectorPanel.querySelectorAll('.destiny-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    destinyOptionDiv.classList.add('selected');

    // Set new destiny and clear out any old selections sourced from a previous destiny
    this.stateManager.setState('destiny', selectedDestinyId);
    
    // The state change from setState will trigger our components to re-render.
    // We just need to ensure the container for the choice groups is rendered.
    this._renderAbilityGroupsSection();
  }

  /**
   * Restores the selected destiny and triggers the rendering of its sub-components.
   * @private
   */
  _restoreState() {
    const currentDestinyId = this.stateManager.get('destiny');
    if (currentDestinyId) {
      const destinyOptionDiv = this.selectorPanel.querySelector(`.destiny-option[data-destiny-id="${currentDestinyId}"]`);
      if (destinyOptionDiv) {
        destinyOptionDiv.classList.add('selected');
        // If a destiny is already selected, render its associated item groups
        this._renderAbilityGroupsSection();
      }
    }
  }

  /**
   * Renders the main destiny options based on the selected module.
   * @private
   */
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

  /**
   * Renders the sections for abilities, flaws, etc., by creating ItemSelectorComponents.
   * @private
   */
  _renderAbilityGroupsSection() {
    this._cleanupItemSelectors(); // Clean up any existing components first

    const scrollArea = this.selectorPanel.querySelector('.destiny-content-scroll-area');
    if (!scrollArea) {
        console.error("DestinyPageHandler Error: The '.destiny-content-scroll-area' container was not found in destiny-selector.html. Cannot render choice groups.");
        return;
    }

    let abilitiesSectionContainer = scrollArea.querySelector('.abilities-section');
    if (!abilitiesSectionContainer) {
        console.log("DestinyPageHandler: '.abilities-section' not found, creating it now.");
        abilitiesSectionContainer = document.createElement('div');
        abilitiesSectionContainer.className = 'abilities-section';
        scrollArea.appendChild(abilitiesSectionContainer);
    }
    
    abilitiesSectionContainer.innerHTML = ''; // Clear previous content
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
      
      // *** THIS IS THE FIX ***
      // We now inject the contextual `groupId` into each item definition
      // before passing it to the component.
      const itemsForGroup = groupDef.abilities.reduce((acc, itemId) => {
        if (allItemDefs[itemId]) {
          acc[itemId] = { ...allItemDefs[itemId], groupId: groupId };
        }
        return acc;
      }, {});
      
      // Create a new component for this group
      const selector = new ItemSelectorComponent(
        componentContainer,
        itemsForGroup,
        `destiny-${groupId}`, // A unique source for this group, e.g., 'destiny-flaws'
        this.stateManager,
        this.ruleEngine
      );

      this.activeItemSelectors.push(selector);
      selector.render();
    });
  }

  /**
   * Cleans up all active ItemSelectorComponent instances.
   * @private
   */
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
  }
}

export { DestinyPageHandler };
