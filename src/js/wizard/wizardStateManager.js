// wizardStateManager.js
// This module manages the central state of the character creation wizard
// and provides access to all loaded game data.

import { alerter } from '../alerter.js';

class ItemManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.state = stateManager.state;
  }

  selectItem(itemDef, source, groupId, payload = {}) {
    const { id } = itemDef;
    const isAlreadySelected = this.state.selections.some(sel => sel.id === id && sel.source === source);

    const parentDef = {
        'destiny': this.stateManager.getDestiny(this.state.destiny),
        'purpose': this.stateManager.getPurpose(this.state.purpose),
        'nurture': this.stateManager.getNurture(this.state.nurture)
    }[source] || {};
    
    let groupDef = null;
    if (groupId && parentDef && Array.isArray(parentDef.levels)) {
        for (const levelData of parentDef.levels) {
            if (levelData.choiceGroups && levelData.choiceGroups[groupId]) {
                groupDef = levelData.choiceGroups[groupId];
                break;
            }
        }
    }

    const maxChoices = groupDef?.maxChoices ?? itemDef.maxChoices;

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

    let newSelections = [...this.state.selections];

    if (groupId && maxChoices === 1) {
      newSelections = newSelections.filter(
        sel => !(sel.groupId === groupId && sel.source === source)
      );
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

    newSelections.push(newSelectionData);
    this.stateManager.set('selections', newSelections);
    console.log(`ItemManager: Selected new item '${id}'.`, newSelectionData);
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
      perks: {}, equipment: {}, 
      communities: {}, relationships: {},
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
    this.data.allItems = {};

    this._normalizeData();
    
    console.log('WizardStateManager: New module data loaded. Item map now contains', Object.keys(this.data.allItems).length, 'items.');
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
      
      // --- NEW: Logic to remove selections from levels that are no longer accessible ---
      if (key === 'creationLevel') {
        const oldLevel = this.state.creationLevel;
        const newLevel = value;
        
        if (newLevel < oldLevel) {
          const invalidGroupIds = new Set();
          const sources = ['destiny', 'purpose', 'nurture'];

          // Find all choice group IDs from the levels that are being removed
          sources.forEach(sourceType => {
            const sourceId = this.get(sourceType);
            if (!sourceId) return;

            const definition = this[`get${sourceType.charAt(0).toUpperCase() + sourceType.slice(1)}`](sourceId);
            if (!definition || !Array.isArray(definition.levels)) return;

            definition.levels.forEach(levelData => {
              if (levelData.level > newLevel) {
                if (levelData.choiceGroups) {
                  Object.keys(levelData.choiceGroups).forEach(groupId => invalidGroupIds.add(groupId));
                }
              }
            });
          });

          // Filter the selections array, removing any item belonging to an invalid group
          if (invalidGroupIds.size > 0) {
            this.state.selections = this.state.selections.filter(sel => !invalidGroupIds.has(sel.groupId));
          }
        }
      }
      // --- END NEW ---

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
  getIndependentFlawTotalWeight() { return this.itemManager.getTotalWeightBySource('independent-flaw', this.data.allItems); }
  getIndependentPerkTotalWeight() { return this.itemManager.getTotalWeightBySource('independent-perk', this.data.allItems); }
  getAvailableCharacterPoints() {
    const flawPoints = this.getIndependentFlawTotalWeight();
    const perkPoints = this.getIndependentPerkTotalWeight();
    return flawPoints - perkPoints;
  }
  getEquipmentPointsSummary() {
    const TOTAL_POINTS = 20;
    const spentPoints = this.state.selections
      .filter(sel => sel.source === 'equipment-and-loot')
      .reduce((total, sel) => {
        const itemDef = this.data.allItems[sel.id];
        const quantity = sel.quantity || 1;
        return total + ((itemDef?.weight || 0) * quantity);
      }, 0);
    return { total: TOTAL_POINTS, spent: spentPoints, remaining: TOTAL_POINTS - spentPoints };
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
        if (!definition || !Array.isArray(definition.levels)) continue;

        for (const levelData of definition.levels) {
            if (levelData.level > level) continue;

            const rewards = levelData.rewards;
            if (!rewards || !rewards.attributes) continue;
            
            // Sum attribute bonuses
            for (const attr in rewards.attributes) {
                if (attributeBonuses[attr]) {
                    attributeBonuses[attr] += rewards.attributes[attr];
                } else {
                    attributeBonuses[attr] = rewards.attributes[attr];
                }
            }
        }
    }
    return attributeBonuses;
  }
}

export { WizardStateManager };