// equipmentAndLootPageHandler.js
// REFACTORED: The final, thin handler that uses the PageContentRenderer.

import { PageContentRenderer } from './PageContentRenderer.js';
import { RuleEngine } from './RuleEngine.js';

class EquipmentAndLootPageHandler {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.contentRenderer = null;
    this.pageDef = null;

    this._boundHandleStateChange = this._handleStateChange.bind(this);
  }

  setupPage(selectorPanel) {
    this.pageDef = this.stateManager.data.equipmentAndLootDef;
    if (!this.pageDef) {
        selectorPanel.innerHTML = '<p>Error: Equipment & Loot definition not found.</p>';
        return;
    }
    
    this.contentRenderer = new PageContentRenderer(
      selectorPanel, this.stateManager, new RuleEngine(this.stateManager)
    );
    this.render();

    document.addEventListener('wizard:stateChange', this._boundHandleStateChange);
  }
  
  _handleStateChange(event) {
      if (event.detail.key === 'selections' || event.detail.key === 'creationLevel') {
          this.render();
          document.dispatchEvent(new CustomEvent('wizard:informerUpdate', { detail: { handler: this } }));
      }
  }
  
  render() {
    if (!this.contentRenderer) return;
    const unlocks = this._getUnlocksForCurrentState();
    this.contentRenderer.render(unlocks, 'equipment-and-loot', this.pageDef);
  }

  _getUnlocksForCurrentState() {
    const targetLevel = this.stateManager.get('creationLevel');
    let availableUnlocks = [];
    if (this.pageDef && Array.isArray(this.pageDef.levels)) {
        this.pageDef.levels.forEach(levelData => {
            if (levelData.level <= targetLevel && levelData.unlocks) {
                availableUnlocks.push(...levelData.unlocks);
            }
        });
    }
    return availableUnlocks;
  }

  /**
   * --- REPLACED ---
   * This method now delegates the complex HTML generation to the InformerContentBuilder.
   */
  getInformerContent() {
    if (!this.pageDef) return '';
    const builder = new InformerContentBuilder(this.stateManager, 'equipment-and-loot', this.pageDef);
    return builder.build();
  }

  isComplete() {
    if (!this.pageDef) return true;
    const pointBuyUnlock = this.pageDef.unlocks?.find(u => u.type === 'pointBuy');
    if (!pointBuyUnlock) return true;
    const pointSummary = this.stateManager.getPointPoolSummary(pointBuyUnlock);
    return pointSummary.current >= 0;
  }

  getCompletionError() {
    if (!this.pageDef) return '';
    const pointBuyUnlock = this.pageDef.unlocks?.find(u => u.type === 'pointBuy');
    if (!pointBuyUnlock) return '';
    const pointSummary = this.stateManager.getPointPoolSummary(pointBuyUnlock);
    if (pointSummary.current < 0) {
      return `You have overspent by ${Math.abs(pointSummary.current)} equipment point(s).`;
    }
    return '';
  }

  cleanup() {
    this.contentRenderer?.cleanup();
    document.removeEventListener('wizard:stateChange', this._boundHandleStateChange);
  }
}

export { EquipmentAndLootPageHandler };