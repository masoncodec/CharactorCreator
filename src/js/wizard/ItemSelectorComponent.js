// ItemSelectorComponent.js
// A reusable component to render and manage a grid of selectable items.
// This version includes corrected logic for sub-option maxChoices.

class ItemSelectorComponent {
  constructor(containerElement, itemsToRender, source, stateManager, ruleEngine) {
    this.container = containerElement;
    this.items = itemsToRender;
    this.source = source;
    this.stateManager = stateManager;
    this.ruleEngine = ruleEngine;
    this._boundHandleClick = this._handleClick.bind(this);
    this._boundHandleStateChange = this._onStateChange.bind(this);
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
    document.addEventListener('wizard:stateChange', this._boundHandleStateChange);
  }

  _onStateChange() {
    this.render();
  }

  _createCardHTML(itemDef, selectionState, validationState) {
    const isSelected = !!selectionState;
    const isDisabled = validationState.isDisabled;
    const disabledClass = isDisabled ? 'disabled-for-selection' : '';
    const selectedClass = isSelected ? 'selected' : '';
    const groupDef = this._getGroupDefinition(itemDef);
    const maxChoices = groupDef?.maxChoices ?? itemDef.maxChoices;
    const inputType = (maxChoices === 1) ? 'radio' : 'checkbox';
    const inputName = `name="group-${this.source}"`;

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

  /**
   * THIS METHOD CONTAINS THE FIX FOR SUB-OPTION maxChoices.
   */
  _createOptionsHTML(parentItemDef, parentSelectionState) {
    const isParentSelected = !!parentSelectionState;
    const currentSelections = parentSelectionState?.selections || [];
    // The key fix: Use the parent's `maxChoices` property to determine the input type.
    const inputType = (parentItemDef.maxChoices === 1) ? 'radio' : 'checkbox';
    const name = `name="nested-options-${parentItemDef.id}-${this.source}"`;
    return `
      <div class="ability-options">
        <p>Choose ${parentItemDef.maxChoices || 'any'}:</p>
        ${parentItemDef.options.map(option => `
          <label class="ability-option">
            <input type="${inputType}" name="${name}" value="${option.id}"
                   data-action="select-option"
                   ${currentSelections.includes(option.id) ? 'checked' : ''}
                   ${!isParentSelected ? 'disabled' : ''}>
            <span class="option-visual"></span>
            <span class="option-text-content">${option.name}</span>
          </label>
        `).join('')}
      </div>
    `;
  }

  /**
   * THIS METHOD CONTAINS THE FIX FOR ENFORCING SUB-OPTION maxChoices.
   */
  _handleClick(e) {
    const card = e.target.closest('.ability-card');
    if (!card || card.classList.contains('disabled-for-selection')) {
      return;
    }
    const itemId = card.dataset.itemId;
    const itemDef = this.items[itemId];
    if (!itemDef) return;

    // Check if a nested option was clicked
    if (e.target.closest('.ability-options')) {
      if (e.target.dataset.action === 'select-option') {
        if (!this.stateManager.itemManager.getSelection(itemId, this.source)) {
            this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId);
        }

        const optionsContainer = e.target.closest('.ability-options');
        const allOptionInputs = optionsContainer.querySelectorAll('input[data-action="select-option"]');
        let newNestedSelections = Array.from(allOptionInputs)
          .filter(input => input.checked)
          .map(input => input.value);
        
        // Enforce max choices for nested options using the parent's `maxChoices` property.
        if (itemDef.maxChoices && newNestedSelections.length > itemDef.maxChoices) {
            e.target.checked = false; // Revert the click
            return; // Stop processing
        }
        this.stateManager.itemManager.updateNestedSelections(itemId, this.source, newNestedSelections);
      }
      return; 
    }
    
    // If not a nested option, treat it as a main card click
    const mainInput = card.querySelector('input[data-action="select-parent"]');
    if (mainInput) {
      if (e.target !== mainInput) {
        mainInput.checked = !mainInput.checked;
      }
      if (mainInput.checked) {
        this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId);
      } else {
        if (mainInput.type === 'checkbox') {
            this.stateManager.itemManager.deselectItem(itemId, this.source);
        }
      }
    }
  }

  _getGroupDefinition(itemDef) {
    if (!this.source.startsWith('destiny-')) return null;
    const destinyId = this.stateManager.get('destiny');
    if (!destinyId) return null;
    const destinyDef = this.stateManager.getDestiny(destinyId);
    return destinyDef?.choiceGroups?.[itemDef.groupId] || null;
  }

  cleanup() {
    this.container.removeEventListener('click', this._boundHandleClick);
    document.removeEventListener('wizard:stateChange', this._boundHandleStateChange);
  }
}

export { ItemSelectorComponent };
