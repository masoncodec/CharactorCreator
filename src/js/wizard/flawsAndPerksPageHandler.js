// flawsAndPerksPageHandler.js
// REFACTORED: Now a simple handler that uses the generic PointBuyComponent.

import { PointBuyComponent } from './PointBuyComponent.js';
import { RuleEngine } from './RuleEngine.js';

class FlawsAndPerksPageHandler {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.selectorPanel = null;
    this.pointBuyComponent = null;
    this.ruleEngine = new RuleEngine(this.stateManager);
    this.pageDef = null;
    console.log('FlawsAndPerksPageHandler: Initialized (Refactored).');
  }

  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;
    // Get the page definition loaded by the dataLoader
    this.pageDef = this.stateManager.data.flawsAndPerksDef;

    if (!this.pageDef) {
        this.selectorPanel.innerHTML = '<p>Error: Flaws & Perks definition not found.</p>';
        return;
    }
    
    // The sourceId 'flaws-and-perks' should match the old sources ('independent-flaw', 'independent-perk')
    // if you want to maintain compatibility with old characters. For this refactor, we'll use a single source.
    const sourceId = 'flaws-and-perks';

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
        <strong>Available Points: ${pointSummary.current}</strong>
      </div>
      <p>Select Flaws to gain more points. Spend points on Perks.</p>
    `;
  }

  isComplete(currentState) {
    if (!this.pageDef) return true; // If no definition, nothing to validate.
    
    const pointSummary = this.stateManager.getPointPoolSummary(this.pageDef);
    // The page is complete as long as the user hasn't overspent their points.
    return pointSummary.current >= 0;
  }

  getCompletionError() {
    if (!this.pageDef) return '';

    const pointSummary = this.stateManager.getPointPoolSummary(this.pageDef);
    if (pointSummary.current < 0) {
      return `You have overspent by ${Math.abs(pointSummary.current)} point(s). Please add Flaws or remove Perks.`;
    }
    return 'An unknown validation error occurred.';
  }

  cleanup() {
    this.pointBuyComponent?.cleanup();
  }
}

export { FlawsAndPerksPageHandler };