// wizardStateManager.js
// This module manages the central state of the character creation wizard
// and provides access to all loaded game data.

class ItemManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.state = stateManager.state;
  }

  // --- REFACTOR START ---
  // This is the definitive, refactored logic for item selection, based on the
  // confirmed rule that only grouped, single-choice items are non-toggleable.
  selectItem(itemDef, source, groupId) {
    const { id } = itemDef;
    const isAlreadySelected = this.state.selections.some(sel => sel.id === id && sel.source === source);

    const destiny = this.stateManager.getDestiny(this.state.destiny);
    const groupDef = groupId ? destiny?.choiceGroups?.[groupId] : null; //
    const maxChoices = groupDef?.maxChoices ?? itemDef.maxChoices;

    // --- Step 1: Handle all clicks on previously selected items. ---
    if (isAlreadySelected) {
      // Case A: The item is a true, grouped, single-choice radio button.
      // Per the confirmed rule, we do nothing to preserve the selection.
      if (groupId && maxChoices === 1) { //
        console.log(`ItemManager: Ignoring re-selection of true radio item '${id}'.`);
        return;
      }
      
      // Case B: The item is any other type of selected item (independent flaw/perk,
      // multi-select grouped item). A click means DESELECT.
      this.deselectItem(id, source);
      return;
    }

    // --- Step 2: Handle all new selections. ---
    // If we've reached this point, the item was not previously selected.
    let newSelections = [...this.state.selections];

    // If selecting within a radio group, first deselect the existing item.
    if (groupId && maxChoices === 1) { //
      newSelections = newSelections.filter(
        sel => !(sel.groupId === groupId && sel.source === source)
      );
    }
    
    // Add the newly selected item to the array.
    newSelections.push({ id: id, source: source, groupId: groupId, selections: [] });
    this.stateManager.set('selections', newSelections);
    console.log(`ItemManager: Selected new item '${id}'.`);
  }
  // --- REFACTOR END ---

  deselectItem(itemId, source) {
    const newSelections = this.state.selections.filter(
      sel => !(sel.id === itemId && sel.source === source)
    );
    if (newSelections.length < this.state.selections.length) {
        this.stateManager.set('selections', newSelections);
        console.log(`ItemManager: Deselected item '${itemId}' from source '${source}'.`);
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
  constructor(moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData) {
    this.state = {
      module: null, destiny: null, selections: [], attributes: {},
      inventory: [], info: { name: '', bio: '' }, moduleChanged: false,
    };
    this.data = {
      modules: moduleSystemData || {}, destinies: destinyData || {}, abilities: abilityData || {},
      flaws: flawData || {}, perks: perkData || {}, equipment: equipmentAndLootData || {}, allItems: {}
    };
    const normalizeAndAdd = (collection, type) => {
      if (!collection || typeof collection !== 'object') return;
      Object.entries(collection).forEach(([id, item]) => {
        this.data.allItems[id] = { ...item, id: id, itemType: type };
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
    this.itemManager = new ItemManager(this);
    console.log('WizardStateManager: Initialized. Item map now contains', Object.keys(this.data.allItems).length, 'items.');
  }

  getState() { return JSON.parse(JSON.stringify(this.state)); }
  get(key) { return this.state[key]; }
  set(key, value) {
    if (this.state.hasOwnProperty(key)) {
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
        this.state.module = value; this.state.moduleChanged = true;
        this.state.destiny = null; this.state.selections = [];
        this.state.attributes = {}; this.state.inventory = [];
        this.set('destiny', null);
      }
    } else { this.set(key, value); }
  }
  resetModuleChangedFlag() { this.state.moduleChanged = false; }
  getModule(moduleId) { return this.data.modules[moduleId]; }
  getDestiny(destinyId) { return this.data.destinies[destinyId]; }
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
    const spentPoints = this.itemManager.getTotalWeightBySource('equipment-and-loot', this.data.equipment);
    return { total: TOTAL_POINTS, spent: spentPoints, remaining: TOTAL_POINTS - spentPoints, };
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
}

export { WizardStateManager };