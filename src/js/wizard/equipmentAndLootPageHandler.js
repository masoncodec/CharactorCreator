// equipmentAndLootPageHandler.js
// REFACTORED: Handles the 'equipment-and-loot' page UI and logic.

import { EquipmentSelectorComponent } from './EquipmentSelectorComponent.js';
import { RuleEngine } from './RuleEngine.js';

class EquipmentAndLootPageHandler {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.selectorPanel = null;
    this.ruleEngine = new RuleEngine(this.stateManager);
    this.activeSelectors = [];

    this._boundHandleStateChange = this._handleStateChange.bind(this);
    console.log('EquipmentAndLootPageHandler: Initialized (Refactored).');
  }

  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;
    const equipmentContainer = this.selectorPanel.querySelector('.equipment-column .scroll-area');
    const lootContainer = this.selectorPanel.querySelector('.loot-column .scroll-area');

    if (!equipmentContainer || !lootContainer) {
      console.error('Could not find required column containers.');
      return;
    }

    const allItems = this.stateManager.getItemData();
    const SOURCE_ID = 'equipment-and-loot';

    const equipmentData = Object.values(allItems).filter(item => item.itemType === 'equipment')
      .reduce((acc, item) => ({ ...acc, [item.id]: item }), {});
    const lootData = Object.values(allItems).filter(item => item.itemType === 'loot')
      .reduce((acc, item) => ({ ...acc, [item.id]: item }), {});

    this.activeSelectors.push(
      new EquipmentSelectorComponent(equipmentContainer, equipmentData, SOURCE_ID, this.stateManager, this.ruleEngine),
      new EquipmentSelectorComponent(lootContainer, lootData, SOURCE_ID, this.stateManager, this.ruleEngine)
    );
    
    this.activeSelectors.forEach(selector => selector.render());
    document.addEventListener('wizard:stateChange', this._boundHandleStateChange);
  }

  _handleStateChange(event) {
    if (event.detail.key === 'selections') {
      this.activeSelectors.forEach(selector => selector.render());
    }
  }

  // --- NEW: Methods for delegated logic ---

  getInformerContent() {
    const { spent, total } = this.stateManager.getEquipmentPointsSummary();
    const equipmentSelections = this.stateManager.getState().selections.filter(sel => sel.source === 'equipment-and-loot');
    const allItemDefs = this.stateManager.getItemData();

    let inventoryListHtml = '';
    if (equipmentSelections.length === 0) {
      inventoryListHtml = '<p>Your inventory is empty.</p>';
    } else {
      inventoryListHtml = '<ul>' + equipmentSelections.map(sel => {
        const itemDef = allItemDefs[sel.id];
        const quantityText = (sel.quantity > 1) ? ` x${sel.quantity}` : '';
        return `<li>${itemDef.name}${quantityText} (${itemDef.weight * sel.quantity} pts)</li>`;
      }).join('') + '</ul>';
    }

    return `
      <h3>Equipment & Loot</h3>
      <div class="points-summary-container"><strong>Equipment Points: ${spent} / ${total}</strong></div>
      <div id="current-inventory-list">${inventoryListHtml}</div>`;
  }

  isComplete(currentState) {
    return true;
  }

  getCompletionError() {
    return '';
  }

  cleanup() {
    this.activeSelectors.forEach(selector => selector.cleanup());
    this.activeSelectors = [];
    document.removeEventListener('wizard:stateChange', this._boundHandleStateChange);
  }
}

export { EquipmentAndLootPageHandler };
