// characterFinisher.js
// This module handles the final validation of the character data and the saving process.
// UPDATED: Now uses the EffectHandler as the source of truth for stat calculations.

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
   * Performs final validation by iterating through all pages.
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
        errors.push(`${errorMessage}`);
      }
    }

    return {
      isValid: errors.length === 0,
      message: errors.join("\n\n")
    };
  }
  
  /**
   * --- REWRITTEN: Uses EffectHandler to calculate final stats. ---
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
    const data = this.stateManager.data;
    
    // 1. Prepare a temporary character object for the EffectHandler
    const categorizedSelections = this._categorizeSelections(currentState.selections, allItemDefs);
    const tempCharForEffects = {
        ...categorizedSelections,
        health: { max: this._getBaseHealth(currentState) }
    };
    
    // 2. Process all effects from abilities, perks, and flaws
    this.EffectHandler.processActiveAbilities(
        tempCharForEffects,
        data.abilities, data.flaws, data.perks,
        new Set(), // No active abilities are toggled in the wizard
        'wizard'
    );
    
    // 3. Convert level-up rewards into standard effect objects and add them
    this._addLevelRewardsToEffects(currentState);
    
    // 4. Apply all compiled effects
    const modifiedCharacter = this.EffectHandler.applyEffectsToCharacter(tempCharForEffects, 'wizard');

    // 5. Combine base attributes with level-up bonuses
    const attributeBonuses = this.stateManager.getCombinedAttributeBonuses();
    const finalAttributes = { ...currentState.attributes };
    for (const attr in attributeBonuses) {
        finalAttributes[attr] = (finalAttributes[attr] || 0) + attributeBonuses[attr];
    }
    
    // 6. Assemble the final character object
    const finalInventory = this._processFinalInventory(categorizedSelections.inventory, currentState.inventory, allItemDefs);
    const character = {
      module: currentState.module,
      level: currentState.creationLevel,
      destiny: currentState.destiny,
      purpose: currentState.purpose,
      nurture: currentState.nurture,
      attributes: finalAttributes,
      info: currentState.info,
      createdAt: new Date().toISOString(),
      ...categorizedSelections,
      inventory: finalInventory,
      health: {
        current: modifiedCharacter.calculatedHealth.currentMax,
        max: modifiedCharacter.calculatedHealth.currentMax,
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
   * --- NEW HELPER: Gets base health from the Destiny definition. ---
   */
  _getBaseHealth(currentState) {
      const destinyId = currentState.destiny;
      if (!destinyId) return 0;
      const destinyDef = this.stateManager.getDestiny(destinyId);
      return destinyDef?.health?.value || 0;
  }

  /**
   * --- NEW HELPER: Converts level rewards into effects for the EffectHandler. ---
   */
  _addLevelRewardsToEffects(currentState) {
      const sources = ['destiny', 'purpose', 'nurture'];
      const level = currentState.creationLevel;

      for (const sourceType of sources) {
          const sourceId = currentState[sourceType];
          if (!sourceId) continue;
          
          const definition = this.stateManager[`get${sourceType.charAt(0).toUpperCase() + sourceType.slice(1)}`](sourceId);
          if (!definition || !Array.isArray(definition.levels)) continue;

          for (const levelData of definition.levels) {
              if (levelData.level > level) continue;
              if (!levelData.rewards || !levelData.rewards.health) continue;

              const healthEffect = {
                  type: 'max_health_mod',
                  value: levelData.rewards.health,
                  itemName: `Level ${levelData.level} Bonus`,
                  itemId: `${sourceId}-lvl-${levelData.level}`,
                  itemType: 'passive',
                  sourceType: 'level'
              };
              this.EffectHandler.activeEffects.push(healthEffect);
          }
      }
  }

  /**
   * Centralized helper to sort all selections into their respective categories.
   * @param {Array} selections - The character's current selections.
   * @param {Object} allItemDefs - A map of all item definitions.
   * @returns {Object} An object containing arrays of categorized selections.
   * @private
   */
  _categorizeSelections(selections, allItemDefs) {
    const categorized = {
      flaws: [],
      perks: [],
      abilities: [],
      communities: [],
      relationships: [],
      inventory: [],
    };

    for (const sel of selections) {
      const itemDef = allItemDefs[sel.id];
      if (!itemDef) continue;

      const cleanedSel = { ...sel };
      if (Array.isArray(cleanedSel.selections) && cleanedSel.selections.length === 0) {
        delete cleanedSel.selections;
      }

      switch (itemDef.itemType) {
        case 'flaw':
          categorized.flaws.push(cleanedSel);
          break;
        case 'perk':
          categorized.perks.push(cleanedSel);
          break;
        case 'ability':
          categorized.abilities.push(cleanedSel);
          break;
        case 'community':
          categorized.communities.push(cleanedSel);
          break;
        case 'relationship':
          categorized.relationships.push(cleanedSel);
          break;
        case 'equipment':
        case 'loot':
          categorized.inventory.push(cleanedSel);
          break;
      }
    }
    return categorized;
  }

  /**
   * @private
   */
  _calculateCharacterEffects(categorizedSelections, currentState, allItemDefs) {
    // This method is now only used by the original finishWizard logic.
    // The new logic calls EffectHandler.processActiveAbilities directly.
    // We are leaving this here to avoid breaking dependencies if it's called elsewhere,
    // but the primary health calculation now happens in the main finishWizard method.
    const { abilities, flaws, perks } = categorizedSelections;
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

  /**
   * @private
   */
  _processFinalInventory(rawInventorySelections, stateInventory, allItemDefs) {
    const finalInventory = [];
    const stackableMap = new Map();
    
    const combinedRawInventory = [
        ...stateInventory,
        ...rawInventorySelections
    ];

    for (const itemState of combinedRawInventory) {
      const itemDef = allItemDefs[itemState.id];
      if (!itemDef) continue;
      if (itemDef.stackable) {
        if (!stackableMap.has(itemState.id)) {
          stackableMap.set(itemState.id, { id: itemState.id, quantity: 0, sources: new Set() });
        }
        const entry = stackableMap.get(itemState.id);
        entry.quantity += itemState.quantity || 1; 
        if (itemState.source) entry.sources.add(itemState.source);
      } else {
        finalInventory.push(itemState);
      }
    }
    for (const [, combinedItem] of stackableMap.entries()) {
      finalInventory.push({
        id: combinedItem.id,
        quantity: combinedItem.quantity,
        equipped: true,
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