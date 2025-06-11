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
            // Validate exactly one 'destiny' flaw
            const selectedDestinyFlaws = currentState.flaws.filter(f => f.destiny === true);
            if (selectedDestinyFlaws.length !== 1) {
                errors.push("• Please select exactly one Flaw for your character from the Destiny page.");
                console.log('  - Validation error: Destiny flaw not selected or multiple selected.');
            }
  
            // Validate ability selections and their options
            const destiny = this.stateManager.getDestiny(currentState.destiny);
            if (destiny) {
              const tiers = [...new Set(destiny.levelUnlocks.map(u => u.level))];
              tiers.forEach(tier => {
                  const tierAbilities = destiny.levelUnlocks.filter(u => u.level === tier).map(u => u.ability);
                  const selectedAbilityInTier = currentState.abilities.find(a => tierAbilities.includes(a.id));
                  if (!selectedAbilityInTier) {
                      errors.push(`• Please select an Ability for Tier ${tier}.`);
                      console.log(`  - Validation error: No ability selected for Tier ${tier}.`);
                  } else {
                      const abilityDef = this.stateManager.getAbility(selectedAbilityInTier.id);
                      if (abilityDef && abilityDef.options && abilityDef.maxChoices !== undefined && abilityDef.maxChoices !== null) {
                          if (selectedAbilityInTier.selections.length !== abilityDef.maxChoices) {
                              errors.push(`• Please select exactly ${abilityDef.maxChoices} option(s) for the ability "${abilityDef.name}".`);
                              console.log(`  - Validation error: Incorrect number of options for ability "${abilityDef.name}".`);
                          }
                      }
                  }
              });
            } else {
                errors.push("• Destiny data missing, cannot validate abilities.");
                console.error("CharacterFinisher: Destiny data is null when validating abilities.");
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
  
      // Validate Info (name)
      if (!currentState.info.name?.trim()) {
        errors.push("• Please enter a Character Name.");
        console.log('  - Validation error: Character name is empty.');
      }
  
      return {
        isValid: errors.length === 0,
        message: errors.join("\n")
      };
    }
  
    /**
     * Calculates the character's effects based on selected abilities and flaws.
     * @returns {Object} An object representing the character's calculated state (e.g., health).
     * @private
     */
    _calculateCharacterEffects() {
      const currentState = this.stateManager.getState();
      const destinyData = this.stateManager.getDestinyData();
      const abilityData = this.stateManager.getAbilityData();
      const flawData = this.stateManager.getFlawData();
  
      // Re-create the activeAbilityStates Set as expected by EffectHandler.processActiveAbilities
      // This is crucial for fixing the "undefined is not an object (evaluating 'activeAbilityStates.has')" error.
      const activeAbilityStates = new Set(
          currentState.abilities
              .filter(a => abilityData[a.id]?.type === 'active')
              .map(a => a.id)
      );
  
      // Prepare character state for EffectHandler
      const characterStateForEffects = {
          abilities: currentState.abilities,
          flaws: currentState.flaws,
          destiny: currentState.destiny,
          // Provide initial health from destiny data for calculation
          health: { max: destinyData[currentState.destiny].health.value }
      };
  
      // Use EffectHandler to process active abilities, now correctly passing activeAbilityStates
      this.EffectHandler.processActiveAbilities(
          characterStateForEffects,
          abilityData,
          flawData,
          activeAbilityStates, // <--- This argument is now correctly passed
          'wizard' // Pass 'wizard' context if EffectHandler uses it for logging/behavior
      );
  
      // Apply effects to a dummy character object to get the calculated health
      const effectedCharacter = this.EffectHandler.applyEffectsToCharacter(
          characterStateForEffects,
          'wizard' // Context for applyEffectsToCharacter
      );
  
      return effectedCharacter;
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
      const character = {
        module: currentState.module,
        destiny: currentState.destiny,
        flaws: currentState.flaws, // Store the entire flaws array
        attributes: currentState.attributes,
        health: {
            current: characterEffects.calculatedHealth.currentMax,
            max: characterEffects.calculatedHealth.currentMax,
            temporary: 0
        },
        inventory: [], // Assuming empty for now
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
  