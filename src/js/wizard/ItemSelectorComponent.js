// ItemSelectorComponent.js
// FINAL VERSION: Correctly finds group definitions within the new 'unlocks' structure.

class ItemSelectorComponent {
  constructor(containerElement, itemsToRender, source, stateManager, ruleEngine, context = null) {
    this.container = containerElement;
    this.items = itemsToRender;
    this.source = source;
    this.stateManager = stateManager;
    this.ruleEngine = ruleEngine;
    this.context = context;
    this._boundHandleClick = this._handleClick.bind(this);
    this._attachEventListeners();
    console.log(`ItemSelectorComponent: Initialized for source '${this.source}'.`);
  }

  render() {
    if (!this.container) return;
    let allCardsHtml = '';
    for (const itemId in this.items) {
      const itemDef = this.items[itemId];
      const selectionState = this.stateManager.itemManager.getSelection(itemDef.id, this.source);
      const validationState = this.ruleEngine.getValidationState(itemDef, this.source, this.context);
      allCardsHtml += this._createCardHTML(itemDef, selectionState, validationState);
    }
    this.container.innerHTML = allCardsHtml || '<p>No items available for this section.</p>';
  }

  _attachEventListeners() {
    this.container.addEventListener('click', this._boundHandleClick);
  }
  
  /**
   * --- REPLACED: Now correctly finds the unlock definition from the new data structure. ---
   */
  _getGroupDefinition(itemDef) {
    if (!this.context || !itemDef.groupId) return null;
    
    // The getDefinition function will return the full page definition (e.g., Destiny object).
    const mainDefinition = this.context.getDefinition();
    if (!mainDefinition || !Array.isArray(mainDefinition.levels)) return null;

    let unlockDef = null;
    // Search through all unlocks across all levels to find the one that matches our groupId.
    for (const levelData of mainDefinition.levels) {
        if (levelData.unlocks) {
            // The item's groupId is the unlock's id.
            const foundUnlock = levelData.unlocks.find(u => u.id === itemDef.groupId);
            if (foundUnlock) {
                unlockDef = foundUnlock;
                break;
            }
        }
    }
    return unlockDef;
  }

  /**
   * REFACTORED: The card's HTML now includes a quantity display if the item
   * definition from the unlock specifies a quantity.
   */
  _createCardHTML(itemDef, selectionState, validationState) {
    const isSelected = !!selectionState;
    const isDisabled = validationState.isDisabled;
    const disabledClass = isDisabled ? 'disabled-for-selection' : '';
    const selectedClass = isSelected ? 'selected' : '';
    
    const unlockDef = this._getGroupDefinition(itemDef);
    const maxChoices = unlockDef?.maxChoices ?? itemDef.maxChoices;
    const inputType = (maxChoices === 1) ? 'radio' : 'checkbox';
    const inputName = unlockDef ? `group-${this.source}-${unlockDef.id}` : `item-${itemDef.id}`;

    // --- START: NEW LOGIC ---
    // Check if the item definition has a quantity from the unlock rules.
    // If so, create the text to display it (e.g., "(x2000)").
    const quantityDisplay = itemDef.quantity ? ` (x${itemDef.quantity})` : '';
    // --- END: NEW LOGIC ---

    return `
      <div class="item-container">
        <div class="ability-card ${selectedClass} ${disabledClass}" 
             data-item-id="${itemDef.id}"
             title="${validationState.reason}">
          <div class="ability-header">
            <label>
              <input type="${inputType}" name="${inputName}"
                data-action="select-parent"
                ${isSelected ? 'checked' : ''}
                ${isDisabled ? 'disabled' : ''}>
              
              <span class="ability-name">${itemDef.name}${quantityDisplay}</span>

            </label>
            <div class="ability-types">
              <span class="type-tag">${itemDef.itemType} (${itemDef.weight || 0})</span>
            </div>
          </div>
          <div class="ability-description">${itemDef.description}</div>
          ${itemDef.options ? this._createOptionsHTML(itemDef, selectionState) : ''}
        </div>
      </div>
    `;
  }

