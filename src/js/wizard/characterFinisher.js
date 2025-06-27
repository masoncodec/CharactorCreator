// characterFinisher.js
// This module handles the final validation of the character data and the saving process.
// REFACTORED: Now relies entirely on the PageNavigator to orchestrate validation.

class CharacterFinisher {
  /**
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   * @param {Object} db - The database instance for saving characters (e.g., Firestore).
   * @param {Object} alerter - The alerter utility for displaying messages.
   * @param {EffectHandler} EffectHandler - The EffectHandler module for calculating character effects.
   * @param {PageNavigator} pageNavigator - The instance of the PageNavigator.
   * @param {string[]} pages - An array of all page names in order.
   */
  constructor(stateManager, db, alerter, EffectHandler, pageNavigator, pages) {
    this.stateManager = stateManager;
    this.db = db;
    this.alerter = alerter;
    this.EffectHandler = EffectHandler;
    this.pageNavigator = pageNavigator;
    this.pages = pages;

    this._boundFinishHandler = this.finishWizard.bind(this);
    document.addEventListener('wizard:finish', this._boundFinishHandler);

    console.log('CharacterFinisher: Initialized (Refactored).');
  }

  /**
   * REFACTORED: Performs final validation by iterating through all pages
   * and using the PageNavigator's delegated validation methods.
   * @private
   */
  _validateAllPages() {
    console.log('CharacterFinisher._validateAllPages: Running centralized validation via PageNavigator.');
    const errors = [];
    const currentState = this.stateManager.getState();

    // Iterate over all pages managed by the navigator.
    for (const page of this.pages) {
      if (!this.pageNavigator.isPageCompleted(page, currentState)) {
        const errorMessage = this.pageNavigator.getCompletionError(page);
        errors.push(`• ${errorMessage}`);
      }
    }

    return {
      isValid: errors.length === 0,
      message: errors.join("\n")
    };
  }
  
  /**
   * Initiates the wizard finishing process.
   */
  async finishWizard() {
    console.log('CharacterFinisher.finishWizard: Attempting to finish wizard.');
    const validation = this._validateAllPages();

    if (!validation.isValid) {
      this.alerter.show("Please complete the following:\n\n" + validation.message, 'error');
      return;
    }

    const currentState = this.stateManager.getState();
    const allItemDefs = this.stateManager.getItemData();
    
    const characterEffects = this._calculateCharacterEffects(currentState, allItemDefs);
    const finalInventory = this._processFinalInventory(currentState);

    const character = {
      module: currentState.module,
      destiny: currentState.destiny,
      attributes: currentState.attributes,
      info: currentState.info,
      createdAt: new Date().toISOString(),
      flaws: currentState.selections.filter(sel => allItemDefs[sel.id]?.itemType === 'flaw'),
      perks: currentState.selections.filter(sel => allItemDefs[sel.id]?.itemType === 'perk'),
      abilities: currentState.selections.filter(sel => allItemDefs[sel.id]?.itemType === 'ability'),
      inventory: finalInventory,
      health: {
        current: characterEffects.calculatedHealth.currentMax,
        max: characterEffects.calculatedHealth.currentMax,
        temporary: 0
      },
    };
    
    console.log('CharacterFinisher.finishWizard: Character object prepared for saving:', character);

    try {
      if (this.db && typeof this.db.saveCharacter === 'function') {
        await this.db.saveCharacter(character);
        window.location.href = 'character-selector.html';
      } else {
        throw new Error("Database service or saveCharacter method is not available.");
      }
    } catch (err) {
      console.error('CharacterFinisher.finishWizard: Failed to save character:', err);
      this.alerter.show(`Failed to save character: ${err.message}`, 'error');
    }
  }

  _calculateCharacterEffects(currentState, allItemDefs) {
    const abilities = currentState.selections.filter(sel => allItemDefs[sel.id]?.itemType === 'ability');
    const flaws = currentState.selections.filter(sel => allItemDefs[sel.id]?.itemType === 'flaw');
    const perks = currentState.selections.filter(sel => allItemDefs[sel.id]?.itemType === 'perk');
    const activeAbilityStates = new Set(
      abilities.filter(a => allItemDefs[a.id]?.type === 'active').map(a => a.id)
    );
    const destinyDef = this.stateManager.getDestiny(currentState.destiny);
    const characterStateForEffects = {
      abilities, flaws, perks,
      destiny: currentState.destiny,
      health: { max: destinyDef.health.value }
    };
    this.EffectHandler.processActiveAbilities(
      characterStateForEffects, this.stateManager.data.abilities,
      this.stateManager.data.flaws, this.stateManager.data.perks,
      activeAbilityStates, 'wizard'
    );
    return this.EffectHandler.applyEffectsToCharacter(characterStateForEffects, 'wizard');
  }

  _processFinalInventory(currentState) {
    const finalInventory = [];
    const stackableMap = new Map();
    const allItemDefs = this.stateManager.getItemData();
    
    // Correctly filter for all equipment and loot from any source.
    const inventorySelections = currentState.selections.filter(sel => {
        const itemDef = allItemDefs[sel.id];
        return itemDef && (itemDef.itemType === 'equipment' || itemDef.itemType === 'loot');
    });

    // Combine selections from the wizard with items added by other means (e.g. effects).
    // This no longer incorrectly overrides quantity or equipped status.
    const combinedRawInventory = [
        ...currentState.inventory,
        ...inventorySelections
    ];

    for (const itemState of combinedRawInventory) {
      const itemDef = allItemDefs[itemState.id];
      if (!itemDef) continue;
      if (itemDef.stackable) {
        if (!stackableMap.has(itemState.id)) {
          stackableMap.set(itemState.id, { id: itemState.id, quantity: 0, sources: new Set() });
        }
        const entry = stackableMap.get(itemState.id);
        entry.quantity += itemState.quantity || 1; // Default to 1 if quantity isn't set
        if (itemState.source) entry.sources.add(itemState.source);
      } else {
        finalInventory.push(itemState);
      }
    }
    for (const [, combinedItem] of stackableMap.entries()) {
      finalInventory.push({
        id: combinedItem.id,
        quantity: combinedItem.quantity,
        equipped: true, // Stackable items are generally considered "equipped" or active
        source: Array.from(combinedItem.sources).join(', '),
      });
    }
    return finalInventory;
  }

  cleanup() {
    document.removeEventListener('wizard:finish', this._boundFinishHandler);
  }
}

export { CharacterFinisher };