// ItemSelectorComponent.js
// A reusable component to render and manage a grid of selectable items.
// This version includes the definitive fix for the double-click bug.

class ItemSelectorComponent {
  constructor(containerElement, itemsToRender, source, stateManager, ruleEngine) {
    this.container = containerElement;
    this.items = itemsToRender;
    this.source = source;
    this.stateManager = stateManager;
    this.ruleEngine = ruleEngine;
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
      const validationState = this.ruleEngine.getValidationState(itemDef, this.source);
      allCardsHtml += this._createCardHTML(itemDef, selectionState, validationState);
    }
    this.container.innerHTML = allCardsHtml || '<p>No items available for this section.</p>';
  }

  _attachEventListeners() {
    this.container.addEventListener('click', this._boundHandleClick);
  }

  _createCardHTML(itemDef, selectionState, validationState) {
    const isSelected = !!selectionState;
    const isDisabled = validationState.isDisabled;
    const disabledClass = isDisabled ? 'disabled-for-selection' : '';
    const selectedClass = isSelected ? 'selected' : '';
    const groupDef = this._getGroupDefinition(itemDef);
    const maxChoices = groupDef?.maxChoices ?? itemDef.maxChoices;
    const inputType = (maxChoices === 1) ? 'radio' : 'checkbox';
    const inputName = `group-${this.source}`;

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

  // Implements the "Controlled Component" pattern and correctly identifies the
  // user's intent by looking for a click within the parent '.ability-option' label.
  _handleClick(e) {
    const card = e.target.closest('.ability-card');
    if (!card || card.classList.contains('disabled-for-selection')) {
      return;
    }

    const itemId = card.dataset.itemId;
    const itemDef = this.items[itemId];
    if (!itemDef) return;

    // Case 1: The click happened inside an option's label.
    const optionLabel = e.target.closest('.ability-option');
    if (optionLabel) {
      // Find the input within the clicked label to ensure we have the right target.
      const optionInput = optionLabel.querySelector('input[data-action="select-option"]');
      if (!optionInput) return;

      e.preventDefault(); // Take full manual control of the input's state.

      const clickedOptionValue = optionInput.value;
      const parentSelection = this.stateManager.itemManager.getSelection(itemId, this.source);
      const isParentSelected = !!parentSelection;
      const currentNestedSelections = parentSelection?.selections || [];

      // Manually calculate the next state of the nested selections array.
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

      // Commit the newly calculated state.
      if (!isParentSelected) {
        const payload = { selections: nextNestedSelections };
        this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId, payload);
      } else {
        this.stateManager.itemManager.updateNestedSelections(itemId, this.source, nextNestedSelections);
      }
      return;
    }

    // Case 2: The click was in the options box PADDING (but not on an option label).
    if (e.target.closest('.ability-options')) {
      // "Sticky select": Select the parent if it's not already selected, but do not deselect.
      if (!this.stateManager.itemManager.getSelection(itemId, this.source)) {
        this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId);
      }
      return;
    }

    // Case 3: The click was on the main card body (outside the options box).
    // Standard toggle (select/deselect) behavior.
    this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId);
  }
  // --- REFACTOR END ---

  _getGroupDefinition(itemDef) {
    if (!this.source.startsWith('destiny-')) return null;
    const destinyId = this.stateManager.get('destiny');
    if (!destinyId) return null;
    const destinyDef = this.stateManager.getDestiny(destinyId);
    return destinyDef?.choiceGroups?.[itemDef.groupId] || null;
  }

  cleanup() {
    this.container.removeEventListener('click', this._boundHandleClick);
  }
}

export { ItemSelectorComponent };