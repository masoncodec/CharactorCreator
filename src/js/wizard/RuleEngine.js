// RuleEngine.js
// This module centralizes the validation logic to determine if an item can be selected.
// It is now fully generic and uses a context object for page-specific rules.

class RuleEngine {
  constructor(stateManager) {
    this.stateManager = stateManager;
    console.log('RuleEngine: Initialized.');
  }

  getValidationState(itemDef, source, context = null) {
    // Rule: Is the item already selected from a different source?
    const sourceConflict = this._checkSourceConflict(itemDef, source);
    if (sourceConflict.isDisabled) {
      return sourceConflict;
    }
    
    // Only check for max choices if a context is provided
    if (context) {
      // Rule: Has the max number of choices for this item's group been reached?
      const maxChoicesConflict = this._checkMaxChoices(itemDef, source, context);
      if (maxChoicesConflict.isDisabled) {
          return maxChoicesConflict;
      }
    }

    // Rule: Can the character afford this perk based on the unified point system?
    if (itemDef.itemType === 'perk' && source === 'independent-perk') {
      const perkAffordability = this._checkPerkAffordability(itemDef);
      if (perkAffordability.isDisabled) {
        return perkAffordability;
      }
    }

    // Rule: Can the character afford this equipment or loot item?
    if (source === 'equipment-and-loot') {
        const affordability = this._checkEquipmentAffordability(itemDef);
        if (affordability.isDisabled) {
            return affordability;
        }
    }
    
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

  // This method now receives the context object directly
  _checkMaxChoices(itemDef, source, context) {
    if (this.stateManager.itemManager.getSelection(itemDef.id, source)) {
      return { isDisabled: false, reason: '' };
    }
    
    // Get the group definition using the context
    if (!context || !itemDef.groupId) return { isDisabled: false, reason: '' };
    const mainDefinition = context.getDefinition();
    const groupDef = mainDefinition?.choiceGroups?.[itemDef.groupId] || null;

    if (!groupDef || !groupDef.maxChoices) return { isDisabled: false, reason: '' };

    if (groupDef.maxChoices === 1) return { isDisabled: false, reason: '' };

    // Filter by groupId in addition to source to correctly isolate selections within their specific group.
    const selectionsInGroup = this.stateManager.state.selections.filter(
        sel => sel.source === source && sel.groupId === itemDef.groupId
    );

    if (selectionsInGroup.length >= groupDef.maxChoices) {
        return {
            isDisabled: true,
            reason: `You have already selected the maximum of ${groupDef.maxChoices} item(s) from this group.`
        };
    }
    
    return { isDisabled: false, reason: '' };
  }

  _checkPerkAffordability(itemDef) {
    if (this.stateManager.itemManager.getSelection(itemDef.id, 'independent-perk')) {
        return { isDisabled: false, reason: '' };
    }
      
    const availablePoints = this.stateManager.getAvailableCharacterPoints();
    const perkCost = itemDef.weight || 0;

    if (perkCost > availablePoints) {
      return {
        isDisabled: true,
        reason: `Requires ${perkCost} points, but you only have ${availablePoints} available.`
      };
    }
    return { isDisabled: false, reason: '' };
  }

  _checkEquipmentAffordability(itemDef) {
    const { remaining } = this.stateManager.getEquipmentPointsSummary();
    const itemCost = itemDef.weight || 0;

    if (itemCost > remaining) {
      return {
        isDisabled: true,
        reason: `Requires ${itemCost} points, but only ${remaining} are available.`
      };
    }
    return { isDisabled: false, reason: '' };
  }
}

export { RuleEngine };