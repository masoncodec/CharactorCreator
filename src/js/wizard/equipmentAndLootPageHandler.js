// equipmentAndLootPageHandler.js
// This module handles the UI setup for the 'equipment-and-loot' selection page
// by delegating all rendering and interaction logic to instances of the
// new specialized EquipmentSelectorComponent.

import { EquipmentSelectorComponent } from './EquipmentSelectorComponent.js';
import { RuleEngine } from './RuleEngine.js';

class EquipmentAndLootPageHandler {
  constructor(stateManager, informerUpdater, pageNavigator) {
    this.stateManager = stateManager;
    this.informerUpdater = informerUpdater;
    this.pageNavigator = pageNavigator;
    this.selectorPanel = null;
    this.ruleEngine = new RuleEngine(this.stateManager);
    this.activeSelectors = []; // Will hold our component instances

    // Bind the state change handler to the class instance.
    this._boundHandleStateChange = this._handleStateChange.bind(this);

    console.log('EquipmentAndLootPageHandler: Initialized (Refactored).');
  }

  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;
    console.log('EquipmentAndLootPageHandler.setupPage: Setting up equipment/loot components.');

    const equipmentContainer = this.selectorPanel.querySelector('.equipment-column .scroll-area');
    const lootContainer = this.selectorPanel.querySelector('.loot-column .scroll-area');

    if (!equipmentContainer || !lootContainer) {
      console.error('EquipmentAndLootPageHandler: Could not find required column containers.');
      return;
    }

    const allItems = this.stateManager.getItemData();
    const SOURCE_ID = 'equipment-and-loot';

    // Filter all items into the two categories for this page
    const equipmentData = Object.values(allItems)
      .filter(item => item.itemType === 'equipment')
      .reduce((acc, item) => { acc[item.id] = item; return acc; }, {});
      
    const lootData = Object.values(allItems)
      .filter(item => item.itemType === 'loot')
      .reduce((acc, item) => { acc[item.id] = item; return acc; }, {});

    // Instantiate our new specialized components
    const equipmentSelector = new EquipmentSelectorComponent(
      equipmentContainer, equipmentData, SOURCE_ID, this.stateManager, this.ruleEngine
    );

    const lootSelector = new EquipmentSelectorComponent(
      lootContainer, lootData, SOURCE_ID, this.stateManager, this.ruleEngine
    );

    this.activeSelectors.push(equipmentSelector, lootSelector);
    
    // Initial render for both components
    this.activeSelectors.forEach(selector => selector.render());

    // Listen for global state changes to trigger re-renders
    document.addEventListener('wizard:stateChange', this._boundHandleStateChange);

    this.informerUpdater.update('equipment-and-loot');
    this.pageNavigator.updateNav();
  }

  /**
   * Handles the global state change event to re-render child components.
   * This keeps the UI (points, disabled states, etc.) in sync with the state.
   * @param {CustomEvent} event - The 'wizard:stateChange' event.
   */
  _handleStateChange(event) {
    if (event.detail.key === 'selections') {
      console.log('EquipmentAndLootPageHandler: Detected selection change, re-rendering components.');
      this.activeSelectors.forEach(selector => selector.render());
    }
  }

  /**
   * Cleans up the components and listeners to prevent memory leaks.
   */
  cleanup() {
    console.log('EquipmentAndLootPageHandler.cleanup: Cleaning up resources.');
    this.activeSelectors.forEach(selector => selector.cleanup());
    this.activeSelectors = [];
    document.removeEventListener('wizard:stateChange', this._boundHandleStateChange);
  }
}

export { EquipmentAndLootPageHandler };