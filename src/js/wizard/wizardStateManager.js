// wizardStateManager.js
// This module manages the central state of the character creation wizard
// and provides access to all loaded game data.

class WizardStateManager {
  /**
   * @param {Object} moduleSystemData - Data for modules.
   * @param {Object} flawData - Data for flaws.
   * @param {Object} destinyData - Data for destinies.
   * @param {Object} abilityData - Data for abilities.
   * @param {Object} perkData - Data for perks.
   * @param {Object} equipmentAndLootData - Data for equipment and loot. // NEW
   */
  constructor(moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData) { // UPDATED
    // Initialize the wizard's state. This state will be updated by various handlers.
    this.state = {
      module: null,
      moduleChanged: false, // Flag to indicate if the module has been changed, triggering resets
      destiny: null,
      flaws: [], // Array of {id, selections: [], source: string, groupId: string}
      perks: [], // Array of {id, selections: [], source: string, groupId: string}
      abilities: [], // Array of {id, selections: [], source: string, groupId: string}
      attributes: {},
      inventory: [], // Array of {id, quantity: number, equipped: boolean, selections: [], source?: string, groupId?: string}
      info: { name: '', bio: '' }
    };

    // Store all loaded game data. These are read-only references.
    this.moduleSystem = moduleSystemData;
    this.flawData = flawData;
    this.destinyData = destinyData;
    this.abilityData = abilityData;
    this.perkData = perkData;
    this.equipmentAndLootData = equipmentAndLootData;

    console.log('WizardStateManager: Initialized with game data.');
  }

