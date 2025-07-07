// wizardStateManager.js
// UPDATED: The ItemManager now understands the new 'unlocks' data structure.

import { alerter } from '../alerter.js';

class ItemManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.state = stateManager.state;
  }

  selectItem(itemDef, source, groupId, payload = {}) {
    const { id } = itemDef;
    const isAlreadySelected = this.state.selections.some(sel => sel.id === id && sel.source === source);

    // --- START OF FIX ---

    let groupDef = null;
    const parentDef = this.stateManager.getDefinitionForSource(source);

    // If the parent page definition is found...
    if (parentDef) {
        // ...and it's a point-buy system, look for the group inside its 'groups' object.
        if (parentDef.unlocks?.some(u => u.type === 'pointBuy')) {
            const pointBuyUnlock = parentDef.unlocks.find(u => u.type === 'pointBuy');
            groupDef = pointBuyUnlock?.groups?.[groupId];
        } else {
            // ...otherwise, look for the group in the top-level unlocks (for Choice pages).
            if (Array.isArray(parentDef.levels)) {
                for (const levelData of parentDef.levels) {
                    if (levelData.unlocks) {
                        const foundUnlock = levelData.unlocks.find(u => u.id === groupId);
                        if (foundUnlock) {
                            groupDef = foundUnlock;
                            break;
                        }
                    }
                }
            }
        }
    }
    
    // Use the maxChoices from the found group definition, NOT the item itself.
    const maxChoices = groupDef?.maxChoices;
    
    // --- END OF FIX ---


    if (isAlreadySelected) {
      if (groupId && maxChoices === 1 && ['destiny', 'purpose', 'nurture'].includes(source)) {
        return;
      }
      this.deselectItem(id, source);
      return;
    }

    if (groupId && maxChoices > 1) {
        const selectionsInGroup = this.state.selections.filter(
            sel => sel.groupId === groupId && sel.source === source
        );
        if (selectionsInGroup.length >= maxChoices) {
            alerter.show(`You may only select ${maxChoices} items from this group.`, 'error');
            return;
        }
    }

    // --- START OF FIX ---

    // This is the radio-button logic. It needs to operate on the real state array.
    if (groupId && maxChoices === 1) {
      // Find the index of an existing item from this exclusive group.
      const existingSelectionIndex = this.state.selections.findIndex(
        sel => sel.groupId === groupId && sel.source === source
      );
      // If one is found, remove it.
      if (existingSelectionIndex > -1) {
        this.state.selections.splice(existingSelectionIndex, 1);
      }
    }
    
    const newSelectionData = { 
        id: id, 
        source: source, 
        selections: [], 
        ...payload 
    };
    if (groupId) {
        newSelectionData.groupId = groupId;
    }

    // Directly push the new selection to the master state array.
    this.state.selections.push(newSelectionData);
    
    // Now, trigger the update by calling set() with the mutated state array.
    this.stateManager.set('selections', this.state.selections);

    // --- END OF FIX ---
  }

  deselectItem(itemId, source) {
    const newSelections = this.state.selections.filter(
      sel => !(sel.id === itemId && sel.source === source)
    );
    if (newSelections.length < this.state.selections.length) {
        this.stateManager.set('selections', newSelections);
        console.log(`ItemManager: Deselected item '${itemId}' from source '${source}'.`);
    }
  }

  updateSelection(itemId, source, updates) {
    const selectionIndex = this.state.selections.findIndex(sel => sel.id === itemId && sel.source === source);

    if (selectionIndex > -1) {
      const newSelections = [...this.state.selections];
      newSelections[selectionIndex] = { ...newSelections[selectionIndex], ...updates };
      
      this.stateManager.set('selections', newSelections);
      console.log(`ItemManager: Updated selection for '${itemId}' from source '${source}'.`, updates);
    }
  }
  
  updateNestedSelections(itemId, source, newNestedSelections) {
    const parentSelectionIndex = this.state.selections.findIndex(sel => sel.id === itemId && sel.source === source);
    
    if (parentSelectionIndex > -1) {
      const allSelections = JSON.parse(JSON.stringify(this.state.selections));
      allSelections[parentSelectionIndex].selections = newNestedSelections;
      this.stateManager.set('selections', allSelections);
      console.log(`ItemManager: Updated nested selections for '${itemId}':`, newNestedSelections);
    }
  }

  getSelection(itemId, source) {
    return this.state.selections.find(sel => sel.id === itemId && (!source || sel.source === source)) || null;
  }

  isItemSelected(itemId) {
    return this.state.selections.some(sel => sel.id === itemId);
  }
  
  getSelectionsByType(itemType, allItemData) {
    return this.state.selections.filter(sel => allItemData[sel.id]?.itemType === itemType);
  }

  getTotalWeightBySource(source, allItemData) {
    return this.state.selections
      .filter(sel => sel.source === source)
      .reduce((total, sel) => {
        const itemDef = allItemData[sel.id];
        return total + (itemDef?.weight || 0);
      }, 0);
  }

  /**
   * --- NEW: Checks if all selected items have their required nested options selected. ---
   * @param {Array} selectionsArray - The array of current selections to check.
   * @returns {boolean} - True if all nested option requirements are met.
   */
  hasAllNestedOptionsSelected(selectionsArray) {
    const allItemDefs = this.stateManager.getItemData();

    // .every() will stop and return false on the first item that is incomplete.
    return selectionsArray.every(selection => {
      const itemDef = allItemDefs[selection.id];
      
      // Check if the item definition exists and has options that require a choice.
      if (itemDef && Array.isArray(itemDef.options) && itemDef.options.length > 0) {
        const required = itemDef.maxChoices || 0;
        const chosen = selection.selections?.length || 0;
        
        // If a specific number of choices is required and not met, the item is incomplete.
        // If required is 0 or -1, this check is skipped.
        if (required > 0 && chosen < required) {
          return false; // This item is incomplete.
        }
      }
      
      return true; // This item is complete, or doesn't have required options.
    });
  }

  /**
   * --- NEW: Generates specific error messages for items with missing options. ---
   * @param {Array} selectionsArray - The array of current selections to check.
   * @returns {Array<string>} - A list of error messages.
   */
  getNestedOptionsCompletionErrors(selectionsArray) {
    const allItemDefs = this.stateManager.getItemData();
    const errors = [];

    for (const selection of selectionsArray) {
      const itemDef = allItemDefs[selection.id];
      
      if (itemDef && Array.isArray(itemDef.options) && itemDef.options.length > 0) {
        const required = itemDef.maxChoices || 0;
        const chosen = selection.selections?.length || 0;
        
        if (required > 0 && chosen < required) {
          const remaining = required - chosen;
          const itemLabel = remaining === 1 ? 'option' : 'options';
          errors.push(`For "${itemDef.name}", you must select ${remaining} more ${itemLabel}.`);
        }
      }
    }
    
    return errors;
  }
}


