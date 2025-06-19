// wizardStateManager.js
// This module manages the central state of the character creation wizard
// and provides access to all loaded game data.

class WizardStateManager {
  /**
   * @param {Object} moduleSystemData - Data for modules.
   * @param {Object} flawData - Data for flaws.
   * @param {Object} destinyData - Data for destinies.
   * @param {Object} abilityData - Data for abilities.
   */
  constructor(moduleSystemData, flawData, destinyData, abilityData) {
    // Initialize the wizard's state. This state will be updated by various handlers.
    this.state = {
      module: null,
      moduleChanged: false, // Flag to indicate if the module has been changed, triggering resets
      destiny: null,
      // Flaws now also support 'selections' for nested options, like abilities
      flaws: [], // Array of {id, selections: [], source: string, groupId: string}
      abilities: [], // Array of {id, selections: [], source: string, groupId: string}
      attributes: {},
      info: { name: '', bio: '' }
    };

    // Store all loaded game data. These are read-only references.
    this.moduleSystem = moduleSystemData;
    this.flawData = flawData;
    this.destinyData = destinyData;
    this.abilityData = abilityData;

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
          this.state.abilities = []; // Reset abilities
          this.state.attributes = {};
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
   * Retrieves either an ability or a flaw definition based on its ID and optional group ID.
   * This is used to generalize fetching details for both abilities and flaws.
   * @param {string} itemId - The ID of the ability or flaw.
   * @param {string} [groupId] - The ID of the group the item belongs to. Used to determine if it's a flaw.
   * @returns {Object|null} The ability or flaw data, or null if not found.
   */
  getAbilityOrFlawData(itemId, groupId) {
    // If the groupId indicates a flaw group, try to get from flawData
    if (groupId === 'flaws' && this.flawData[itemId]) {
      // Return a copy and add a 'type' property to distinguish it
      return { ...this.flawData[itemId], type: 'flaw' };
    }
    // Otherwise, assume it's a regular ability
    if (this.abilityData[itemId]) {
      // Return a copy and add a 'type' property to distinguish it
      // If ability already has a type, keep it. Otherwise, default to 'ability'.
      return { ...this.abilityData[itemId], type: this.abilityData[itemId].type || 'ability' };
    }
    console.warn(`WizardStateManager: Item with ID '${itemId}' (Group: '${groupId}') not found in abilityData or flawData.`);
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
    const groupDef = destinyData?.abilityGroups?.[newAbility.groupId];
    const maxChoices = groupDef?.maxChoices || 1; // Default to 1 if not specified

    // Remove any existing selection from this group if it's a single-choice group (radio behavior)
    if (maxChoices === 1) {
      this.state.abilities = this.state.abilities.filter(ability =>
        !(ability.source === newAbility.source && ability.groupId === newAbility.groupId)
      );
    }
    
    // Add the new ability if it's not already present by its unique identifier (id, source, groupId)
    if (!this.state.abilities.some(a => a.id === newAbility.id && a.source === newAbility.source && a.groupId === newAbility.groupId)) {
        this.state.abilities.push(newAbility);
    }

    console.log('WizardStateManager: Current abilities state:', this.state.abilities);
    // Explicitly call set to dispatch the state change event
    this.set('abilities', this.state.abilities);
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
    const groupDef = destinyData?.abilityGroups?.[newFlaw.groupId];
    const maxChoices = groupDef?.maxChoices || 1; // Default to 1 if not specified

    // For single-choice flaw groups (radio behavior), filter out existing flaw from the same group
    if (maxChoices === 1 && newFlaw.groupId) { // Only apply this logic if it's a grouped flaw
      this.state.flaws = this.state.flaws.filter(flaw =>
        !(flaw.source === newFlaw.source && flaw.groupId === newFlaw.groupId)
      );
    }

    // Add the new flaw if it's not already present by its unique identifier (id, source, groupId)
    // Note: For independent flaws, groupId will be null, so we filter by id and source
    if (!this.state.flaws.some(f => f.id === newFlaw.id && f.source === newFlaw.source && f.groupId === newFlaw.groupId)) {
      this.state.flaws.push(newFlaw);
    }
    console.log('WizardStateManager: Current flaws state:', this.state.flaws);
    // Explicitly call set to dispatch the state change event
    this.set('flaws', this.state.flaws);
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
}

export { WizardStateManager };
