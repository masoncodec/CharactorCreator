// flawsAndPerksPageHandler.js
// This module handles the UI setup for the 'flaws-and-perks' selection page
// by delegating all rendering and interaction logic to the ItemSelectorComponent.
// THIS VERSION IS NOW CORRECTED to use the proper, normalized data source.

import { ItemSelectorComponent } from './ItemSelectorComponent.js';
import { RuleEngine } from './RuleEngine.js';

class FlawsAndPerksPageHandler {
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

    // Component instances will be stored here for cleanup
    this.flawSelectorComponent = null;
    this.perkSelectorComponent = null;

    // A single RuleEngine for this page to handle perk affordability
    this.ruleEngine = new RuleEngine(this.stateManager);

    console.log('FlawsAndPerksPageHandler: Initialized.');
  }

  /**
   * Sets up the flaws and perks page by creating and rendering the item selector components.
   * @param {HTMLElement} selectorPanel - The DOM element for the selector panel.
   */
  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;
    console.log('FlawsAndPerksPageHandler.setupPage: Setting up flaws and perks components.');

    // 1. Find the containers in the partial HTML
    const flawContainer = this.selectorPanel.querySelector('.flaws-grid-container');
    const perkContainer = this.selectorPanel.querySelector('.perks-grid-container');

    if (!flawContainer || !perkContainer) {
      console.error('FlawsAndPerksPageHandler: Could not find required .flaws-grid-container or .perks-grid-container in the HTML.');
      return;
    }

    // 2. Get the unified, normalized item map from the State Manager.
    const allItems = this.stateManager.getItemData();

    // --- THIS IS THE FIX ---
    // 3. Filter and REDUCE the unified map to create an OBJECT of items for this page.
    // The ItemSelectorComponent expects an object (keyed by ID), not an array.
    const allFlawData = Object.values(allItems)
      .filter(item => item.itemType === 'flaw')
      .reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {});
      
    const allPerkData = Object.values(allItems)
      .filter(item => item.itemType === 'perk')
      .reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {});


    // 4. Create new instances of our reusable ItemSelectorComponent
    this.flawSelectorComponent = new ItemSelectorComponent(
      flawContainer,
      allFlawData,
      'independent-flaw', // The unique source for this component
      this.stateManager,
      this.ruleEngine
    );

    this.perkSelectorComponent = new ItemSelectorComponent(
      perkContainer,
      allPerkData,
      'independent-perk', // The unique source for this component
      this.stateManager,
      this.ruleEngine
    );

    // 5. Render the components
    this.flawSelectorComponent.render();
    this.perkSelectorComponent.render();
  }

  /**
   * Cleans up the components to prevent memory leaks when the page is changed.
   */
  cleanup() {
    console.log('FlawsAndPerksPageHandler.cleanup: Cleaning up resources.');
    if (this.flawSelectorComponent) {
      this.flawSelectorComponent.cleanup();
    }
    if (this.perkSelectorComponent) {
      this.perkSelectorComponent.cleanup();
    }
  }
}

export { FlawsAndPerksPageHandler };