class WizardStateManager {
  constructor(moduleSystemData) {
    this.state = {
      // --- NEW: Properties to manage level-up state ---
      isLevelUpMode: false,
      levelUpCharacterId: null,
      originalLevel: 1,
      // --- End New ---
      module: null, destiny: null, purpose: null, nurture: null, selections: [], attributes: {},
      inventory: [], info: { name: '', bio: '' }, moduleChanged: false,
      creationLevel: 1, // Will be used as the target level
    };
    this.data = {
      modules: moduleSystemData || {},
      destinies: {}, purposes: {}, nurtures: {}, abilities: {}, flaws: {},
      perks: {}, equipment: {}, communities: {}, relationships: {},
      // --- NEW: Storing the new page definitions ---
      flawsAndPerksDef: {},
      equipmentAndLootDef: {},
      allItems: {}
    };
    this.itemManager = new ItemManager(this);
    console.log('WizardStateManager: Initialized with module definitions.');
  }

  /**
   * --- NEW: Populates the wizard's state from a loaded character object. ---
   */
  populateFromCharacter(characterData, characterId) {
    this.state.isLevelUpMode = true;
    this.state.levelUpCharacterId = characterId;

    this.state.module = characterData.module;
    this.state.destiny = characterData.destiny;
    this.state.purpose = characterData.purpose;
    this.state.nurture = characterData.nurture;
    this.state.selections = characterData.selections || [];
    this.state.attributes = characterData.attributes || {};
    this.state.inventory = characterData.inventory || [];
    this.state.info = characterData.info || { name: '', bio: '' };
    
    // Store the character's starting level and set the current target level to match.
    this.state.originalLevel = characterData.level || 1;
    this.state.creationLevel = characterData.level || 1; 

    console.log('WizardStateManager: State populated for level-up mode.', this.getState());
  }

  loadModuleData(loadedData) {
    console.log('WizardStateManager: Clearing old data and loading new module data.');
    
    this.data.destinies = loadedData.destinyData || {};
    this.data.purposes = loadedData.purposeData || {};
    this.data.nurtures = loadedData.nurtureData || {};
    this.data.abilities = loadedData.abilityData || {};
    this.data.flaws = loadedData.flawData || {};
    this.data.perks = loadedData.perkData || {};
    this.data.equipment = loadedData.equipmentAndLootData || {};
    this.data.communities = loadedData.communityData || {};
    this.data.relationships = loadedData.relationshipData || {};
    // --- NEW: Storing the loaded page definitions ---
    this.data.flawsAndPerksDef = loadedData.flawsAndPerksDef || {};
    this.data.equipmentAndLootDef = loadedData.equipmentAndLootDef || {};

    this.data.allItems = {};
    this._normalizeData();
    console.log('WizardStateManager: New module data loaded.');
    document.dispatchEvent(new CustomEvent('wizard:dataLoaded'));
  }

