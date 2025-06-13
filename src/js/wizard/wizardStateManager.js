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
      flaws: [], // Array of {id, source: string}
      // abilities: Array of {id, selections: [], source: string, groupId: string} <--- Added 'groupId', removed 'tier'
      abilities: [],
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
          this.state.flaws = [];
          this.state.abilities = []; // Abilities are reset regardless of source, on module change
          this.state.attributes = {};
        } else {
          console.log(`WizardStateManager: Module re-selected: ${value}. No change.`);
        }
      } else {
        this.state[key] = value;
      }
      console.log(`WizardStateManager: State updated - ${key}:`, this.state[key]);
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

  getAbility(abilityId) {
    return this.abilityData[abilityId];
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

    // Filter out existing abilities from the same source and group.
    // This assumes that for a given source and groupId, only one selection behavior is desired.
    // If a group allows multiple choices (maxChoices > 1), we would filter differently.
    // Given 'Choose N' per group, we just replace the specific selection if it's a radio,
    // or manage a set of checkboxes. The current model for `abilities` array suggests
    // one entry per chosen ability, which is then managed.
    // For single-choice groups (radio buttons), we filter out any existing ability
    // from the same group and source to enforce "choose 1".
    const destinyData = this.getDestiny(this.state.destiny);
    const groupDef = destinyData?.abilityGroups?.[newAbility.groupId];
    const maxChoices = groupDef?.maxChoices || 1; // Default to 1 if not specified

    if (maxChoices === 1) { // This behavior implies a radio button choice
      this.state.abilities = this.state.abilities.filter(ability =>
        !(ability.source === newAbility.source && ability.groupId === newAbility.groupId)
      );
      this.state.abilities.push(newAbility);
    } else {
      // For groups allowing multiple choices (checkboxes), this `addOrUpdateAbility`
      // method would typically be called when a *specific option* is checked/unchecked,
      // not when the *parent ability* is selected. The `updateAbilitySelections`
      // method is more appropriate for managing selections within a multi-choice ability.
      // However, if `addOrUpdateAbility` is still used to initially "select" the ability
      // as a container, its implementation for maxChoices > 1 might need refinement.
      // For now, it will just add the new ability (assuming it's a new unique one for the group).
      // The `DestinyPageHandler`'s `_handleTierSelection` (now `_handleGroupSelection`)
      // will create this newAbility entry in state.
      if (!this.state.abilities.some(a => a.id === newAbility.id && a.source === newAbility.source && a.groupId === newAbility.groupId)) {
        this.state.abilities.push(newAbility);
      }
    }
    console.log('WizardStateManager: Current abilities state:', this.state.abilities);
  }

  /**
   * Updates selections for a specific ability.
   * @param {string} abilityId - The ID of the ability to update.
   * @param {string} source - The source of the ability (e.g., 'destiny').
   * @param {string} groupId - The ID of the group the ability belongs to.
   * @param {Array<Object>} newSelections - The new array of selections for that ability.
   */
  updateAbilitySelections(abilityId, source, groupId, newSelections) {
    const abilityIndex = this.state.abilities.findIndex(a => a.id === abilityId && a.source === source && a.groupId === groupId); // Use source and groupId for finding
    if (abilityIndex !== -1) {
      this.state.abilities[abilityIndex].selections = newSelections;
      console.log(`WizardStateManager: Selections updated for ability ${abilityId} (Source: ${source}, Group: ${groupId}):`, newSelections);
    } else {
      console.warn(`WizardStateManager: Attempted to update selections for non-existent ability: ${abilityId} (Source: ${source}, Group: ${groupId})`);
    }
  }

  /**
   * Adds or updates a flaw in the state.
   * @param {Object} newFlaw - The flaw object to add/update {id, source: string}.
   * @param {boolean} isDestinyFlaw - True if this is a destiny-specific flaw (only one allowed).
   */
  addOrUpdateFlaw(newFlaw, isDestinyFlaw) {
    if (isDestinyFlaw) {
      // Clear any existing destiny-specific flaws
      this.state.flaws = this.state.flaws.filter(f => f.source !== 'destiny');
    }
    // Add the new flaw if it's not already there
    // Ensure newFlaw has a 'source' property for filtering
    if (!newFlaw.source) {
        console.error('WizardStateManager: newFlaw must have a "source" property.', newFlaw);
        return;
    }
    if (!this.state.flaws.some(f => f.id === newFlaw.id && f.source === newFlaw.source)) { // UPDATED: check f.source
      this.state.flaws.push(newFlaw);
    }
    console.log('WizardStateManager: Current flaws state:', this.state.flaws);
  }
}

export { WizardStateManager };
