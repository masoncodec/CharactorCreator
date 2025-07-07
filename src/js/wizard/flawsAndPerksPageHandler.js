// flawsAndPerksPageHandler.js
// REFACTORED: Now a thin wrapper around the generic DirectContentPageHandler.

import { DirectContentPageHandler } from './DirectContentPageHandler.js';

// Configuration specific to the Flaws & Perks page
const flawsAndPerksConfig = {
  pageName: 'Flaws & Perks',
  sourceId: 'flaws-and-perks',
  definitionKey: 'flawsAndPerksDef'
};

class FlawsAndPerksPageHandler extends DirectContentPageHandler {
  constructor(stateManager) {
    super(stateManager, flawsAndPerksConfig);
  }

  // You can still override methods here if this page has unique behavior.
  // For example, if the error message needs to be more specific:
  getCompletionError() {
    const pointBuyUnlock = this.pageDef?.unlocks?.find(u => u.type === 'pointBuy');
    if (!pointBuyUnlock) return '';
    const pointSummary = this.stateManager.getPointPoolSummary(pointBuyUnlock);
    if (pointSummary.current < 0) {
      return `You have overspent by ${Math.abs(pointSummary.current)} Character Point(s).`;
    }
    return '';
  }
}

export { FlawsAndPerksPageHandler };