  _normalizeData() {
    const normalizeAndAdd = (collection, type) => {
      if (!collection || typeof collection !== 'object') return;
      Object.entries(collection).forEach(([id, item]) => {
        this.data.allItems[id] = { ...item, id: id, itemType: type };
      });
    };
    normalizeAndAdd(this.data.abilities, 'ability');
    normalizeAndAdd(this.data.flaws, 'flaw');
    normalizeAndAdd(this.data.perks, 'perk');
    normalizeAndAdd(this.data.communities, 'community');
    normalizeAndAdd(this.data.relationships, 'relationship');
    
    if (this.data.equipment) {
      Object.entries(this.data.equipment).forEach(([id, item]) => {
        this.data.allItems[id] = { ...item, id: id, itemType: item.type };
      });
    }
  }

  getState() { return JSON.parse(JSON.stringify(this.state)); }
  get(key) { return this.state[key]; }
  
  /**
   * --- UPDATED: Now includes logic to clean up selections when the level is decreased. ---
   */
  set(key, value) {
    if (this.state.hasOwnProperty(key)) {
      
      // --- START OF REPLACEMENT LOGIC ---
      if (key === 'creationLevel') {
        const oldLevel = this.state.creationLevel;
        const newLevel = value;
        
        // Only run this logic if the level is actually being decreased.
        if (newLevel < oldLevel) {
          console.log(`Level decreased from ${oldLevel} to ${newLevel}. Clearing selections from invalid levels.`);
          const invalidUnlockIds = new Set();
          
          // Define all page sources that can have leveled unlocks.
          const pageSources = ['destiny', 'purpose', 'nurture', 'flaws-and-perks', 'equipment-and-loot'];

          pageSources.forEach(pageKey => {
            let mainDefinition;
            // Get the correct page definition based on the page type.
            if (pageKey === 'flaws-and-perks') {
              mainDefinition = this.data.flawsAndPerksDef;
            } else if (pageKey === 'equipment-and-loot') {
              mainDefinition = this.data.equipmentAndLootDef;
            } else {
              mainDefinition = this.getDefinitionForSource(pageKey);
            }

            if (mainDefinition && mainDefinition.levels) {
              // Find all levels that are now inaccessible.
              mainDefinition.levels.forEach(levelData => {
                if (levelData.level > newLevel) {
                  // Add the ID of every unlock from that level to our set.
                  levelData.unlocks?.forEach(unlock => {
                    invalidUnlockIds.add(unlock.id);
                  });
                }
              });
            }
          });

          // If we found any invalid unlock IDs, filter the selections array.
          if (invalidUnlockIds.size > 0) {
            const originalCount = this.state.selections.length;
            // A selection is kept only if its groupId is NOT in the set of invalid unlock IDs.
            this.state.selections = this.state.selections.filter(sel => !invalidUnlockIds.has(sel.groupId));
            const removedCount = originalCount - this.state.selections.length;
            if (removedCount > 0) {
              console.log(`Removed ${removedCount} selection(s) from higher levels.`);
            }
          }
        }
      }
      // --- END OF REPLACEMENT LOGIC ---

      this.state[key] = value;
      document.dispatchEvent(new CustomEvent('wizard:stateChange', {
        detail: { key: key, value: this.state[key], newState: this.getState() }
      }));
    }
  }
  
  setState(key, value) {
    if (key === 'module') {
      const oldModule = this.state.module;
      if (oldModule !== value) {
        this.state.module = value;
        this.state.moduleChanged = true;
        this.state.destiny = null;
        this.state.purpose = null;
        this.state.nurture = null;
        this.state.selections = [];
        this.state.attributes = {};
        this.state.inventory = [];
        this.set('destiny', null);
      }
    } else {
      const sourcesToClear = {
          'destiny': 'destiny',
          'purpose': 'purpose',
          'nurture': 'nurture'
      };
      
      const sourceKey = sourcesToClear[key];
      if (sourceKey && this.state[sourceKey] !== value) {
          console.log(`WizardStateManager: ${key} changed. Clearing selections with source '${sourceKey}'.`);
          this.state.selections = this.state.selections.filter(sel => sel.source !== sourceKey);
      }
      this.set(key, value);
    }
  }
  
