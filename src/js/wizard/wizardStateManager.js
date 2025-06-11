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
      flaws: [], // Array of {id, destiny: boolean}
      abilities: [], // Array of {id, selections: [], tier: number, source: string}
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
          this.state.abilities = [];
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
   * Adds or updates an ability in the state, including its source.
   * Ensures only one ability per tier per source is selected (if applicable).
   * @param {Object} newAbility - The ability object to add/update {id, tier, selections, source}.
   */
  addOrUpdateAbility(newAbility) {
    console.log(`WizardStateManager: Adding/updating ability: ${newAbility.id} for Tier ${newAbility.tier} (Source: ${newAbility.source || 'N/A'})`);

    // Filter out any existing ability from the same tier AND the same source
    this.state.abilities = this.state.abilities.filter(ability =>
      !(ability.tier === newAbility.tier && ability.source === newAbility.source)
    );
    // Add the new ability
    this.state.abilities.push(newAbility);
    console.log('WizardStateManager: Current abilities state:', this.state.abilities);
  }

  /**
   * Updates selections for a specific ability.
   * @param {string} abilityId - The ID of the ability to update.
   * @param {Array<Object>} newSelections - The new array of selections for that ability.
   */
  updateAbilitySelections(abilityId, newSelections) {
    const abilityIndex = this.state.abilities.findIndex(a => a.id === abilityId);
    if (abilityIndex !== -1) {
      this.state.abilities[abilityIndex].selections = newSelections;
      console.log(`WizardStateManager: Selections updated for ability ${abilityId}:`, newSelections);
    } else {
      console.warn(`WizardStateManager: Attempted to update selections for non-existent ability: ${abilityId}`);
    }
  }

  /**
   * Adds or updates a flaw in the state.
   * @param {Object} newFlaw - The flaw object to add/update {id, destiny: boolean}.
   * @param {boolean} isDestinyFlaw - True if this is a destiny-specific flaw (only one allowed).
   */
  addOrUpdateFlaw(newFlaw, isDestinyFlaw) {
    if (isDestinyFlaw) {
      // Clear any existing destiny-specific flaws
      this.state.flaws = this.state.flaws.filter(f => !f.destiny);
    }
    // Add the new flaw if it's not already there
    if (!this.state.flaws.some(f => f.id === newFlaw.id && f.destiny === newFlaw.destiny)) {
      this.state.flaws.push(newFlaw);
    }
    console.log('WizardStateManager: Current flaws state:', this.state.flaws);
  }
}

export { WizardStateManager };