  /**
   * Retrieves the current state of the wizard.
   * @returns {Object} The current wizard state.
   */
  getState() {
    // Return a deep copy to prevent external modifications to the internal state object
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Updates a part of the wizard's state.
   * @param {string} key - The key of the state property to update (e.g., 'module', 'info').
   * @param {*} value - The new value for the state property.
   */
  setState(key, value) {
    if (this.state.hasOwnProperty(key)) {
      if (key === 'module') {
        const oldModule = this.state.module;
        this.state.module = value;
        // Set moduleChanged flag if the module actually changed
        this.state.moduleChanged = (oldModule !== value);
        if (this.state.moduleChanged) {
          console.log(`WizardStateManager: Module changed from ${oldModule} to ${value}. Resetting dependent state.`);
          // Reset dependent state when the module changes
          this.state.destiny = null;
          this.state.flaws = []; // Reset flaws
          this.state.perks = []; // Reset perks
          this.state.abilities = []; // Reset abilities
          this.state.attributes = {};
          this.state.inventory = []; // Reset inventory
        } else {
          console.log(`WizardStateManager: Module re-selected: ${value}. No change.`);
        }
      } else {
        this.state[key] = value;
      }
      console.log(`WizardStateManager: State updated - ${key}:`, this.state[key]);
      // Explicitly dispatch event for setState, as this method is called externally
      document.dispatchEvent(new CustomEvent('wizard:stateChange', {
        detail: {
          key: key,
          value: this.state[key],
          newState: this.getState()
        }
      }));
    } else {
      console.warn(`WizardStateManager: Attempted to set unknown state key: ${key}`);
    }
  }

  /**
   * Gets a specific property from the state.
   * @param {string} key - The key of the state property to retrieve.
   * @returns {*} The value of the state property.
   */
  get(key) {
    return this.state[key];
  }

  /**
   * Sets a specific property in the state.
   * @param {string} key - The key of the state property to set.
   * @param {*} value - The value to set.
   */
  set(key, value) {
      if (this.state.hasOwnProperty(key)) {
          this.state[key] = value;
          console.log(`WizardStateManager: Set state property '${key}' to:`, value);
          // Explicitly dispatch event for set, to ensure consistent updates
          document.dispatchEvent(new CustomEvent('wizard:stateChange', {
            detail: {
              key: key,
              value: this.state[key],
              newState: this.getState()
            }
          }));
      } else {
          console.warn(`WizardStateManager: Attempted to set non-existent state property: '${key}'`);
      }
  }

  // --- Getters for Game Data ---

  getModuleSystem() {
    return this.moduleSystem;
  }

  getModule(moduleId) {
    return this.moduleSystem[moduleId];
  }

  getFlawData() {
    return this.flawData;
  }

  getFlaw(flawId) {
    return this.flawData[flawId];
  }

  getPerkData() {
    return this.perkData;
  }

  getPerk(perkId) {
    return this.perkData[perkId];
  }

  getDestinyData() {
    return this.destinyData;
  }

  getDestiny(destinyId) {
    return this.destinyData[destinyId];
  }

  getAbilityData() {
    return this.abilityData;
  }

  /**
   * Retrieves all equipment and loot data.
   * @returns {Object} The complete equipment and loot data.
   */
  getEquipmentAndLootData() {
    return this.equipmentAndLootData;
  }

  /**
   * Retrieves a specific equipment or loot item by its ID.
   * @param {string} itemId - The ID of the item.
   * @returns {Object|null} The item data, or null if not found.
   */
  getInventoryItemDefinition(itemId) {
    return this.equipmentAndLootData[itemId] || null;
  }

  /**
   * Retrieves either an ability, a flaw, or a perk definition based on its ID and optional group ID.
   * This is used to generalize fetching details for abilities, flaws, and perks.
   * @param {string} itemId - The ID of the ability, flaw, or perk.
   * @param {string} [groupId] - The ID of the group the item belongs to (e.g., 'flaws', 'perks').
   * @returns {Object|null} The item data, or null if not found.
   */
  getAbilityOrFlawData(itemId, groupId) { // Renamed from getAbilityOrFlawData to reflect new use
    // If the groupId indicates a flaw group, try to get from flawData
    if (groupId === 'flaws' && this.flawData[itemId]) {
      // Return a copy and add a 'type' property to distinguish it
      return { ...this.flawData[itemId], type: 'flaw' };
    }
    // If the groupId indicates a perk group, try to get from perkData
    if (groupId === 'perks' && this.perkData[itemId]) {
      return { ...this.perkData[itemId], type: 'perk' };
    }
    // Otherwise, assume it's a regular ability
    if (this.abilityData[itemId]) {
      // Return a copy and add a 'type' property to distinguish it
      // If ability already has a type, keep it. Otherwise, default to 'ability'.
      return { ...this.abilityData[itemId], type: this.abilityData[itemId].type || 'ability' };
    }
    console.warn(`WizardStateManager: Item with ID '${itemId}' (Group: '${groupId}') not found in abilityData, flawData, or perkData.`);
    return null;
  }

  /**
   * Resets the moduleChanged flag after it has been handled.
   */
  resetModuleChangedFlag() {
    this.state.moduleChanged = false;
    console.log('WizardStateManager: moduleChanged flag reset.');
  }

  /**
   * Adds or updates an ability in the state, including its source and group ID.
   * When adding, it ensures only one ability from the same source and group ID is selected,
   * respecting the 'Choose N' rule if applicable.
   * @param {Object} newAbility - The ability object to add/update {id, selections: [], source: string, groupId: string}.
   */
  addOrUpdateAbility(newAbility) {
    console.log(`WizardStateManager: Adding/updating ability: ${newAbility.id} (Source: ${newAbility.source || 'N/A'}, Group: ${newAbility.groupId || 'N/A'})`);

    // Ensure newAbility has necessary properties, particularly 'groupId' and 'source'
    if (!newAbility.groupId || !newAbility.source) {
      console.error('WizardStateManager: newAbility must have groupId and source properties.', newAbility);
      return;
    }

    const destinyData = this.getDestiny(this.state.destiny);
    const groupDef = destinyData?.choiceGroups?.[newAbility.groupId];
    const maxChoices = groupDef?.maxChoices || 1; // Default to 1 if not specified

    // Find the index of an existing ability with the same unique identifier
    const existingAbilityIndex = this.state.abilities.findIndex(a => 
      a.id === newAbility.id && a.source === newAbility.source && a.groupId === newAbility.groupId
    );

    let updatedAbilities = [...this.state.abilities]; // Create a shallow copy to work with

    if (maxChoices === 1) {
      // For single-choice ability groups (radio behavior), filter out other existing abilities from the same group
      updatedAbilities = updatedAbilities.filter(ability =>
        !(ability.source === newAbility.source && ability.groupId === newAbility.groupId && ability.id !== newAbility.id)
      );
    }

    if (existingAbilityIndex !== -1) {
      // If the ability already exists, update it in the copied array
      updatedAbilities[existingAbilityIndex] = { ...updatedAbilities[existingAbilityIndex], ...newAbility };
    } else {
      // If it's a new ability, add it to the copied array
      updatedAbilities.push(newAbility);
    }

    this.state.abilities = updatedAbilities; // Assign the new array to the state property
    console.log('WizardStateManager: Current abilities state:', this.state.abilities);
    this.set('abilities', this.state.abilities); // Trigger state change event
  }

  /**
   * Updates selections for a specific ability.
   * @param {string} abilityId - The ID of the ability to update.
   * @param {string} source - The source of the ability (e.g., 'destiny').
   * @param {string} groupId - The ID of the group the ability belongs to.
   * @param {Array<Object>} newSelections - The new array of selections for that ability.
   */
  updateAbilitySelections(abilityId, source, groupId, newSelections) {
    const abilityIndex = this.state.abilities.findIndex(a => a.id === abilityId && a.source === source && a.groupId === groupId);
    if (abilityIndex !== -1) {
      this.state.abilities[abilityIndex].selections = newSelections;
      console.log(`WizardStateManager: Selections updated for ability ${abilityId} (Source: ${source}, Group: ${groupId}):`, newSelections);
      // Explicitly call set to dispatch the state change event
      this.set('abilities', this.state.abilities);
    } else {
      console.warn(`WizardStateManager: Attempted to update selections for non-existent ability: ${abilityId} (Source: ${source}, Group: ${groupId})`);
    }
  }

  /**
   * Removes an ability from the state.
   * @param {string} abilityId - The ID of the ability to remove.
   * @param {string} source - The source of the ability.
   * @param {string} groupId - The ID of the group the ability belongs to.
   */
  removeAbility(abilityId, source, groupId) {
    const originalLength = this.state.abilities.length;
    this.state.abilities = this.state.abilities.filter(a =>
      !(a.id === abilityId && a.source === source && a.groupId === groupId)
    );
    if (this.state.abilities.length < originalLength) {
      console.log(`WizardStateManager: Removed ability: ${abilityId} (Source: ${source}, Group: ${groupId})`);
      // Explicitly call set to dispatch the state change event
      this.set('abilities', this.state.abilities);
    } else {
      console.warn(`WizardStateManager: Attempted to remove non-existent ability: ${abilityId} (Source: ${source}, Group: ${groupId})`);
    }
    console.log('WizardStateManager: Current abilities state after removal:', this.state.abilities);
  }

  /**
   * Adds or updates a flaw in the state, including its source, group ID, and selections.
   * @param {Object} newFlaw - The flaw object to add/update {id, selections: [], source: string, groupId: string}.
   */
  addOrUpdateFlaw(newFlaw) {
    console.log(`WizardStateManager: Adding/updating flaw: ${newFlaw.id} (Source: ${newFlaw.source || 'N/A'}, Group: ${newFlaw.groupId || 'N/A'})`);

    const destinyData = this.getDestiny(this.state.destiny);
    const groupDef = destinyData?.choiceGroups?.[newFlaw.groupId];
    const maxChoices = groupDef?.maxChoices || 1;

    // Find the index of the flaw in the current state
    const existingFlawIndex = this.state.flaws.findIndex(f => 
      f.id === newFlaw.id && f.source === newFlaw.source && f.groupId === newFlaw.groupId
    );

    let updatedFlaws = [...this.state.flaws]; // Create a shallow copy to work with

    if (maxChoices === 1 && newFlaw.groupId) {
      // For single-choice flaw groups (radio behavior), filter out other existing flaws from the same group
      updatedFlaws = updatedFlaws.filter(flaw =>
        !(flaw.source === newFlaw.source && flaw.groupId === newFlaw.groupId && flaw.id !== newFlaw.id)
      );
    }

    if (existingFlawIndex !== -1) {
      // If the flaw already exists, update it in the copied array
      updatedFlaws[existingFlawIndex] = { ...updatedFlaws[existingFlawIndex], ...newFlaw };
    } else {
      // If it's a new flaw, add it to the copied array
      updatedFlaws.push(newFlaw);
    }

    this.state.flaws = updatedFlaws; // Assign the new array to the state property
    console.log('WizardStateManager: Current flaws state:', this.state.flaws);
    this.set('flaws', this.state.flaws); // Trigger state change event
  }

  /**
   * Updates selections for a specific flaw.
   * @param {string} flawId - The ID of the flaw to update.
   * @param {string} source - The source of the flaw (e.g., 'destiny').
   * @param {string} groupId - The ID of the group the flaw belongs to.
   * @param {Array<Object>} newSelections - The new array of selections for that flaw.
   */
  updateFlawSelections(flawId, source, groupId, newSelections) {
    const flawIndex = this.state.flaws.findIndex(f => f.id === flawId && f.source === source && f.groupId === groupId);
    if (flawIndex !== -1) {
      this.state.flaws[flawIndex].selections = newSelections;
      console.log(`WizardStateManager: Selections updated for flaw ${flawId} (Source: ${source}, Group: ${groupId}):`, newSelections);
      // Explicitly call set to dispatch the state change event
      this.set('flaws', this.state.flaws);
    } else {
      console.warn(`WizardStateManager: Attempted to update selections for non-existent flaw: ${flawId} (Source: ${source}, Group: ${groupId})`);
    }
  }

  /**
   * Removes a flaw from the state.
   * @param {string} flawId - The ID of the flaw to remove.
   * @param {string} source - The source of the flaw.
   * @param {string} groupId - The ID of the group the flaw belongs to.
   */
  removeFlaw(flawId, source, groupId) {
    const originalLength = this.state.flaws.length;
    this.state.flaws = this.state.flaws.filter(f =>
      !(f.id === flawId && f.source === source && f.groupId === groupId)
    );
    if (this.state.flaws.length < originalLength) {
      console.log(`WizardStateManager: Removed flaw: ${flawId} (Source: ${source}, Group: ${groupId})`);
      // Explicitly call set to dispatch the state change event
      this.set('flaws', this.state.flaws);
    } else {
      console.warn(`WizardStateManager: Attempted to remove non-existent flaw: ${flawId} (Source: ${source}, Group: ${groupId})`);
    }
    console.log('WizardStateManager: Current flaws state after removal:', this.state.flaws);
  }

  /**
   * Calculates the total weight (points) of all flaws that have the source 'independent-flaw'.
   * @returns {number} The sum of weights for independent flaws.
   */
  getIndependentFlawTotalWeight() {
    let totalWeight = 0;
    const independentFlaws = this.state.flaws.filter(f => f.source === 'independent-flaw');

    independentFlaws.forEach(flawState => {
      const flawDef = this.getFlaw(flawState.id);
      if (flawDef && typeof flawDef.weight === 'number') {
        totalWeight += flawDef.weight;
      } else {
        console.warn(`WizardStateManager: Flaw '${flawState.id}' (source: independent-flaw) is missing a 'weight' property or it's not a number. Not contributing to total.`);
      }
    });
    return totalWeight;
  }

  /**
   * Adds or updates a perk in the state, including its source, group ID, and selections.
   * @param {Object} newPerk - The perk object to add/update {id, selections: [], source: string, groupId: string}.
   */
  addOrUpdatePerk(newPerk) {
    console.log(`WizardStateManager: Adding/updating perk: ${newPerk.id} (Source: ${newPerk.source || 'N/A'}, Group: ${newPerk.groupId || 'N/A'})`);

    const destinyData = this.getDestiny(this.state.destiny);
    const groupDef = destinyData?.choiceGroups?.[newPerk.groupId]; // Assuming destiny might have 'perks' choice group
    const maxChoices = groupDef?.maxChoices || 1;

    // Find the index of the perk in the current state
    const existingPerkIndex = this.state.perks.findIndex(p => 
      p.id === newPerk.id && p.source === newPerk.source && p.groupId === newPerk.groupId
    );

    let updatedPerks = [...this.state.perks]; // Create a shallow copy to work with

    if (maxChoices === 1 && newPerk.groupId) {
      // For single-choice perk groups (radio behavior), filter out other existing perks from the same group
      updatedPerks = updatedPerks.filter(perk =>
        !(perk.source === newPerk.source && perk.groupId === newPerk.groupId && perk.id !== newPerk.id)
      );
    }
    
    if (existingPerkIndex !== -1) {
      // If the perk already exists, update it in the copied array
      updatedPerks[existingPerkIndex] = { ...updatedPerks[existingPerkIndex], ...newPerk };
    } else {
      // If it's a new perk, add it to the copied array
      updatedPerks.push(newPerk);
    }
    
    this.state.perks = updatedPerks; // Assign the new array to the state property
    console.log('WizardStateManager: Current perks state:', this.state.perks);
    this.set('perks', this.state.perks); // Trigger state change event
  }

  /**
   * Updates selections for a specific perk.
   * @param {string} perkId - The ID of the perk to update.
   * @param {string} source - The source of the perk.
   * @param {string} groupId - The ID of the group the perk belongs to.
   * @param {Array<Object>} newSelections - The new array of selections for that perk.
   */
  updatePerkSelections(perkId, source, groupId, newSelections) {
    const perkIndex = this.state.perks.findIndex(p => p.id === perkId && p.source === source && p.groupId === groupId);
    if (perkIndex !== -1) {
      this.state.perks[perkIndex].selections = newSelections;
      console.log(`WizardStateManager: Selections updated for perk ${perkId} (Source: ${source}, Group: ${groupId}):`, newSelections);
      this.set('perks', this.state.perks);
    } else {
      console.warn(`WizardStateManager: Attempted to update selections for non-existent perk: ${perkId} (Source: ${source}, Group: ${groupId})`);
    }
  }

  /**
   * NEW: Removes a perk from the state.
   * @param {string} perkId - The ID of the perk to remove.
   * @param {string} source - The source of the perk.
   * @param {string} groupId - The ID of the group the perk belongs to.
   */
  removePerk(perkId, source, groupId) {
    const originalLength = this.state.perks.length;
    this.state.perks = this.state.perks.filter(p =>
      !(p.id === perkId && p.source === source && p.groupId === groupId)
    );
    if (this.state.perks.length < originalLength) {
      console.log(`WizardStateManager: Removed perk: ${perkId} (Source: ${source}, Group: ${groupId})`);
      this.set('perks', this.state.perks);
    } else {
      console.warn(`WizardStateManager: Attempted to remove non-existent perk: ${perkId} (Source: ${source}, Group: ${groupId})`);
    }
    console.log('WizardStateManager: Current perks state after removal:', this.state.perks);
  }

  /**
   * Calculates the total weight (points) of all perks that have the source 'independent-perk'.
   * @returns {number} The sum of weights for independent perks.
   */
  getIndependentPerkTotalWeight() {
    let totalWeight = 0;
    const independentPerks = this.state.perks.filter(p => p.source === 'independent-perk');

    independentPerks.forEach(perkState => {
      const perkDef = this.getPerk(perkState.id);
      if (perkDef && typeof perkDef.weight === 'number') {
        totalWeight += perkDef.weight;
      } else {
        console.warn(`WizardStateManager: Perk '${perkState.id}' (source: independent-perk) is missing a 'weight' property or it's not a number. Not contributing to total.`);
      }
    });
    return totalWeight;
  }

  /**
   * NEW: Adds or updates an item in the character's inventory.
   * If the item is already in inventory, its quantity is updated.
   * If not, it's added. Selections are for items with nested options.
   * @param {Object} newItem - The item object to add/update {id: string, quantity: number, equipped: boolean, selections: []}.
   */
  addOrUpdateInventoryItem(newItem) {
    console.log(`WizardStateManager: Adding/updating inventory item: ${newItem.id}, Quantity: ${newItem.quantity || 1}, Equipped: ${newItem.equipped || false}`);

    const existingItemIndex = this.state.inventory.findIndex(item => item.id === newItem.id);

    if (existingItemIndex !== -1) {
      // Update existing item
      const currentItem = this.state.inventory[existingItemIndex];
      // If quantity is provided, update it. Otherwise, assume 1 (e.g., for equipping)
      currentItem.quantity = (newItem.quantity !== undefined) ? newItem.quantity : (currentItem.quantity || 0) + 1;
      currentItem.equipped = (newItem.equipped !== undefined) ? newItem.equipped : currentItem.equipped;
      currentItem.selections = newItem.selections || currentItem.selections; // Update selections if provided
      console.log(`WizardStateManager: Updated existing inventory item: ${newItem.id}, New Quantity: ${currentItem.quantity}`);
    } else {
      // Add new item
      this.state.inventory.push({
        id: newItem.id,
        quantity: newItem.quantity || 1, // Default quantity to 1 if not specified
        equipped: newItem.equipped || false, // Default equipped to false
        selections: newItem.selections || [] // Default selections to empty array
      });
      console.log(`WizardStateManager: Added new inventory item: ${newItem.id}`);
    }
    this.set('inventory', this.state.inventory); // Trigger state change event
  }

  /**
   * NEW: Removes an item from the character's inventory by ID.
   * @param {string} itemId - The ID of the item to remove.
   * @param {number} [quantityToRemove=1] - The number of items to remove. If quantity results in 0 or less, item is removed.
   */
  removeInventoryItem(itemId, quantityToRemove = 1) {
    const originalLength = this.state.inventory.length;
    const itemIndex = this.state.inventory.findIndex(item => item.id === itemId);

    if (itemIndex !== -1) {
      const currentItem = this.state.inventory[itemIndex];
      currentItem.quantity -= quantityToRemove;

      if (currentItem.quantity <= 0) {
        this.state.inventory.splice(itemIndex, 1); // Remove item if quantity is zero or less
        console.log(`WizardStateManager: Fully removed inventory item: ${itemId}`);
      } else {
        console.log(`WizardStateManager: Reduced quantity for inventory item: ${itemId}, New Quantity: ${currentItem.quantity}`);
      }
      this.set('inventory', this.state.inventory); // Trigger state change event
    } else {
      console.warn(`WizardStateManager: Attempted to remove non-existent inventory item: ${itemId}`);
    }
    console.log('WizardStateManager: Current inventory state after removal:', this.state.inventory);
  }
}

export { WizardStateManager };