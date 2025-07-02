// ItemSelectorComponent.js
// A reusable component to render and manage a grid of selectable items.
// REVERTED: The 'isLocked' logic has been removed as it is no longer needed.

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
  
  _getGroupDefinition(itemDef) {
    if (!this.context || !itemDef.groupId) return null;
    const mainDefinition = this.context.getDefinition();
    // This now correctly finds the groupDef within the levels array
    let groupDef = null;
    if (mainDefinition && Array.isArray(mainDefinition.levels)) {
        for (const levelData of mainDefinition.levels) {
            if (levelData.choiceGroups && levelData.choiceGroups[itemDef.groupId]) {
                groupDef = levelData.choiceGroups[itemDef.groupId];
                break;
            }
        }
    }
    return groupDef;
  }

  _createCardHTML(itemDef, selectionState, validationState) {
    const isSelected = !!selectionState;
    const isDisabled = validationState.isDisabled;
    const disabledClass = isDisabled ? 'disabled-for-selection' : '';
    const selectedClass = isSelected ? 'selected' : '';
    
    const groupDef = this._getGroupDefinition(itemDef);
    
    const maxChoices = groupDef?.maxChoices ?? itemDef.maxChoices;
    const inputType = (maxChoices === 1) ? 'radio' : 'checkbox';
    
    const inputName = groupDef ? `group-${this.source}` : `item-${itemDef.id}`;

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
              <span class="ability-name">${itemDef.name}</span>
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

  _handleClick(e) {
    // --- NEW: Prevent all clicks if the component is locked ---
    if (this.isLocked) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }
    
    const card = e.target.closest('.ability-card');
    if (!card || card.classList.contains('disabled-for-selection')) {
      return;
    }

    const itemId = card.dataset.itemId;
    const itemDef = this.items[itemId];
    if (!itemDef) return;

    // Case 1: Clicked inside an option's label.
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
      } else { // Checkbox logic
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
    if (e.target.closest('.ability-options')) {
      if (!this.stateManager.itemManager.getSelection(itemId, this.source)) {
        this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId);
      }
      return;
    }

    // Case 3: Clicked on the main card body.
    this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId);
  }

  cleanup() {
    this.container.removeEventListener('click', this._boundHandleClick);
  }
}

export { ItemSelectorComponent };