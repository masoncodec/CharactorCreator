// characterFinisher.js
// This module handles the final validation of the character data
// and the saving process.

class CharacterFinisher {
  /**
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   * @param {Object} db - The database instance for saving characters (e.g., Firestore).
   * @param {Object} alerter - The alerter utility for displaying messages.
   * @param {EffectHandler} EffectHandler - The EffectHandler module for calculating character effects.
   * @param {PageNavigator} pageNavigator - The instance of the PageNavigator for centralized validation.
   * @param {string[]} pages - An array of all page names in order.
   */
  constructor(stateManager, db, alerter, EffectHandler, pageNavigator, pages) {
    this.stateManager = stateManager;
    this.db = db;
    this.alerter = alerter;
    this.EffectHandler = EffectHandler;
    this.pageNavigator = pageNavigator;
    this.pages = pages;

    // Listen for the custom event dispatched by PageNavigator when 'Finish' is clicked
    this._boundFinishHandler = this.finishWizard.bind(this);
    document.removeEventListener('wizard:finish', this._boundFinishHandler);
    document.addEventListener('wizard:finish', this._boundFinishHandler);

    console.log('CharacterFinisher: Initialized.');
  }

  /**
   * Performs the final validation by delegating to the centralized PageNavigator.
   * @returns {{isValid: boolean, message: string}} Validation result and message.
   * @private
   */
  _validateAllPages() {
    console.log('CharacterFinisher._validateAllPages: Running centralized validation via PageNavigator.');
    const errors = [];
    const currentState = this.stateManager.getState();

    // Define pages that have actual validation logic.
    const pagesToValidate = this.pages.filter(p => p !== 'frame' && p !== 'equipment-and-loot');

    for (const page of pagesToValidate) {
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
   * REFACTORED: Calculates the character's effects based on the new 'selections' state.
   * @param {Object} currentState - The complete current state from the state manager.
   * @param {Object} allItemDefs - A map of all item definitions.
   * @returns {Object} An object representing the character's calculated state.
   * @private
   */
  _calculateCharacterEffects(currentState, allItemDefs) {
    // Filter the unified 'selections' array to get the specific item types
    const abilities = currentState.selections.filter(sel => allItemDefs[sel.id]?.itemType === 'ability');
    const flaws = currentState.selections.filter(sel => allItemDefs[sel.id]?.itemType === 'flaw');
    const perks = currentState.selections.filter(sel => allItemDefs[sel.id]?.itemType === 'perk');

    // Re-create the activeAbilityStates Set as expected by EffectHandler
    const activeAbilityStates = new Set(
      abilities
        .filter(a => allItemDefs[a.id]?.type === 'active')
        .map(a => a.id)
    );

    // Prepare character state for EffectHandler
    const destinyDef = this.stateManager.getDestiny(currentState.destiny);
    const characterStateForEffects = {
      abilities: abilities,
      flaws: flaws,
      perks: perks,
      destiny: currentState.destiny,
      health: { max: destinyDef.health.value }
    };

    // Use EffectHandler to process effects
    this.EffectHandler.processActiveAbilities(
      characterStateForEffects,
      this.stateManager.data.abilities, // Pass the original data slices
      this.stateManager.data.flaws,
      this.stateManager.data.perks,
      activeAbilityStates,
      'wizard'
    );

    // Apply effects to get the calculated health
    return this.EffectHandler.applyEffectsToCharacter(
      characterStateForEffects,
      'wizard'
    );
  }
  
  /**
   * REFACTORED: Processes the final inventory by combining items from multiple sources.
   * @param {Object} currentState - The complete current state from the state manager.
   * @returns {Array<Object>} The processed, final inventory.
   * @private
   */
  _processFinalInventory(currentState) {
    console.log("CharacterFinisher: Processing final inventory...");
    const finalInventory = [];
    const stackableMap = new Map();

    // 1. Get equipment from the main 'selections' array (e.g., from Destiny)
    const allItemDefs = this.stateManager.getItemData();
    const equipmentSelections = currentState.selections.filter(sel => allItemDefs[sel.id]?.itemType === 'equipment');

    const combinedRawInventory = [
        ...currentState.inventory, // Items from equipment-and-loot page
        ...equipmentSelections.map(sel => ({ ...sel, quantity: 1, equipped: true })) // Add items from destiny/other selections
    ];

    for (const itemState of combinedRawInventory) {
      const itemDef = allItemDefs[itemState.id];
      if (!itemDef) continue;

      if (itemDef.stackable) {
        if (!stackableMap.has(itemState.id)) {
          stackableMap.set(itemState.id, {
            id: itemState.id,
            quantity: 0,
            sources: new Set(),
          });
        }
        const entry = stackableMap.get(itemState.id);
        entry.quantity += itemState.quantity;
        if (itemState.source) entry.sources.add(itemState.source);
      } else {
        finalInventory.push(itemState);
      }
    }

    // Process the collected stackable items
    for (const [, combinedItem] of stackableMap.entries()) {
      finalInventory.push({
        id: combinedItem.id,
        quantity: combinedItem.quantity,
        equipped: true, // Simplification for now
        source: Array.from(combinedItem.sources).join(', '),
      });
    }
    
    console.log("CharacterFinisher: Final inventory processed:", finalInventory);
    return finalInventory;
  }

  /**
   * REFACTORED: Initiates the wizard finishing process using the new state structure.
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
    
    // Calculate final character effects (like health)
    const characterEffects = this._calculateCharacterEffects(currentState, allItemDefs);

    // Process the inventory before saving
    const finalInventory = this._processFinalInventory(currentState);

    // Construct the final character object to be saved
    const character = {
      module: currentState.module,
      destiny: currentState.destiny,
      attributes: currentState.attributes,
      info: currentState.info,
      createdAt: new Date().toISOString(),
      // Filter the final selections for saving
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

  /**
   * Cleans up event listeners when the component is no longer needed.
   */
  cleanup() {
    console.log('CharacterFinisher.cleanup: Cleaning up resources.');
    document.removeEventListener('wizard:finish', this._boundFinishHandler);
  }
}

export { CharacterFinisher };