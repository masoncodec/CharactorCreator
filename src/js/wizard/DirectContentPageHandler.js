// js/wizard/DirectContentPageHandler.js
// NEW GENERIC HANDLER

import { PageContentRenderer } from './PageContentRenderer.js';
import { RuleEngine } from './RuleEngine.js';
import { InformerContentBuilder } from './InformerContentBuilder.js'; // Assuming this exists based on your other handlers

class DirectContentPageHandler {
  /**
   * @param {WizardStateManager} stateManager 
   * @param {object} config - Configuration for the page.
   * @param {string} config.pageName - The display name of the page (e.g., 'Flaws & Perks').
   * @param {string} config.sourceId - The unique source key for state management (e.g., 'flaws-and-perks').
   * @param {string} config.definitionKey - The key in stateManager.data to find the page definition (e.g., 'flawsAndPerksDef').
   */
  constructor(stateManager, config) {
    this.stateManager = stateManager;
    this.config = config;
    this.contentRenderer = null;
    this.pageDef = null;

    this._boundHandleStateChange = this._handleStateChange.bind(this);
  }

  setupPage(selectorPanel) {
    // 1. Get the page definition using the key from the config
    this.pageDef = this.stateManager.data[this.config.definitionKey];
    if (!this.pageDef) {
        selectorPanel.innerHTML = `<p>Error: ${this.config.pageName} definition not found.</p>`;
        return;
    }
    
    // 2. The rest of the setup is generic
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
    // 3. Pass the sourceId and pageDef to the renderer
    this.contentRenderer.render(unlocks, this.config.sourceId, this.pageDef);
  }

  // This logic is now in one place
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

  getInformerContent() {
    if (!this.pageDef) return '';

    // --- START OF FIX ---

    // Create a temporary definition object for the builder that includes the page name.
    // This ensures a 'displayName' property always exists.
    const definitionForBuilder = {
      ...this.pageDef,
      displayName: this.config.pageName // Uses the name from the handler's config
    };

    // Pass this new, complete definition object to the builder.
    const builder = new InformerContentBuilder(this.stateManager, this.config.sourceId, definitionForBuilder);
    
    // --- END OF FIX ---
    
    return builder.build();
  }

  isComplete() {
    // Run existing point-buy check
    const pointBuyUnlock = this.pageDef.unlocks?.find(u => u.type === 'pointBuy');
    if (pointBuyUnlock) {
      const pointSummary = this.stateManager.getPointPoolSummary(pointBuyUnlock);
      if (pointSummary.current < 0) {
        return false; // Overspent, so incomplete.
      }
    }

    // --- NEW: Add the check for nested options ---
    const selections = this.stateManager.get('selections');
    if (!this.stateManager.itemManager.hasAllNestedOptionsSelected(selections)) {
      return false; // Incomplete nested options found.
    }

    return true; // All checks passed.
  }

  getCompletionError() {
    let errorMessages = [];
    const selections = this.stateManager.get('selections');

    // Get existing point-buy error
    const pointBuyUnlock = this.pageDef.unlocks?.find(u => u.type === 'pointBuy');
    if (pointBuyUnlock) {
      const pointSummary = this.stateManager.getPointPoolSummary(pointBuyUnlock);
      if (pointSummary.current < 0) {
        errorMessages.push(`You have overspent by ${Math.abs(pointSummary.current)} point(s).`);
      }
    }

    // --- NEW: Add error messages for nested options ---
    const nestedOptionErrors = this.stateManager.itemManager.getNestedOptionsCompletionErrors(selections);
    errorMessages = errorMessages.concat(nestedOptionErrors);
    
    return errorMessages.join('\n');
  }

  cleanup() {
    this.contentRenderer?.cleanup();
    document.removeEventListener('wizard:stateChange', this._boundHandleStateChange);
  }
}

export { DirectContentPageHandler };