  _createOptionsHTML(parentItemDef, parentSelectionState) {
    const isParentSelected = !!parentSelectionState;
    const currentSelections = parentSelectionState?.selections || [];
    const inputType = (parentItemDef.maxChoices === 1) ? 'radio' : 'checkbox';
    const uniqueName = `nested-options-${parentItemDef.id}-${this.source}-${Math.random()}`;
    const limitReached = parentItemDef.maxChoices > 1 && currentSelections.length >= parentItemDef.maxChoices;

    return `
      <div class="ability-options">
        <p>Choose ${parentItemDef.maxChoices || 'any'}:</p>
        ${parentItemDef.options.map(option => {
          const isChecked = currentSelections.includes(option.id);
          const isDisabled = !isParentSelected || (limitReached && !isChecked);

          return `
            <label class="ability-option">
              <input type="${inputType}" name="${uniqueName}" value="${option.id}"
                     data-action="select-option"
                     ${isChecked ? 'checked' : ''}
                     ${isDisabled ? 'disabled' : ''}>
              <span class="option-visual"></span>
              <span class="option-text-content">${option.name}</span>
            </label>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * REFACTORED: When an item is selected, this now checks if it has a
   * predefined quantity and includes it in the payload sent to the state manager.
   */
  _handleClick(e) {
    const card = e.target.closest('.ability-card');
    if (!card || card.classList.contains('disabled-for-selection')) {
      return;
    }

    const itemId = card.dataset.itemId;
    const itemDef = this.items[itemId];
    if (!itemDef) return;

    // Case 1: Clicked inside an option's label.
    // This logic remains unchanged as it handles nested options, not the parent item.
    const optionLabel = e.target.closest('.ability-option');
    if (optionLabel) {
      const optionInput = optionLabel.querySelector('input[data-action="select-option"]');
      if (!optionInput) return;
      const parentSelection = this.stateManager.itemManager.getSelection(itemId, this.source);
      const isParentSelected = !!parentSelection;
      if (isParentSelected && optionInput.disabled) {
          return;
      }
      e.preventDefault(); 
      const clickedOptionValue = optionInput.value;
      const currentNestedSelections = parentSelection?.selections || [];
      const isRadio = itemDef.maxChoices === 1;
      let nextNestedSelections;
      if (isRadio) {
        nextNestedSelections = [clickedOptionValue];
      } else {
        const isAlreadySelected = currentNestedSelections.includes(clickedOptionValue);
        if (isAlreadySelected) {
          nextNestedSelections = currentNestedSelections.filter(id => id !== clickedOptionValue);
        } else {
          nextNestedSelections = [...currentNestedSelections, clickedOptionValue];
        }
      }
      if (!isParentSelected) {
        const payload = { selections: nextNestedSelections };
        this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId, payload);
      } else {
        this.stateManager.itemManager.updateNestedSelections(itemId, this.source, nextNestedSelections);
      }
      return;
    }

    // Case 2: Clicked in the options box padding.
    // This logic remains unchanged.
    if (e.target.closest('.ability-options')) {
      if (!this.stateManager.itemManager.getSelection(itemId, this.source)) {
        this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId);
      }
      return;
    }

    // --- START: MODIFIED LOGIC ---
    // Case 3: Clicked on the main card body.
    // We now construct a payload object that may contain the predefined quantity.
    const payload = {};
    if (itemDef.quantity) {
      payload.quantity = itemDef.quantity;
    }

    // The payload is passed to the item manager. The existing selectItem method
    // already knows how to handle this.
    this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId, payload);
    // --- END: MODIFIED LOGIC ---
  }

  cleanup() {
    this.container.removeEventListener('click', this._boundHandleClick);
  }
}

export { ItemSelectorComponent };