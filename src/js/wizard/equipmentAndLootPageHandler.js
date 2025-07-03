// equipmentAndLootPageHandler.js
// REFACTORED: Now a simple handler that uses the generic PointBuyComponent.

import { PointBuyComponent } from './PointBuyComponent.js';
import { RuleEngine } from './RuleEngine.js';

class EquipmentAndLootPageHandler {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.selectorPanel = null;
    this.pointBuyComponent = null;
    this.ruleEngine = new RuleEngine(this.stateManager);
    this.pageDef = null;
    console.log('EquipmentAndLootPageHandler: Initialized (Refactored).');
  }

  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;
    // Get the page definition loaded by the dataLoader
    this.pageDef = this.stateManager.data.equipmentAndLootDef;

    if (!this.pageDef) {
        this.selectorPanel.innerHTML = '<p>Error: Equipment & Loot definition not found.</p>';
        return;
    }
    
    const sourceId = 'equipment-and-loot';

    // Create and render the new generic component
    this.pointBuyComponent = new PointBuyComponent(this.selectorPanel, this.pageDef, sourceId, this.stateManager, this.ruleEngine);
    this.pointBuyComponent.render();
  }

  getInformerContent() {
    if (!this.pageDef) return '';
    
    const pointSummary = this.stateManager.getPointPoolSummary(this.pageDef);
    return `
      <h3>${pointSummary.name}</h3>
      <div class="points-summary-container">
        <strong>${pointSummary.current} / ${pointSummary.total} Remaining</strong>
      </div>
    `;
  }

  isComplete(currentState) {
    if (!this.pageDef) return true; // If no definition, nothing to validate.
    
    const pointSummary = this.stateManager.getPointPoolSummary(this.pageDef);
    // This page is always considered completable, but we prevent overspending.
    return pointSummary.current >= 0;
  }

  getCompletionError() {
    if (!this.pageDef) return '';

    const pointSummary = this.stateManager.getPointPoolSummary(this.pageDef);
    if (pointSummary.current < 0) {
      return `You have overspent by ${Math.abs(pointSummary.current)} equipment point(s).`;
    }
    return ''; // Page is always "complete", but RuleEngine prevents overspending.
  }

  cleanup() {
    this.pointBuyComponent?.cleanup();
  }
}

export { EquipmentAndLootPageHandler };