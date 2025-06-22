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
    this.pageNavigator = pageNavigator; // Store the PageNavigator instance
    this.pages = pages; // Store the list of pages

    // Listen for the custom event dispatched by PageNavigator when 'Finish' is clicked
    document.removeEventListener('wizard:finish', this._boundFinishHandler); // Remove previous listener
    this._boundFinishHandler = this.finishWizard.bind(this);
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
    const pagesToValidate = this.pages.filter(p => 
        p !== 'frame' && p !== 'equipment-and-loot'
    );

    for (const page of pagesToValidate) {
        if (!this.pageNavigator.isPageCompleted(page, currentState)) {
            const errorMessage = this.pageNavigator.getCompletionError(page);
            errors.push(`• ${errorMessage}`);
            console.log(`  - Validation error on page '${page}': ${errorMessage}`);
        }
    }

    return {
      isValid: errors.length === 0,
      message: errors.join("\n")
    };
  }


  /**
   * Calculates the character's effects based on selected abilities, flaws, and perks.
   * @returns {Object} An object representing the character's calculated state (e.g., health).
   * @private
   */
  _calculateCharacterEffects() {
    const currentState = this.stateManager.getState();
    const destinyData = this.stateManager.getDestinyData();
    const abilityData = this.stateManager.getAbilityData();
    const flawData = this.stateManager.getFlawData();
    const perkData = this.stateManager.getPerkData(); // Get perk data
    // equipmentAndLootData will not be processed for effects here yet, as it's a stretch goal.

    // Re-create the activeAbilityStates Set as expected by EffectHandler.processActiveAbilities
    const activeAbilityStates = new Set(
        currentState.abilities
            .filter(a => abilityData[a.id]?.type === 'active')
            .map(a => a.id)
    );

    // Prepare character state for EffectHandler
    const characterStateForEffects = {
        abilities: currentState.abilities,
        flaws: currentState.flaws,
        perks: currentState.perks,
        destiny: currentState.destiny,
        health: { max: destinyData[currentState.destiny].health.value }
    };

    // Use EffectHandler to process active abilities, now correctly passing activeAbilityStates
    // Assuming EffectHandler might eventually process perk effects too, if applicable
    this.EffectHandler.processActiveAbilities(
        characterStateForEffects,
        abilityData,
        flawData,
        perkData,
        activeAbilityStates,
        'wizard'
    );

    // Apply effects to a dummy character object to get the calculated health
    const effectedCharacter = this.EffectHandler.applyEffectsToCharacter(
        characterStateForEffects,
        'wizard'
    );

    return effectedCharacter;
  }
  
  /**
   * Processes the raw inventory from the state, combining stackable items.
   * @param {Array<Object>} rawInventory - The inventory array from the state manager.
   * @returns {Array<Object>} The processed, final inventory.
   * @private
   */
  _processFinalInventory(rawInventory) {
    console.log("CharacterFinisher: Processing final inventory...");
    const finalInventory = [];
    const stackableMap = new Map();

    for (const itemState of rawInventory) {
      const itemDef = this.stateManager.getInventoryItemDefinition(itemState.id);
      if (!itemDef) {
        console.warn(`Could not find definition for item ${itemState.id}. Skipping.`);
        continue;
      }

      if (itemDef.stackable) {
        if (!stackableMap.has(itemState.id)) {
          stackableMap.set(itemState.id, {
            id: itemState.id,
            quantity: 0,
            equipped: true, // Assume equipped unless one part is not
            sources: new Set(),
            selections: [], // Note: Combining selections isn't defined, taking first one's for now
          });
        }
        const entry = stackableMap.get(itemState.id);
        entry.quantity += itemState.quantity;
        if (itemState.source) {
            entry.sources.add(itemState.source);
        }
        // If any instance is unequipped, the final stack is unequipped
        if (itemState.equipped === false) {
          entry.equipped = false;
        }
        // Simplistic selection merge: just overwrite.
        if (itemState.selections && itemState.selections.length > 0) {
            entry.selections = itemState.selections;
        }
      } else {
        // Non-stackable items are added directly
        finalInventory.push(itemState);
      }
    }

    // Process the collected stackable items
    for (const [itemId, combinedItem] of stackableMap.entries()) {
      finalInventory.push({
        id: itemId,
        quantity: combinedItem.quantity,
        equipped: combinedItem.equipped,
        selections: combinedItem.selections,
        source: Array.from(combinedItem.sources).join(', '),
        groupId: null // GroupID is less relevant after combination
      });
    }
    
    console.log("CharacterFinisher: Final inventory processed:", finalInventory);
    return finalInventory;
  }

  /**
   * Initiates the wizard finishing process: validates all data and saves the character.
   */
  async finishWizard() {
    console.log('CharacterFinisher.finishWizard: Attempting to finish wizard.');
    const validation = this._validateAllPages();

    if (!validation.isValid) {
      console.warn('CharacterFinisher.finishWizard: Validation failed. Showing errors.');
      this.alerter.show("Please complete the following:\n\n" + validation.message, 'error');
      return;
    }

    // Calculate final character effects (like health)
    const characterEffects = this._calculateCharacterEffects();
    console.log('CharacterFinisher.finishWizard: Character effects calculated:', characterEffects);

    // Construct the final character object to be saved
    const currentState = this.stateManager.getState();
    
    // Process the inventory before saving
    const finalInventory = this._processFinalInventory(currentState.inventory);

    const character = {
      module: currentState.module,
      destiny: currentState.destiny,
      flaws: currentState.flaws,
      perks: currentState.perks,
      attributes: currentState.attributes,
      health: {
          current: characterEffects.calculatedHealth.currentMax,
          max: characterEffects.calculatedHealth.currentMax,
          temporary: 0
      },
      inventory: finalInventory, // Use the processed inventory
      abilities: currentState.abilities,
      createdAt: new Date().toISOString(),
      info: currentState.info
    };
    console.log('CharacterFinisher.finishWizard: Character object prepared for saving:', character);

    try {
      if (this.db && typeof this.db.saveCharacter === 'function') {
        await this.db.saveCharacter(character);
        console.log('CharacterFinisher.finishWizard: Character saved successfully. Redirecting to character-selector.html');
        window.location.href = 'character-selector.html'; // Redirect on success
      } else {
        throw new Error("Database service or saveCharacter method is not available.");
      }
    } catch (err) {
      console.error('CharacterFinisher.finishWizard: Failed to save character:', err);
      this.alerter.show(`Failed to save character: ${err.message}`, 'error');
    }
  }

  /**
   * Cleans up event listeners when the component is no longer needed (e.g., if wizard is destroyed).
   */
  cleanup() {
    console.log('CharacterFinisher.cleanup: Cleaning up resources.');
    document.removeEventListener('wizard:finish', this._boundFinishHandler);
  }
}

export { CharacterFinisher };