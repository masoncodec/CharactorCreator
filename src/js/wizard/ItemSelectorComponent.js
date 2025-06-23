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
    // REMOVED: The state change listener is no longer needed in this component,
    // as the Page Handler is now responsible for triggering re-renders on state change.
    // This also helps prevent potential redundant render calls.
    // this._boundHandleStateChange = this._onStateChange.bind(this);
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
    // The component-level state change listener is removed.
    // document.addEventListener('wizard:stateChange', this._boundHandleStateChange);
  }

  // This method is no longer needed as the parent handler triggers renders.
  // _onStateChange() {
  //   this.render();
  // }

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

  // --- REFACTOR START ---
  // The _handleClick method is now greatly simplified. It no longer needs to
  // manage the input's checked state manually or decide between select/deselect.
  // It entrusts the intelligent `selectItem` method in the state manager to handle all logic.
  _handleClick(e) {
    const card = e.target.closest('.ability-card');
    if (!card || card.classList.contains('disabled-for-selection')) {
      return;
    }
    const itemId = card.dataset.itemId;
    const itemDef = this.items[itemId];
    if (!itemDef) return;

    // Handle nested options separately (this logic was already correct).
    if (e.target.closest('.ability-options')) {
      if (e.target.dataset.action === 'select-option') {
        if (!this.stateManager.itemManager.getSelection(itemId, this.source)) {
            this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId);
        }

        const optionsContainer = e.target.closest('.ability-options');
        const allOptionInputs = optionsContainer.querySelectorAll('input[data-action="select-option"]');
        const newNestedSelections = Array.from(allOptionInputs)
          .filter(input => input.checked)
          .map(input => input.value);
        
        this.stateManager.itemManager.updateNestedSelections(itemId, this.source, newNestedSelections);
      }
      return; 
    }
    
    // The single, authoritative call for any parent item selection/deselection.
    // The state manager's `selectItem` method now contains all the necessary logic
    // to determine if the action should be a selection, deselection (toggle), or radio swap.
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
    // Ensure the event listener is removed upon cleanup.
    document.removeEventListener('wizard:stateChange', this._boundHandleStateChange);
  }
}

export { ItemSelectorComponent };