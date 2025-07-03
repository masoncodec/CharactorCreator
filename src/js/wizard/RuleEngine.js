// RuleEngine.js
// UPDATED: Now uses a generic affordability check for any point-buy system.

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
    
    // This check for standard choice groups remains the same.
    if (context && context.pageType === 'choice') {
      const maxChoicesConflict = this._checkMaxChoices(itemDef, source, context);
      if (maxChoicesConflict.isDisabled) {
          return maxChoicesConflict;
      }
    }

    // --- NEW: Generic check for any point-buy system ---
    // The context will provide the page definition for point-buy pages.
    if (context && context.pageDef && context.pageDef.pointPool) {
      const affordability = this._checkAffordability(itemDef, context);
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

    if (!groupDef || !groupDef.maxChoices || groupDef.maxChoices === -1) {
        return { isDisabled: false, reason: '' };
    }
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

  /**
   * --- NEW: A generic method to check affordability against any point pool. ---
   * It replaces _checkPerkAffordability and _checkEquipmentAffordability.
   * @param {Object} itemDef - The definition of the item being selected.
   * @param {Object} context - The context object, which must contain the pageDef.
   */
  _checkAffordability(itemDef, context) {
    if (this.stateManager.itemManager.isItemSelected(itemDef.id)) {
      return { isDisabled: false, reason: '' };
    }

    const { pageDef } = context;
    if (!pageDef || !pageDef.pointPool) return { isDisabled: false, reason: '' };

    // Find the group this item belongs to in order to get the cost property and modifier.
    let itemGroup = null;
    for (const level of pageDef.levels) {
        if (level.groups) {
            for (const group of Object.values(level.groups)) {
                if (group.items.includes(itemDef.id)) {
                    itemGroup = group;
                    break;
                }
            }
        }
        if (itemGroup) break;
    }

    if (!itemGroup) return { isDisabled: false, reason: '' };

    // We only check affordability for items that subtract points.
    if (itemGroup.pointModifier !== 'subtract') {
        return { isDisabled: false, reason: '' };
    }

    const pointSummary = this.stateManager.getPointPoolSummary(pageDef);
    const itemCost = itemDef[itemGroup.costProperty || 'weight'] || 0;

    if (itemCost > pointSummary.current) {
      return {
        isDisabled: true,
        reason: `Requires ${itemCost} ${pointSummary.name}, but you only have ${pointSummary.current} available.`
      };
    }
    
    return { isDisabled: false, reason: '' };
  }
}

export { RuleEngine };