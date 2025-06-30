// characterFinisher.js
// This module handles the final validation of the character data and the saving process.

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
   * MODIFIED: Joins errors with double newlines for better spacing.
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
      // MODIFICATION HERE: Using '\n\n' to add a blank line between entries.
      message: errors.join("\n\n")
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
    
    // 1. Categorize all selections in a single pass.
    const categorizedSelections = this._categorizeSelections(currentState.selections, allItemDefs);

    // 2. Calculate effects using the pre-categorized lists.
    const characterEffects = this._calculateCharacterEffects(categorizedSelections, currentState, allItemDefs);

    // 3. Process the pre-categorized inventory list for stacking.
    const finalInventory = this._processFinalInventory(categorizedSelections.inventory, currentState.inventory, allItemDefs);

    // 4. Assemble the final character object from the clean, categorized data.
    const character = {
      module: currentState.module,
      destiny: currentState.destiny,
      purpose: currentState.purpose,
      nurture: currentState.nurture,
      attributes: currentState.attributes,
      info: currentState.info,
      createdAt: new Date().toISOString(),
      flaws: categorizedSelections.flaws,
      perks: categorizedSelections.perks,
      abilities: categorizedSelections.abilities,
      communities: categorizedSelections.communities,
      relationships: categorizedSelections.relationships,
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

      switch (itemDef.itemType) {
        case 'flaw':
          categorized.flaws.push(sel);
          break;
        case 'perk':
          categorized.perks.push(sel);
          break;
        case 'ability':
          categorized.abilities.push(sel);
          break;
        case 'community':
          categorized.communities.push(sel);
          break;
        case 'relationship':
          categorized.relationships.push(sel);
          break;
        case 'equipment':
        case 'loot':
          categorized.inventory.push(sel);
          break;
      }
    }
    return categorized;
  }

  /**
   * @private
   */
  _calculateCharacterEffects(categorizedSelections, currentState, allItemDefs) {
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
