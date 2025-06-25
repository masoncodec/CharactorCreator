// flawsAndPerksPageHandler.js
// REFACTORED: This module handles the UI for the 'flaws-and-perks' page
// and its associated completion and informer logic.

import { ItemSelectorComponent } from './ItemSelectorComponent.js';
import { RuleEngine } from './RuleEngine.js';

class FlawsAndPerksPageHandler {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.selectorPanel = null;
    this.flawSelectorComponent = null;
    this.perkSelectorComponent = null;
    this.ruleEngine = new RuleEngine(this.stateManager);

    this._handleStateChange = this._handleStateChange.bind(this);
    console.log('FlawsAndPerksPageHandler: Initialized (Refactored).');
  }

  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;
    const flawContainer = this.selectorPanel.querySelector('.flaws-grid-container');
    const perkContainer = this.selectorPanel.querySelector('.perks-grid-container');

    if (!flawContainer || !perkContainer) {
      console.error('Could not find required .flaws-grid-container or .perks-grid-container.');
      return;
    }

    const allItems = this.stateManager.getItemData();
    const allFlawData = Object.values(allItems).filter(item => item.itemType === 'flaw')
      .reduce((acc, item) => ({ ...acc, [item.id]: item }), {});
    const allPerkData = Object.values(allItems).filter(item => item.itemType === 'perk')
      .reduce((acc, item) => ({ ...acc, [item.id]: item }), {});

    this.flawSelectorComponent = new ItemSelectorComponent(flawContainer, allFlawData, 'independent-flaw', this.stateManager, this.ruleEngine);
    this.perkSelectorComponent = new ItemSelectorComponent(perkContainer, allPerkData, 'independent-perk', this.stateManager, this.ruleEngine);

    this.flawSelectorComponent.render();
    this.perkSelectorComponent.render();
    
    document.addEventListener('wizard:stateChange', this._handleStateChange);
  }

  _handleStateChange(event) {
    if (event.detail.key === 'selections') {
      this.perkSelectorComponent?.render();
      this.flawSelectorComponent?.render();
    }
  }
  
  // --- NEW: Methods for delegated logic ---

  getInformerContent() {
    const currentState = this.stateManager.getState();
    const allItemDefs = this.stateManager.getItemData();
    const independentSelections = currentState.selections.filter(sel => sel.source.startsWith('independent-'));
    
    const renderIndependentItems = (itemType) => {
        const items = independentSelections.filter(sel => allItemDefs[sel.id]?.itemType === itemType);
        if (items.length === 0) return `<p>No ${itemType}s selected yet.</p>`;
        return items.map(sel => {
            const itemDef = allItemDefs[sel.id];
            return `<div class="selected-item-display-card"><h5>${itemDef.name} (${itemDef.weight} pts)</h5></div>`;
        }).join('');
    };
    
    const availablePoints = this.stateManager.getAvailableCharacterPoints();

    return `
      <h3>Flaws & Perks</h3>
      <div class="points-summary-container"><strong>Available Points: ${availablePoints}</strong></div>
      <hr/>
      <div class="selected-items-columns">
        <div class="selected-column">
          <h4>Selected Flaws</h4>
          ${renderIndependentItems('flaw')}
        </div>
        <div class="selected-column">
          <h4>Selected Perks</h4>
          ${renderIndependentItems('perk')}
        </div>
      </div>`;
  }

  isComplete(currentState) {
    const allItemDefs = this.stateManager.getItemData();
    const choicesComplete = currentState.selections
      .filter(sel => sel.source.startsWith('independent-'))
      .every(sel => {
        const itemDef = allItemDefs[sel.id];
        return !(itemDef?.options && itemDef.maxChoices && sel.selections.length !== itemDef.maxChoices);
      });
    
    const pointsValid = this.stateManager.getAvailableCharacterPoints() >= 0;
    return choicesComplete && pointsValid;
  }

  getCompletionError() {
    const points = this.stateManager.getAvailableCharacterPoints();
    if (points < 0) {
      return 'Perk Point cost cannot exceed Flaw Point value.';
    }
    return 'Please complete all required nested flaw/perk selections.';
  }

  cleanup() {
    this.flawSelectorComponent?.cleanup();
    this.perkSelectorComponent?.cleanup();
    document.removeEventListener('wizard:stateChange', this._handleStateChange);
  }
}

export { FlawsAndPerksPageHandler };
