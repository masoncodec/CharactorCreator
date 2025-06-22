// characterFinisher.js
// This module handles the final validation of the character data
// and the saving process.

class CharacterFinisher {
  /**
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   * @param {Object} db - The database instance for saving characters (e.g., Firestore).
   * @param {Object} alerter - The alerter utility for displaying messages.
   * @param {EffectHandler} EffectHandler - The EffectHandler module for calculating character effects.
   */
  constructor(stateManager, db, alerter, EffectHandler) {
    this.stateManager = stateManager;
    this.db = db;
    this.alerter = alerter;
    this.EffectHandler = EffectHandler; // Assuming EffectHandler is a class or object with static methods

    // Listen for the custom event dispatched by PageNavigator when 'Finish' is clicked
    document.removeEventListener('wizard:finish', this._boundFinishHandler); // Remove previous listener
    this._boundFinishHandler = this.finishWizard.bind(this);
    document.addEventListener('wizard:finish', this._boundFinishHandler);

    console.log('CharacterFinisher: Initialized.');
  }

  /**
   * Performs the final validation of the entire wizard state.
   * @returns {{isValid: boolean, message: string}} Validation result and message.
   * @private
   */
  _validateAllPages() {
    console.log('CharacterFinisher._validateAllPages: Running final validation across all pages.');
    const errors = [];
    const currentState = this.stateManager.getState(); // Get the complete current state

    // Validate Module selection
    if (!currentState.module) {
      errors.push("• Please select a Module.");
      console.log('  - Validation error: Module not selected.');
    } else {
      // Validate Destiny selection (only if module is selected)
      if (!currentState.destiny) {
        errors.push("• Please select a Destiny.");
        console.log('  - Validation error: Destiny not selected.');
      } else {
          // Validate choice groups and their selections
          const destiny = this.stateManager.getDestiny(currentState.destiny);
          if (destiny && destiny.choiceGroups) {
            Object.entries(destiny.choiceGroups).forEach(([groupId, groupDef]) => {
                const isFlawGroup = groupId === 'flaws';
                const isPerkGroup = groupId === 'perks'; // Check for perk group
                
                let selectedItemsInGroup;
                if (isFlawGroup) {
                    selectedItemsInGroup = currentState.flaws.filter(f => f.groupId === groupId && f.source === 'destiny');
                } else if (isPerkGroup) {
                    selectedItemsInGroup = currentState.perks.filter(p => p.groupId === groupId && p.source === 'destiny');
                } else {
                    selectedItemsInGroup = currentState.abilities.filter(a => a.groupId === groupId && a.source === 'destiny');
                }

                if (selectedItemsInGroup.length !== groupDef.maxChoices) {
                    const itemTypeString = isFlawGroup ? 'flaw' : (isPerkGroup ? 'perk' : 'abilit');
                    errors.push(`• For "${groupDef.name}" Choice Group, please select exactly ${groupDef.maxChoices} ${itemTypeString}${groupDef.maxChoices === 1 ? '' : 'ies'}.`);
                    console.log(`  - Validation error: Incorrect number of ${itemTypeString}${groupDef.maxChoices === 1 ? '' : 'ies'} selected for group "${groupDef.name}".`);
                }

                // Validate nested options for each selected item in the group
                selectedItemsInGroup.forEach(itemState => {
                    const itemDef = this.stateManager.getAbilityOrFlawData(itemState.id, itemState.groupId); // Use unified getter
                    if (itemDef && itemDef.options && itemDef.maxChoices !== undefined && itemDef.maxChoices !== null) {
                        if (itemState.selections.length !== itemDef.maxChoices) {
                            errors.push(`• Please select exactly ${itemDef.maxChoices} option(s) for the ${itemDef.type} "${itemDef.name}".`);
                            console.log(`  - Validation error: Incorrect number of options for nested ${itemDef.type} "${itemDef.name}".`);
                        }
                    }
                });
            });
          } else {
              errors.push("• Destiny data or choice groups missing, cannot validate abilities/flaws/perks.");
              console.error("CharacterFinisher: Destiny data or choice groups are null when validating abilities/flaws/perks.");
          }
      }

      // Validate Attributes (only if module is selected)
      const moduleData = this.stateManager.getModule(currentState.module);
      if (moduleData && moduleData.attributes) {
          const requiredAttrs = moduleData.attributes;
          const missingAttrs = requiredAttrs.filter(attr =>
            !currentState.attributes[attr.toLowerCase()]
          );

          if (missingAttrs.length > 0) {
            errors.push(`• Assign dice to: ${missingAttrs.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', ')}`);
            console.log('  - Validation error: Missing attribute assignments:', missingAttrs);
          }
      } else {
          // This case should ideally not happen if module selection is validated prior
          errors.push("• Module data missing, cannot validate attributes.");
          console.error("CharacterFinisher: Module data is null when validating attributes.");
      }
    }

    // Validate Perk Points vs. Flaw Points
    const totalFlawPoints = this.stateManager.getIndependentFlawTotalWeight();
    const totalPerkPoints = this.stateManager.getIndependentPerkTotalWeight();
    if (totalPerkPoints > totalFlawPoints) {
      errors.push(`• Your total Perk Points (${totalPerkPoints}) exceed your total Flaw Points (${totalFlawPoints}). Please adjust your selections.`);
      console.log('  - Validation error: Perk points exceed flaw points.');
    }

    // Validate Info (name)
    if (!currentState.info.name?.trim()) {
      errors.push("• Please enter a Character Name.");
      console.log('  - Validation error: Character name is empty.');
    }

    // No validation for inventory currently as per user's request.

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