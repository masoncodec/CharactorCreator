// RuleEngine.js
// UPDATED: Now understands the new 'unlocks' data structure for all rule checks.

class RuleEngine {
  constructor(stateManager) {
    this.stateManager = stateManager;
    console.log('RuleEngine: Initialized.');
  }

  getValidationState(itemDef, source, context = null) {
    // --- START OF FIX ---
    
    // First, always check for source conflicts. This is unchanged.
    const sourceConflict = this._checkSourceConflict(itemDef, source);
    if (sourceConflict.isDisabled) {
      return sourceConflict;
    }
    
    // Second, ALWAYS check for maxChoices rules if the item belongs to a group.
    // This is the key change: this check is no longer inside an "if (context?.pageType === 'choice')".
    if (itemDef.groupId) {
      const maxChoicesConflict = this._checkMaxChoices(itemDef, source, context);
      if (maxChoicesConflict.isDisabled) {
        return maxChoicesConflict;
      }
    }

    // Third, if the item is part of a point-buy system, check for affordability.
    if (context?.unlock?.type === 'pointBuy') {
      const affordability = this._checkAffordability(itemDef, context.unlock);
      if (affordability.isDisabled) {
        return affordability;
      }
    }
    
    // If no rules failed, the item is valid.
    return { isDisabled: false, reason: '' };
    
    // --- END OF FIX ---
  }

  _checkSourceConflict(itemDef, currentSource) {
    const selection = this.stateManager.itemManager.getSelection(itemDef.id);
    if (selection && selection.source !== currentSource) {
      if (itemDef.stackable) {
        return { isDisabled: false, reason: '' };
      }
      const sourceName = selection.source.startsWith('independent') ? 'another page' : 'Destiny';
      return {
        isDisabled: true,
        reason: `This is already selected from ${sourceName}.`
      };
    }
    return { isDisabled: false, reason: '' };
  }

  _checkMaxChoices(itemDef, source, context) {
    // This first part is unchanged
    if (this.stateManager.itemManager.getSelection(itemDef.id, source)) {
      return { isDisabled: false, reason: '' };
    }
    if (!context || !itemDef.groupId) return { isDisabled: false, reason: '' };

    // --- START OF FIX ---

    let groupDef = null; // Use a more generic name

    // If the context tells us we're inside a point-buy unlock,
    // look for the group definition within its 'groups' property.
    if (context.unlock?.type === 'pointBuy') {
        groupDef = context.unlock.groups?.[itemDef.groupId];
    } else {
        // Otherwise, use the original logic for finding a top-level 'choice' unlock.
        const mainDefinition = context.getDefinition();
        if (mainDefinition && Array.isArray(mainDefinition.levels)) {
            for (const levelData of mainDefinition.levels) {
                if (levelData.unlocks) {
                    const foundUnlock = levelData.unlocks.find(u => u.id === itemDef.groupId);
                    if (foundUnlock) {
                        groupDef = foundUnlock;
                        break;
                    }
                }
            }
        }
    }

    // This error check now works correctly
    if (!groupDef) {
        console.error(`ERROR: Could NOT find a group/unlock definition with ID: "${itemDef.groupId}"`);
        return { isDisabled: false, reason: 'Configuration Error' }; 
    }

    // The rest of the function now uses 'groupDef' instead of 'unlockDef'
    if (!groupDef.maxChoices || groupDef.maxChoices === -1 || groupDef.maxChoices === 1) {
        return { isDisabled: false, reason: '' };
    }

    const selectionsInGroup = this.stateManager.state.selections.filter(
        sel => sel.source === source && sel.groupId === itemDef.groupId
    );

    if (selectionsInGroup.length >= groupDef.maxChoices) {
        return {
            isDisabled: true,
            reason: `You have already selected the maximum of ${groupDef.maxChoices} item(s) from this group.`
        };
    }

    // --- END OF FIX ---

    return { isDisabled: false, reason: '' };
  }

  /**
   * --- REPLACED: A single, generic method to check affordability. ---
   * It replaces all previous, specific affordability checks.
   * @param {Object} itemDef - The definition of the item being selected.
   * @param {Object} pointBuyUnlock - The pointBuy unlock object from the JSON.
   */
  _checkAffordability(itemDef, pointBuyUnlock) {
    // If it's not a stackable item and is already selected, allow deselecting it.
    if (!itemDef.stackable && this.stateManager.itemManager.isItemSelected(itemDef.id)) {
        return { isDisabled: false, reason: '' };
    }

    // Find the group this item belongs to to determine its point modifier and cost property
    let itemGroup = null;
    if (pointBuyUnlock.groups) {
        for (const group of Object.values(pointBuyUnlock.groups)) {
            if (group.items.includes(itemDef.id)) {
                itemGroup = group;
                break;
            }
        }
    }
    
    // If the item doesn't belong to a group in this system or the group adds points, it's always "affordable".
    if (!itemGroup || itemGroup.pointModifier !== 'subtract') {
        return { isDisabled: false, reason: '' };
    }

    const pointSummary = this.stateManager.getPointPoolSummary(pointBuyUnlock);
    const itemCost = itemDef.weight || 0;

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