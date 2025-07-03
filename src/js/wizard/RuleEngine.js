// RuleEngine.js
// UPDATED: Now understands the new 'unlocks' data structure for all rule checks.

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
    
    // This check now works correctly for pages using the 'unlocks' format.
    if (context?.pageType === 'choice') { 
      const maxChoicesConflict = this._checkMaxChoices(itemDef, source, context);
      if (maxChoicesConflict.isDisabled) {
          return maxChoicesConflict;
      }
    }

    if (context?.unlock?.type === 'pointBuy') {
      const affordability = this._checkAffordability(itemDef, context.unlock);
      if (affordability.isDisabled) {
        return affordability;
      }
    }
    
    return { isDisabled: false, reason: '' };
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
    if (this.stateManager.itemManager.getSelection(itemDef.id, source)) {
      return { isDisabled: false, reason: '' };
    }
    if (!context || !itemDef.groupId) return { isDisabled: false, reason: '' };

    // --- START DEBUGGING ---
    console.log(`--- Checking Max Choices for item: "${itemDef.id}" in group: "${itemDef.groupId}" ---`);
    // --- END DEBUGGING ---

    const mainDefinition = context.getDefinition();
    let unlockDef = null;
    if (mainDefinition && Array.isArray(mainDefinition.levels)) {
        for (const levelData of mainDefinition.levels) {
            if (levelData.unlocks) {
                const foundUnlock = levelData.unlocks.find(u => u.id === itemDef.groupId);
                if (foundUnlock) {
                    unlockDef = foundUnlock;
                    break;
                }
            }
        }
    }

    // --- START DEBUGGING ---
    if (unlockDef) {
        console.log(`Found matching unlock definition. ID: "${unlockDef.id}", maxChoices: ${unlockDef.maxChoices}`);
    } else {
        console.error(`ERROR: Could NOT find an unlock definition with ID: "${itemDef.groupId}"`);
        return { isDisabled: false, reason: 'Configuration Error' }; // Exit early if no unlock is found
    }
    // --- END DEBUGGING ---

    if (!unlockDef.maxChoices || unlockDef.maxChoices === -1 || unlockDef.maxChoices === 1) {
        return { isDisabled: false, reason: '' };
    }

    const selectionsInGroup = this.stateManager.state.selections.filter(
        sel => sel.source === source && sel.groupId === itemDef.groupId
    );

    // --- START DEBUGGING ---
    console.log(`Found ${selectionsInGroup.length} item(s) already selected in this group.`);
    // --- END DEBUGGING ---

    if (selectionsInGroup.length >= unlockDef.maxChoices) {
        return {
            isDisabled: true,
            reason: `You have already selected the maximum of ${unlockDef.maxChoices} item(s) from this group.`
        };
    }
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