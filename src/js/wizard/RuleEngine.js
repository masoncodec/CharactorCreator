// RuleEngine.js
// This module centralizes the validation logic to determine if an item can be selected.
// It checks for things like point costs, source conflicts, and other dependencies.

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
   * @param {string} source - The context/source of the component rendering the item (e.g., 'independent-perk').
   * @returns {{isDisabled: boolean, reason: string}} The validation state of the item.
   */
  getValidationState(itemDef, source) {
    // A. Check for source conflicts (e.g., already selected from Destiny).
    const sourceConflict = this._checkSourceConflict(itemDef, source);
    if (sourceConflict.isDisabled) {
      return sourceConflict;
    }

    // B. Check for perk point affordability.
    if (itemDef.itemType === 'perk' && source === 'independent-perk') {
      const perkAffordability = this._checkPerkAffordability(itemDef);
      if (perkAffordability.isDisabled) {
        return perkAffordability;
      }
    }
    
    // C. Check for equipment point affordability.
    if (itemDef.itemType === 'equipment' && source === 'equipment-and-loot') {
        const equipmentAffordability = this._checkEquipmentAffordability(itemDef);
        if (equipmentAffordability.isDisabled) {
            return equipmentAffordability;
        }
    }

    // If no rules failed, the item is enabled.
    return { isDisabled: false, reason: '' };
  }

  /**
   * Rule: Checks if the item is already selected from a different source.
   * @private
   */
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

  /**
   * Rule: Checks if there are enough Flaw Points to afford a Perk.
   * @private
   */
  _checkPerkAffordability(itemDef) {
    // This rule only applies if the perk is NOT already selected.
    if (this.stateManager.itemManager.getSelection(itemDef.id, 'independent-perk')) {
        return { isDisabled: false, reason: '' }; // It's already selected, so don't disable it.
    }
      
    const availableFlawPoints = this.stateManager.getIndependentFlawTotalWeight();
    const spentPerkPoints = this.stateManager.getIndependentPerkTotalWeight();
    const perkCost = itemDef.weight || 0;

    if ((spentPerkPoints + perkCost) > availableFlawPoints) {
      return {
        isDisabled: true,
        reason: `Requires ${perkCost} Flaw Points, but you only have ${availableFlawPoints - spentPerkPoints} available.`
      };
    }
    return { isDisabled: false, reason: '' };
  }
  
  /**
   * Rule: Checks if there are enough Equipment Points to afford an item.
   * @private
   */
  _checkEquipmentAffordability(itemDef) {
    // This rule only applies if the item is NOT already selected.
    if (this.stateManager.itemManager.getSelection(itemDef.id, 'equipment-and-loot')) {
        return { isDisabled: false, reason: '' };
    }
      
    const { remaining } = this.stateManager.getEquipmentPointsSummary();
    const itemCost = itemDef.weight || 0;

    if (itemCost > remaining) {
      return {
        isDisabled: true,
        reason: `Requires ${itemCost} Equipment Points, but you only have ${remaining} left.`
      };
    }
    return { isDisabled: false, reason: '' };
  }
}

export { RuleEngine };