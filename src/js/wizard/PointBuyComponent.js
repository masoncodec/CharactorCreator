// PointBuyComponent.js
// FINAL VERSION: Correctly receives and passes down context.

import { ItemSelectorComponent } from './ItemSelectorComponent.js';
import { EquipmentSelectorComponent } from './EquipmentSelectorComponent.js';

class PointBuyComponent {
  /**
   * @param {HTMLElement} container - The main DOM element to render the component into.
   * @param {Object} pointBuyUnlock - The single 'pointBuy' unlock object from the JSON definition.
   * @param {string} sourceId - A unique source ID for selections made within this component.
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   * @param {RuleEngine} ruleEngine - The instance of the RuleEngine.
   * @param {Object} context - The context object passed down from the parent renderer.
   */
  constructor(container, pointBuyUnlock, sourceId, stateManager, ruleEngine, context) {
    this.container = container;
    this.unlock = pointBuyUnlock;
    this.sourceId = sourceId;
    this.stateManager = stateManager;
    this.ruleEngine = ruleEngine;
    this.context = context; // Store the context
    this.activeSelectors = [];

    console.log(`PointBuyComponent: Initialized for '${this.unlock.name}'.`);
  }

  render() {
    this.cleanup();
    this.container.innerHTML = '';

    if (!this.unlock || !this.unlock.pointPool) {
      this.container.innerHTML = `<p>Point-buy definition is invalid.</p>`;
      return;
    }

    const header = document.createElement('div');
    header.className = 'point-buy-header';
    header.innerHTML = `<h4>${this.unlock.name}</h4>`;
    this.container.appendChild(header);

    const pointSummary = this.stateManager.getPointPoolSummary(this.unlock);
    const summaryEl = document.createElement('div');
    summaryEl.className = 'points-summary-container';
    summaryEl.innerHTML = `<strong>${pointSummary.name}:</strong> <span class="points-current">${pointSummary.current}</span>`;
    if (pointSummary.total > 0) {
      summaryEl.innerHTML += ` / <span class="points-total">${pointSummary.total}</span>`;
    }
    this.container.appendChild(summaryEl);

    const allItemDefs = this.stateManager.getItemData();
    
    Object.entries(this.unlock.groups || {}).forEach(([groupId, groupDef]) => {
      const groupContainer = document.createElement('div');
      groupContainer.className = 'point-buy-group ability-group-container';
      groupContainer.innerHTML = `<h5 class="group-header">${groupDef.name}</h5>`;
      
      const componentContainer = document.createElement('div');
      componentContainer.className = 'abilities-grid-container';
      groupContainer.appendChild(componentContainer);
      this.container.appendChild(groupContainer);

      const itemsForGroup = (groupDef.items || []).reduce((acc, itemId) => {
        const itemData = allItemDefs[itemId];
        if (itemData) acc[itemId] = { ...itemData, groupId };
        return acc;
      }, {});
      
      let SelectorComponent;
      if (groupDef.type === 'equipment' || groupDef.type === 'loot') {
        SelectorComponent = EquipmentSelectorComponent;
      } else {
        SelectorComponent = ItemSelectorComponent;
      }

      // --- FIX: Pass the context object we received from the parent renderer ---
      const selector = new SelectorComponent(
        componentContainer, itemsForGroup, this.sourceId, 
        this.stateManager, this.ruleEngine, this.context
      );

      this.activeSelectors.push(selector);
      selector.render();
    });
  }

  cleanup() {
    this.activeSelectors.forEach(selector => selector.cleanup());
    this.activeSelectors = [];
  }
}

export { PointBuyComponent };