  resetModuleChangedFlag() { this.state.moduleChanged = false; }
  getModule(moduleId) { return this.data.modules[moduleId]; }
  getDestiny(destinyId) { return this.data.destinies[destinyId]; }
  getPurpose(purposeId) { return this.data.purposes[purposeId]; }
  getNurture(nurtureId) { return this.data.nurtures[nurtureId]; }
  getItemData() { return this.data.allItems; }
  getItemDefinition(itemId) { return this.data.allItems[itemId] || null;
  }
  /**
   * --- NEW: A generic function to calculate the state of any point pool. ---
   * @param {Object} pointBuyUnlock - The `pointBuy` unlock object from the JSON definition.
   * @returns {Object} An object like { name, current, total, id }.
   */
  getPointPoolSummary(pointBuyUnlock) {
    if (!pointBuyUnlock || !pointBuyUnlock.pointPool) {
      return { name: 'Invalid Pool', current: 0, total: 0, id: null };
    }

    const pool = pointBuyUnlock.pointPool;
    let currentPoints = pool.initialValue;
    const allItemDefs = this.getItemData();

    // Find all groups associated with this point-buy unlock
    const groupsInSystem = new Map(Object.entries(pointBuyUnlock.groups || {}));

    // Calculate spent/gained points from selections
    this.state.selections.forEach(sel => {
      // A selection belongs to this pool if its groupId is one of the groups in the system
      if (sel.groupId && groupsInSystem.has(sel.groupId)) {
        const groupData = groupsInSystem.get(sel.groupId);
        const itemDef = allItemDefs[sel.id];
        if (!itemDef) return;

        const cost = itemDef.weight || 0; // Assumes cost is always 'weight'
        const quantity = sel.quantity || 1;
        const totalCost = cost * quantity;

        if (groupData.pointModifier === 'add') {
          currentPoints += totalCost;
        } else if (groupData.pointModifier === 'subtract') {
          currentPoints -= totalCost;
        }
      }
    });

    return {
      id: pool.id,
      name: pool.name,
      current: currentPoints,
      total: pool.initialValue
    };
  }
  addOrUpdateInventoryItem(newItemData) {
    const existingItemIndex = this.state.inventory.findIndex(item => item.id === newItemData.id);
    if (newItemData.quantity <= 0) {
      if (existingItemIndex !== -1) this.state.inventory.splice(existingItemIndex, 1);
      return;
    }
    if (existingItemIndex !== -1) {
      this.state.inventory[existingItemIndex].quantity = newItemData.quantity;
    } else {
      this.state.inventory.push({ id: newItemData.id, quantity: newItemData.quantity });
    }
    this.set('inventory', this.state.inventory);
  }
  removeInventoryItem(itemId) {
    this.state.inventory = this.state.inventory.filter(item => item.id !== itemId);
    this.set('inventory', this.state.inventory);
  }

  getCombinedAttributeBonuses() {
    const attributeBonuses = {};
    const sources = ['destiny', 'purpose', 'nurture'];
    const level = this.get('creationLevel');

    for (const sourceType of sources) {
        const sourceId = this.get(sourceType);
        if (!sourceId) continue;

        const definition = this[`get${sourceType.charAt(0).toUpperCase() + sourceType.slice(1)}`](sourceId);
        // The check should be for definition.levels
        if (!definition || !Array.isArray(definition.levels)) continue;

        // Iterate through each level object (e.g., level 1, level 2)
        for (const levelData of definition.levels) {
            if (levelData.level > level) continue;

            // --- START FIX ---
            // If the level has no unlocks, skip it
            if (!levelData.unlocks || !Array.isArray(levelData.unlocks)) continue;

            // Now, iterate through the UNLOCKS within that level
            for (const unlock of levelData.unlocks) {
              // Check if this unlock is a reward AND if it has attribute bonuses
              if (unlock.type === 'reward' && unlock.rewards?.attributes) {
                
                // Sum the attribute bonuses from this unlock
                for (const attr in unlock.rewards.attributes) {
                  const value = unlock.rewards.attributes[attr];
                  if (attributeBonuses[attr]) {
                      attributeBonuses[attr] += value;
                  } else {
                      attributeBonuses[attr] = value;
                  }
                }
              }
            }
            // --- END FIX ---
        }
    }
    return attributeBonuses;
  }

  getDefinitionForSource(source) {
    const sourceId = this.get(source);
    if (!sourceId) return null;

    const getterName = `get${source.charAt(0).toUpperCase() + source.slice(1)}`;
    if (typeof this[getterName] === 'function') {
      return this[getterName](sourceId);
    }
    return null;
  }
}

export { WizardStateManager };