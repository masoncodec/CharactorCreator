// RuleEngine.js
// FINAL VERSION: Includes all rules for standard choices, point-buy systems, and special cases.

class RuleEngine {
  constructor(stateManager) {
    this.stateManager = stateManager;
    console.log('RuleEngine: Initialized.');
  }

  getValidationState(itemDef, source, context = null) {
    // --- Rule order is important. We check for the most restrictive rules first. ---
    
    // 1. Check if this item is already selected from a different, incompatible source.
    const sourceConflict = this._checkSourceConflict(itemDef, source);
    if (sourceConflict.isDisabled) {
      return sourceConflict;
    }
    
    // 2. If on a standard choice page, check for max choices.
    if (context && !context.pageDef?.pointPool) { // Check if NOT a point-buy page
      const maxChoicesConflict = this._checkMaxChoices(itemDef, source, context);
      if (maxChoicesConflict.isDisabled) {
          return maxChoicesConflict;
      }
    }

    // 3. NEW: If on a standard choice page, limit stackable items to a quantity of 1.
    if (context && !context.pageDef?.pointPool) { // Check if NOT a point-buy page
        const stackableLimit = this._checkStackableLimit(itemDef, source);
        if (stackableLimit.isDisabled) {
            return stackableLimit;
        }
    }

    // 4. If on a point-buy page, check for affordability.
    if (context && context.pageDef && context.pageDef.pointPool) {
      const affordability = this._checkAffordability(itemDef, context);
      if (affordability.isDisabled) {
        return affordability;
      }
    }
    
    return { isDisabled: false, reason: '' };
  }

  /**
   * --- UPDATED: Now allows stackable items to be selected from multiple sources. ---
   */
  _checkSourceConflict(itemDef, currentSource) {
    const selection = this.stateManager.itemManager.getSelection(itemDef.id);
    
    // If the item is already selected...
    if (selection && selection.source !== currentSource) {
      
      // ...but the item is stackable, it's allowed.
      if (itemDef.stackable) {
        return { isDisabled: false, reason: '' };
      }
      
      // ...and it's NOT stackable, it's a conflict.
      const sourceName = selection.source.startsWith('independent') ? 'another page' : 'Destiny';
      return {
        isDisabled: true,
        reason: `This is already selected from ${sourceName}.`
      };
    }
    return { isDisabled: false, reason: '' };
  }

  _checkMaxChoices(itemDef, source, context) {
    // This method remains correct from our previous updates.
    if (this.stateManager.itemManager.getSelection(itemDef.id, source)) {
      return { isDisabled: false, reason: '' };
    }
    if (!context || !itemDef.groupId) return { isDisabled: false, reason: '' };
    const mainDefinition = context.getDefinition();
    let groupDef = null;
    if (mainDefinition && Array.isArray(mainDefinition.levels)) {
        for (const levelData of mainDefinition.levels) {
            const groupsContainer = levelData.choiceGroups || levelData.groups;
            if (groupsContainer && groupsContainer[itemDef.groupId]) {
                groupDef = groupsContainer[itemDef.groupId];
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

  _checkAffordability(itemDef, context) {
    // This method remains correct from our previous updates.
    if (!itemDef.stackable && this.stateManager.itemManager.isItemSelected(itemDef.id)) {
        return { isDisabled: false, reason: '' };
    }
    const { pageDef } = context;
    if (!pageDef || !pageDef.pointPool) return { isDisabled: false, reason: '' };
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
    if (!itemGroup || itemGroup.pointModifier !== 'subtract') {
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

  /**
   * --- NEW: A rule to limit stackable items to a quantity of 1 on non-point-buy pages. ---
   */
  _checkStackableLimit(itemDef, source) {
    // If the item isn't stackable, this rule doesn't apply.
    if (!itemDef.stackable) {
        return { isDisabled: false, reason: '' };
    }

    const selection = this.stateManager.itemManager.getSelection(itemDef.id, source);

    // If the item is already selected from this source and has a quantity of 1 or more...
    if (selection && selection.quantity >= 1) {
        return {
            isDisabled: true,
            reason: 'You can only select a quantity of 1 for this item here.'
        };
    }

    return { isDisabled: false, reason: '' };
  }
}

export { RuleEngine };