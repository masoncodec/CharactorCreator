// RuleEngine.js
// This module centralizes the validation logic to determine if an item can be selected.
// It is now fully generic and uses a context object for page-specific rules.

class RuleEngine {
  constructor(stateManager) {
    this.stateManager = stateManager;
    console.log('RuleEngine: Initialized.');
  }

  getValidationState(itemDef, source, context = null) {
    const sourceConflict = this._checkSourceConflict(itemDef, source);
    if (sourceConflict.isDisabled) {
      return sourceConflict;
    }
    
    if (context) {
      const maxChoicesConflict = this._checkMaxChoices(itemDef, source, context);
      if (maxChoicesConflict.isDisabled) {
          return maxChoicesConflict;
      }
    }

    if (itemDef.itemType === 'perk' && source === 'independent-perk') {
      const perkAffordability = this._checkPerkAffordability(itemDef);
      if (perkAffordability.isDisabled) {
        return perkAffordability;
      }
    }

    if (source === 'equipment-and-loot') {
        const affordability = this._checkEquipmentAffordability(itemDef);
        if (affordability.isDisabled) {
            return affordability;
        }
    }
    
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

  /**
   * --- REPLACED: Logic to find the group definition within the new 'levels' structure. ---
   */
  _checkMaxChoices(itemDef, source, context) {
    if (this.stateManager.itemManager.getSelection(itemDef.id, source)) {
      return { isDisabled: false, reason: '' };
    }
    
    if (!context || !itemDef.groupId) return { isDisabled: false, reason: '' };
    
    const mainDefinition = context.getDefinition();
    let groupDef = null;
    if (mainDefinition && Array.isArray(mainDefinition.levels)) {
        for (const levelData of mainDefinition.levels) {
            if (levelData.choiceGroups && levelData.choiceGroups[itemDef.groupId]) {
                groupDef = levelData.choiceGroups[itemDef.groupId];
                break;
            }
        }
    }

    if (!groupDef || !groupDef.maxChoices) return { isDisabled: false, reason: '' };

    if (groupDef.maxChoices === 1) return { isDisabled: false, reason: '' };

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