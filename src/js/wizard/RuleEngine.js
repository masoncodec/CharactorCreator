// RuleEngine.js
// This module centralizes the validation logic to determine if an item can be selected.
// It checks for things like point costs, source conflicts, and maxChoices limits.

class RuleEngine {
  /**
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   */
  constructor(stateManager) {
    this.stateManager = stateManager;
    console.log('RuleEngine: Initialized.');
  }

  /**
   * Evaluates an item against all relevant rules to determine its current UI state.
   * @param {Object} itemDef - The full definition of the item to validate.
   * @param {string} source - The context/source of the component rendering the item.
   * @returns {{isDisabled: boolean, reason: string}} The validation state of the item.
   */
  getValidationState(itemDef, source) {
    // Rule: Is the item already selected from a different source?
    const sourceConflict = this._checkSourceConflict(itemDef, source);
    if (sourceConflict.isDisabled) {
      return sourceConflict;
    }

    // Rule: Has the max number of choices for this item's group been reached?
    const maxChoicesConflict = this._checkMaxChoices(itemDef, source);
    if (maxChoicesConflict.isDisabled) {
        return maxChoicesConflict;
    }

    // --- REFACTOR START ---
    // Rule: Can the character afford this perk based on the unified point system?
    if (itemDef.itemType === 'perk' && source === 'independent-perk') {
      const perkAffordability = this._checkPerkAffordability(itemDef);
      if (perkAffordability.isDisabled) {
        return perkAffordability;
      }
    }
    // --- REFACTOR END ---
    
    // If no rules failed, the item is enabled.
    return { isDisabled: false, reason: '' };
  }

  _checkSourceConflict(itemDef, currentSource) {
    const selection = this.stateManager.itemManager.getSelection(itemDef.id);
    if (selection && selection.source !== currentSource) {
      const sourceName = selection.source.startsWith('independent') ? 'another page' : 'Destiny';
      return {
        isDisabled: true,
        reason: `This is already selected from ${sourceName}.`
      };
    }
    return { isDisabled: false, reason: '' };
  }

  _checkMaxChoices(itemDef, source) {
    if (this.stateManager.itemManager.getSelection(itemDef.id, source)) {
      return { isDisabled: false, reason: '' };
    }
    
    const groupDef = this._getGroupDefinition(itemDef, source);
    if (!groupDef || !groupDef.maxChoices) return { isDisabled: false, reason: '' };

    if (groupDef.maxChoices === 1) return { isDisabled: false, reason: '' };

    const selectionsInGroup = this.stateManager.state.selections.filter(
        sel => sel.source === source
    );

    if (selectionsInGroup.length >= groupDef.maxChoices) {
        return {
            isDisabled: true,
            reason: `You have already selected the maximum of ${groupDef.maxChoices} item(s) from this group.`
        };
    }
    
    return { isDisabled: false, reason: '' };
  }

  _getGroupDefinition(itemDef, source) {
      if (!source.startsWith('destiny-')) return null;
      const destinyId = this.stateManager.get('destiny');
      if (!destinyId) return null;
      const destinyDef = this.stateManager.getDestiny(destinyId);
      return destinyDef?.choiceGroups?.[itemDef.groupId] || null;
  }

  /**
   * REFACTORED: Checks if there are enough "Available Points" to afford a Perk.
   * @private
   */
  _checkPerkAffordability(itemDef) {
    // An already selected perk should never be disabled by this rule.
    if (this.stateManager.itemManager.getSelection(itemDef.id, 'independent-perk')) {
        return { isDisabled: false, reason: '' };
    }
      
    // Use the new unified point calculation method.
    const availablePoints = this.stateManager.getAvailableCharacterPoints();
    const perkCost = itemDef.weight || 0;

    // Check if the cost of the new perk exceeds the available points.
    if (perkCost > availablePoints) {
      return {
        isDisabled: true,
        reason: `Requires ${perkCost} points, but you only have ${availablePoints} available.`
      };
    }
    return { isDisabled: false, reason: '' };
  }
}

export { RuleEngine };