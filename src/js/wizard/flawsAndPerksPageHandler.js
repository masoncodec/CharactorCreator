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
    this.flawSelectorComponent = null;
    this.perkSelectorComponent = null;
    this.ruleEngine = new RuleEngine(this.stateManager);

    // --- REFACTOR START ---
    // Bind the event handler method to the class instance.
    this._handleStateChange = this._handleStateChange.bind(this);
    // --- REFACTOR END ---

    console.log('FlawsAndPerksPageHandler: Initialized.');
  }

  /**
   * Sets up the flaws and perks page by creating and rendering the item selector components.
   * @param {HTMLElement} selectorPanel - The DOM element for the selector panel.
   */
  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;
    console.log('FlawsAndPerksPageHandler.setupPage: Setting up flaws and perks components.');

    const flawContainer = this.selectorPanel.querySelector('.flaws-grid-container');
    const perkContainer = this.selectorPanel.querySelector('.perks-grid-container');

    if (!flawContainer || !perkContainer) {
      console.error('FlawsAndPerksPageHandler: Could not find required .flaws-grid-container or .perks-grid-container in the HTML.');
      return;
    }

    const allItems = this.stateManager.getItemData();

    const allFlawData = Object.values(allItems)
      .filter(item => item.itemType === 'flaw')
      .reduce((acc, item) => { acc[item.id] = item; return acc; }, {});
      
    const allPerkData = Object.values(allItems)
      .filter(item => item.itemType === 'perk')
      .reduce((acc, item) => { acc[item.id] = item; return acc; }, {});

    this.flawSelectorComponent = new ItemSelectorComponent(
      flawContainer, allFlawData, 'independent-flaw', this.stateManager, this.ruleEngine
    );

    this.perkSelectorComponent = new ItemSelectorComponent(
      perkContainer, allPerkData, 'independent-perk', this.stateManager, this.ruleEngine
    );

    this.flawSelectorComponent.render();
    this.perkSelectorComponent.render();

    // --- REFACTOR START ---
    // Listen for state changes to re-render components, updating their disabled state.
    document.addEventListener('wizard:stateChange', this._handleStateChange);
    // --- REFACTOR END ---
  }

  /**
   * NEW: Handles state change events to trigger component re-renders.
   * This ensures that perk buttons are enabled/disabled correctly as points change.
   */
  _handleStateChange(event) {
    // We only need to re-render if a selection changed, which is the most common case.
    if (event.detail.key === 'selections') {
      console.log('FlawsAndPerksPageHandler: Detected selection change, re-rendering components.');
      // Re-rendering the perk component is most important, as its affordibility changes.
      if (this.perkSelectorComponent) {
        this.perkSelectorComponent.render();
      }
      // Re-rendering the flaw component is good practice for consistency.
      if (this.flawSelectorComponent) {
        this.flawSelectorComponent.render();
      }
    }
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
    // --- REFACTOR START ---
    // Remove the event listener to prevent memory leaks when navigating away.
    document.removeEventListener('wizard:stateChange', this._handleStateChange);
    // --- REFACTOR END ---
  }
}

export { FlawsAndPerksPageHandler };