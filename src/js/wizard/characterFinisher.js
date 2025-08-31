// characterFinisher.js
// UPDATED: Now sets new characters as active and redirects to play.html. Success alerts removed.

import { aggregateAllAbilities } from '../abilityAggregator.js';
import { EffectHandler } from '../effectHandler.js';
import { EQUIPMENT_SLOT_CONFIG } from '../play-ui.js';

class CharacterFinisher {
  constructor(stateManager, db, alerter, pageNavigator, pages, characterId = null) {
    this.stateManager = stateManager;
    this.db = db;
    this.alerter = alerter;
    this.EffectHandler = new EffectHandler(); 
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
        const errorMessage = this.pageNavigator.getCompletionError(page, currentState);
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
      resources: [{ id: 'health', displayName: 'Health', value: 0, max: 0 }]
    };
    
    // 1. Aggregate all abilities first
    const allAbilities = aggregateAllAbilities(tempCharForEffects, data.abilities, allItemDefs);

    // 2. Process the aggregated list
    this.EffectHandler.processActiveAbilities(
        allAbilities, tempCharForEffects, data.flaws, data.perks, new Set(), 'wizard'
    );

    this._addLevelRewardsToEffects(currentState);
    const modifiedCharacter = this.EffectHandler.applyEffectsToCharacter(tempCharForEffects, 'wizard', new Set());

    const attributeBonuses = this.stateManager.getCombinedAttributeBonuses();
    const finalAttributes = { ...currentState.attributes };
    for (const attr in attributeBonuses) {
        finalAttributes[attr] = (finalAttributes[attr] || 0) + attributeBonuses[attr];
    }
    
    const finalInventory = this._processFinalInventory(categorizedSelections.inventory, currentState.inventory, allItemDefs);

    // Generate the initial equipment slots object
    const initialSlots = {};
    const slotCounts = {}; // Helper to track counts like main-hand_1, main-hand_2

    // Loop through the base configuration to build the slot object
    for (const category in EQUIPMENT_SLOT_CONFIG.categories) {
        for (const slotType of EQUIPMENT_SLOT_CONFIG.categories[category]) {
            slotCounts[slotType] = (slotCounts[slotType] || 0) + 1;
            const slotId = `${slotType}_${slotCounts[slotType]}`;
            initialSlots[slotId] = null; // Set initial slots to empty
        }
    }

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
      equipmentSlots: initialSlots,
      resources: modifiedCharacter.resources
    };
    
    console.log('CharacterFinisher.finishWizard: Character object prepared for saving/updating:', character);

    try {
      const isLevelUp = this.stateManager.get('isLevelUpMode');
      const characterId = this.stateManager.get('levelUpCharacterId');

      if (isLevelUp && characterId) {
        // --- LEVEL-UP LOGIC ---
        await this.db.updateCharacter(characterId, character);
        sessionStorage.removeItem('levelUpCharacterId');
        // No alert, just redirect.
        window.location.href = 'play.html';
      } else {
        // --- NEW CHARACTER LOGIC (UPDATED) ---
        const newCharacterId = await this.db.saveCharacter(character);
        await this.db.setActiveCharacter(newCharacterId); // Set the new character as active
        sessionStorage.removeItem('levelUpCharacterId');
        // No alert, just redirect.
        window.location.href = 'play.html'; // Redirect to the play page
      }
    } catch (err) {
      console.error('CharacterFinisher.finishWizard: Failed to save/update character:', err);
      this.alerter.show(`Failed to save character: ${err.message}`, 'error');
    }
  }

  _addLevelRewardsToEffects(currentState) {
      const sources = ['destiny', 'purpose', 'nurture'];
      const targetLevel = currentState.creationLevel;

      for (const sourceType of sources) {
          const sourceId = currentState[sourceType];
          if (!sourceId) continue;
          
          const definition = this.stateManager.getDefinitionForSource(sourceType);
          if (!definition || !Array.isArray(definition.levels)) continue;

          for (const levelData of definition.levels) {
              if (levelData.level > targetLevel) continue;
              if (!levelData.unlocks) continue;

              for (const unlock of levelData.unlocks) {
                  // Check for the new 'resources' object.
                  if (unlock.type === 'reward' && unlock.rewards?.resources) {
                    
                    // Loop through each resource in the object (e.g., health, mana).
                    for (const [resourceId, resourceValue] of Object.entries(unlock.rewards.resources)) {
                      const resourceEffect = {
                          type: 'max_resource_mod', // Use the generic effect type
                          resource: resourceId,        // The resource to modify (e.g., "mana")
                          value: resourceValue,      // The amount to add
                          itemName: unlock.id || `Level ${levelData.level} ${resourceId} Bonus`,
                          itemId: unlock.id || `${sourceId}-lvl-${levelData.level}-${resourceId}`,
                          itemType: 'passive',
                          sourceType: sourceType
                      };
                      // The EffectHandler is already an instance on 'this'
                      this.EffectHandler.activeEffects.push(resourceEffect);
                    }
                  }
              }
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
  
  _processFinalInventory(rawInventorySelections, stateInventory, allItemDefs) {
    const finalInventory = [];
    const stackableMap = new Map();
    const combinedRawInventory = [ ...stateInventory, ...rawInventorySelections ];
  
    for (const itemState of combinedRawInventory) {
      const itemDef = allItemDefs[itemState.id];
      if (!itemDef) continue;
      if (itemDef.stackable) {
        if (!stackableMap.has(itemState.id)) {
          stackableMap.set(itemState.id, { 
              id: itemState.id, 
              quantity: 0, 
              sources: new Set(),
              // Store the item type for later use.
              itemType: itemDef.itemType 
          });
        }
        const entry = stackableMap.get(itemState.id);
        entry.quantity += itemState.quantity || 1; 
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
        // Set 'equipped' based on the stored item type.
        equipped: combinedItem.itemType === 'equipment',
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