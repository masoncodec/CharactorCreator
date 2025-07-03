// PointBuyComponent.js
// FINAL VERSION: Automatically selects the correct rendering component based on group type.

import { ItemSelectorComponent } from './ItemSelectorComponent.js';
import { EquipmentSelectorComponent } from './EquipmentSelectorComponent.js';

class PointBuyComponent {
  /**
   * @param {HTMLElement} container - The main DOM element to render the component into.
   * @param {Object} pageDef - The full JSON definition for the page.
   * @param {string} sourceId - A unique source ID for selections made on this page.
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   * @param {RuleEngine} ruleEngine - The instance of the RuleEngine.
   */
  constructor(container, pageDef, sourceId, stateManager, ruleEngine) {
    this.container = container;
    this.pageDef = pageDef;
    this.sourceId = sourceId;
    this.stateManager = stateManager;
    this.ruleEngine = ruleEngine;
    this.activeSelectors = [];

    this._boundHandleStateChange = this.render.bind(this);
    console.log(`PointBuyComponent: Initialized for '${pageDef.name}'.`);
  }

  render() {
    this.cleanup();
    this.container.innerHTML = '';

    if (!this.pageDef) {
      this.container.innerHTML = `<p>Page definition not found.</p>`;
      return;
    }

    const header = document.createElement('div');
    header.className = 'point-buy-header';
    header.innerHTML = `<h2>${this.pageDef.name}</h2><p>${this.pageDef.description}</p>`;
    this.container.appendChild(header);

    const pointSummary = this.stateManager.getPointPoolSummary(this.pageDef);
    const summaryEl = document.createElement('div');
    summaryEl.className = 'points-summary-container';
    summaryEl.innerHTML = `<strong>${pointSummary.name}:</strong> <span class="points-current">${pointSummary.current}</span>`;
    if (pointSummary.total > 0) {
      summaryEl.innerHTML += ` / <span class="points-total">${pointSummary.total}</span>`;
    }
    this.container.appendChild(summaryEl);

    const targetLevel = this.stateManager.get('creationLevel');
    const allItemDefs = this.stateManager.getItemData();

    if (Array.isArray(this.pageDef.levels)) {
      this.pageDef.levels.forEach(levelData => {
        if (levelData.level > targetLevel || !levelData.groups) return;
        
        const context = {
            pageDef: this.pageDef,
            getDefinition: () => this.pageDef
        };

        Object.entries(levelData.groups).forEach(([groupId, groupDef]) => {
          const groupContainer = document.createElement('div');
          groupContainer.className = 'point-buy-group ability-group-container';
          groupContainer.innerHTML = `<h5 class="group-header">${groupDef.name}</h5>`;
          
          const componentContainer = document.createElement('div');
          componentContainer.className = 'abilities-grid-container';
          groupContainer.appendChild(componentContainer);
          this.container.appendChild(groupContainer);

          let itemsForGroup = {};
          if (groupDef.items) {
            itemsForGroup = groupDef.items.reduce((acc, itemId) => {
                const itemData = allItemDefs[itemId];
                if (itemData) acc[itemId] = { ...itemData, groupId };
                return acc;
            }, {});
          }

          // --- REPLACED: Logic is now automatic based on the group's type. ---
          let SelectorComponent;
          if (groupDef.type === 'equipment' || groupDef.type === 'loot') {
            SelectorComponent = EquipmentSelectorComponent;
          } else {
            SelectorComponent = ItemSelectorComponent;
          }

          const selector = new SelectorComponent(
            componentContainer, itemsForGroup, this.sourceId, 
            this.stateManager, this.ruleEngine, context
          );

          this.activeSelectors.push(selector);
          selector.render();
        });
      });
    }
    
    this._attachEventListeners();
  }

  _attachEventListeners() {
    document.addEventListener('wizard:stateChange', this._boundHandleStateChange);
  }

  cleanup() {
    this.activeSelectors.forEach(selector => selector.cleanup());
    this.activeSelectors = [];
    document.removeEventListener('wizard:stateChange', this._boundHandleStateChange);
  }
}

export { PointBuyComponent };