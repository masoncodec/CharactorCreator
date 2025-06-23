// flawsAndPerksPageHandler.js
// This module handles the UI setup for the 'flaws-and-perks' selection page
// by delegating all rendering and interaction logic to the ItemSelectorComponent.

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

    // Component instances will be stored here
    this.flawSelectorComponent = null;
    this.perkSelectorComponent = null;

    // A single RuleEngine for this page
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

    // --- (Step 1) Find the containers in the partial HTML ---
    const flawContainer = this.selectorPanel.querySelector('.flaws-grid-container');
    const perkContainer = this.selectorPanel.querySelector('.perks-grid-container');

    if (!flawContainer || !perkContainer) {
      console.error('FlawsAndPerksPageHandler: Could not find required .flaws-grid-container or .perks-grid-container.');
      return;
    }

    // --- (Step 2) Get the necessary data from the State Manager ---
    const allFlawData = this.stateManager.getFlawData();
    const allPerkData = this.stateManager.getPerkData();

    // --- (Step 3) Create new instances of our reusable ItemSelectorComponent ---
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

    // --- (Step 4) Render the components ---
    // The components will handle everything else: restoring state, handling clicks, and validation.
    this.flawSelectorComponent.render();
    this.perkSelectorComponent.render();

    // The informer and navigator still need to be updated on page load.
    this.informerUpdater.update('flaws-and-perks');
    this.pageNavigator.updateNav();
  }

  /**
   * Cleans up the components to prevent memory leaks.
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