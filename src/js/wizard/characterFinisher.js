// characterFinisher.js
// FINAL VERSION: Includes corrected logic for processing inventory from multiple sources.

class CharacterFinisher {
  constructor(stateManager, db, alerter, EffectHandler, pageNavigator, pages, characterId = null) {
    this.stateManager = stateManager;
    this.db = db;
    this.alerter = alerter;
    this.EffectHandler = EffectHandler;
    this.pageNavigator = pageNavigator;
    this.pages = pages;
    this.characterId = characterId;

    this._boundFinishHandler = this.finishWizard.bind(this);
    document.addEventListener('wizard:finish', this._boundFinishHandler);

    console.log('CharacterFinisher: Initialized (Refactored).');
  }

  _validateAllPages() {
    console.log('CharacterFinisher._validateAllPages: Running centralized validation via PageNavigator.');
    const errors = [];
    const currentState = this.stateManager.getState();
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
    
    const finalSelections = currentState.selections;
    const categorizedSelections = this._categorizeSelections(finalSelections, allItemDefs);
    
    const tempCharForEffects = {
        ...categorizedSelections,
        health: { max: this._getBaseHealth(currentState) }
    };
    
    this.EffectHandler.processActiveAbilities(
        tempCharForEffects, data.abilities, data.flaws, data.perks, new Set(), 'wizard'
    );
    this._addLevelRewardsToEffects(currentState);
    const modifiedCharacter = this.EffectHandler.applyEffectsToCharacter(tempCharForEffects, 'wizard');

    const attributeBonuses = this.stateManager.getCombinedAttributeBonuses();
    const finalAttributes = { ...currentState.attributes };
    for (const attr in attributeBonuses) {
        finalAttributes[attr] = (finalAttributes[attr] || 0) + attributeBonuses[attr];
    }
    
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
      flaws: categorizedSelections.flaws,
      perks: categorizedSelections.perks,
      abilities: categorizedSelections.abilities,
      communities: categorizedSelections.communities,
      relationships: categorizedSelections.relationships,
      inventory: finalInventory,
      health: {
        current: modifiedCharacter.calculatedHealth.currentMax,
        max: modifiedCharacter.calculatedHealth.currentMax,
        temporary: 0
      },
    };
    
    console.log('CharacterFinisher.finishWizard: Character object prepared for saving/updating:', character);

    try {
      const isLevelUp = this.stateManager.get('isLevelUpMode');
      const characterId = this.stateManager.get('levelUpCharacterId');

      if (isLevelUp && characterId) {
        await this.db.updateCharacter(characterId, character);
        sessionStorage.removeItem('levelUpCharacterId');
        window.location.href = 'play.html';
      } else {
        await this.db.saveCharacter(character);
        sessionStorage.removeItem('levelUpCharacterId');
        window.location.href = 'character-selector.html';
      }
    } catch (err) {
      console.error('CharacterFinisher.finishWizard: Failed to save/update character:', err);
      this.alerter.show(`Failed to save character: ${err.message}`, 'error');
    }
  }

  _getBaseHealth(currentState) {
      const destinyId = currentState.destiny;
      if (!destinyId) return 0;
      const destinyDef = this.stateManager.getDestiny(destinyId);
      return destinyDef?.health?.value || 0;
  }

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

  _categorizeSelections(selections, allItemDefs) {
    const categorized = {
      flaws: [], perks: [], abilities: [], communities: [], relationships: [], inventory: [],
    };
    for (const sel of selections) {
      const itemDef = allItemDefs[sel.id];
      if (!itemDef) continue;
      const cleanedSel = { ...sel };
      if (Array.isArray(cleanedSel.selections) && cleanedSel.selections.length === 0) {
        delete cleanedSel.selections;
      }
      switch (itemDef.itemType) {
        case 'flaw': categorized.flaws.push(cleanedSel); break;
        case 'perk': categorized.perks.push(cleanedSel); break;
        case 'ability': categorized.abilities.push(cleanedSel); break;
        case 'community': categorized.communities.push(cleanedSel); break;
        case 'relationship': categorized.relationships.push(cleanedSel); break;
        case 'equipment': case 'loot': categorized.inventory.push(cleanedSel); break;
      }
    }
    return categorized;
  }

  /**
   * --- UPDATED: Correctly processes items with existing compound source strings. ---
   */
  _processFinalInventory(rawInventorySelections, stateInventory, allItemDefs) {
    const finalInventory = [];
    const stackableMap = new Map();
    const combinedRawInventory = [ ...stateInventory, ...rawInventorySelections ];
    for (const itemState of combinedRawInventory) {
      const itemDef = allItemDefs[itemState.id];
      if (!itemDef) continue;
      if (itemDef.stackable) {
        if (!stackableMap.has(itemState.id)) {
          stackableMap.set(itemState.id, { id: itemState.id, quantity: 0, sources: new Set() });
        }
        const entry = stackableMap.get(itemState.id);
        entry.quantity += itemState.quantity || 1; 
        
        // --- FIX: Split existing source strings before adding to the Set ---
        if (itemState.source) {
            const sourcesToAdd = String(itemState.source).split(', ');
            sourcesToAdd.forEach(s => entry.sources.add(s.trim()));
        }
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