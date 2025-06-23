// wizardStateManager.js
// This module manages the central state of the character creation wizard
// and provides access to all loaded game data.

/**
 * @private
 * ItemManager class encapsulates the logic for managing all selectable items
 * (abilities, flaws, perks, etc.) in a unified way.
 */
class ItemManager {
  /**
   * THE FIX IS HERE: The ItemManager now takes the whole stateManager instance
   * so it can call the `set` method, which is crucial for dispatching state change events.
   */
  constructor(stateManager) {
    this.stateManager = stateManager;
    // Keep a direct reference to the state object for reading.
    this.state = stateManager.state;
  }

  /**
   * REFACTORED: This method now correctly triggers a state update.
   */
  selectItem(itemDef, source, groupId) {
    const { id, maxChoices } = itemDef;
    let newSelections = [...this.state.selections];

    if (maxChoices === 1 && groupId) {
      newSelections = newSelections.filter(
        sel => !(sel.groupId === groupId && sel.source === source)
      );
    }

    // Avoid duplicating an item from the same source.
    if (!newSelections.some(sel => sel.id === id && sel.source === source)) {
        newSelections.push({
          id: id,
          source: source,
          groupId: groupId,
          selections: []
        });
    }
    
    // Use the stateManager's `set` method to ensure the change event is dispatched.
    this.stateManager.set('selections', newSelections);
    console.log(`ItemManager: Selected item '${id}' from source '${source}'.`);
  }

  /**
   * REFACTORED: This method now correctly triggers a state update.
   */
  deselectItem(itemId, source) {
    const newSelections = this.state.selections.filter(
      sel => !(sel.id === itemId && sel.source === source)
    );
    
    if (newSelections.length < this.state.selections.length) {
        this.stateManager.set('selections', newSelections);
        console.log(`ItemManager: Deselected item '${itemId}' from source '${source}'.`);
    }
  }
  
  /**
   * REFACTORED: This method now correctly triggers a state update.
   */
  updateNestedSelections(itemId, source, newNestedSelections) {
    const parentSelectionIndex = this.state.selections.findIndex(sel => sel.id === itemId && sel.source === source);
    
    if (parentSelectionIndex > -1) {
      const allSelections = [...this.state.selections];
      allSelections[parentSelectionIndex].selections = newNestedSelections;
      this.stateManager.set('selections', allSelections);
      console.log(`ItemManager: Updated nested selections for '${itemId}':`, newNestedSelections);
    }
  }

  /**
   * Retrieves a specific selection from the state.
   */
  getSelection(itemId, source) {
    return this.state.selections.find(sel => 
      sel.id === itemId && (!source || sel.source === source)
    ) || null;
  }

  /**
   * Checks if an item is selected, regardless of its source.
   */
  isItemSelected(itemId) {
    return this.state.selections.some(sel => sel.id === itemId);
  }
  
  //... other ItemManager methods are unchanged ...
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
  constructor(moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData) {
    this.state = {
      module: null,
      destiny: null,
      selections: [],
      attributes: {},
      inventory: [],
      info: { name: '', bio: '' },
      moduleChanged: false,
    };

    this.data = {
      modules: moduleSystemData || {},
      destinies: destinyData || {},
      abilities: abilityData || {},
      flaws: flawData || {},
      perks: perkData || {},
      equipment: equipmentAndLootData || {},
      allItems: {}
    };
    
    const normalizeAndAdd = (itemCollection, itemType) => {
        if (!itemCollection || typeof itemCollection !== 'object') {
            console.warn(`Data normalization skipped for ${itemType}: data is not a valid object.`);
            return;
        }
        Object.entries(itemCollection).forEach(([id, item]) => {
            this.data.allItems[id] = { ...item, id: id, itemType: itemType };
        });
    };
    
    normalizeAndAdd(this.data.abilities, 'ability');
    normalizeAndAdd(this.data.flaws, 'flaw');
    normalizeAndAdd(this.data.perks, 'perk');
    
    if (this.data.equipment) {
        Object.entries(this.data.equipment).forEach(([id, item]) => {
          this.data.allItems[id] = { ...item, id: id, itemType: item.type };
        });
    }
    
    // Pass the entire state manager instance to the ItemManager
    this.itemManager = new ItemManager(this);

    console.log('WizardStateManager: Initialized. Item map now contains', Object.keys(this.data.allItems).length, 'items.');
  }

  // --- Core State Management ---

  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  get(key) {
    return this.state[key];
  }

  // This `set` method is the key: it dispatches the event that the UI listens for.
  set(key, value) {
      if (this.state.hasOwnProperty(key)) {
          this.state[key] = value;
          document.dispatchEvent(new CustomEvent('wizard:stateChange', {
            detail: { key: key, value: this.state[key], newState: this.getState() }
          }));
      } else {
          console.warn(`WizardStateManager: Attempted to set non-existent state property: '${key}'`);
      }
  }

  setState(key, value) {
    if (key === 'module') {
      const oldModule = this.state.module;
      if (oldModule !== value) {
        this.state.module = value;
        this.state.moduleChanged = true;
        this.state.destiny = null;
        this.state.selections = [];
        this.state.attributes = {};
        this.state.inventory = [];
        // Use the main `set` method for destiny to ensure event fires
        this.set('destiny', null);
      }
    } else {
      this.set(key, value);
    }
  }
  
  // ... rest of the WizardStateManager is unchanged ...
  resetModuleChangedFlag() {
    this.state.moduleChanged = false;
  }
  getModule(moduleId) {
    return this.data.modules[moduleId];
  }
  getDestiny(destinyId) {
    return this.data.destinies[destinyId];
  }
  getItemData() {
      return this.data.allItems;
  }
  getItemDefinition(itemId) {
    return this.data.allItems[itemId] || null;
  }
  getFlawData() {
    return this.data.flaws;
  }
  getPerkData() {
    return this.data.perks;
  }
  getEquipmentAndLootData() {
    return this.data.equipment;
  }
  getIndependentFlawTotalWeight() {
    return this.itemManager.getTotalWeightBySource('independent-flaw', this.data.flaws);
  }
  getIndependentPerkTotalWeight() {
    return this.itemManager.getTotalWeightBySource('independent-perk', this.data.perks);
  }
  getEquipmentPointsSummary() {
    const TOTAL_POINTS = 20;
    const spentPoints = this.itemManager.getTotalWeightBySource('equipment-and-loot', this.data.equipment);
    return {
      total: TOTAL_POINTS,
      spent: spentPoints,
      remaining: TOTAL_POINTS - spentPoints,
    };
  }
  addOrUpdateInventoryItem(newItemData) {
      const existingItemIndex = this.state.inventory.findIndex(item => item.id === newItemData.id);
      if (newItemData.quantity <= 0) {
          if(existingItemIndex !== -1) this.state.inventory.splice(existingItemIndex, 1);
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
}

export { WizardStateManager };
