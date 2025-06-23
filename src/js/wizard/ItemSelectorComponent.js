// ItemSelectorComponent.js
// A reusable component to render and manage a grid of selectable items (abilities, flaws, perks, etc.).

class ItemSelectorComponent {
    /**
     * @param {HTMLElement} containerElement - The DOM element to render the component into.
     * @param {Object} itemsToRender - An object of item definitions to be displayed.
     * @param {string} source - A unique identifier for the context of this component (e.g., 'independent-flaw', 'destiny-abilities').
     * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
     * @param {RuleEngine} ruleEngine - The instance of the RuleEngine.
     */
    constructor(containerElement, itemsToRender, source, stateManager, ruleEngine) {
      this.container = containerElement;
      this.items = itemsToRender;
      this.source = source;
      this.stateManager = stateManager;
      this.ruleEngine = ruleEngine;
  
      // Bind event handlers to maintain 'this' context
      this._boundHandleClick = this._handleClick.bind(this);
      this._boundHandleStateChange = this._onStateChange.bind(this);
  
      this._attachEventListeners();
      console.log(`ItemSelectorComponent: Initialized for source '${this.source}'.`);
    }
  
    /**
     * Renders the grid of item cards based on the current state.
     */
    render() {
      if (!this.container) return;
  
      let allCardsHtml = '';
      for (const itemId in this.items) {
        const itemDef = this.items[itemId];
        // Use the component's source to get the correct selection state
        const selectionState = this.stateManager.itemManager.getSelection(itemDef.id, this.source);
        const validationState = this.ruleEngine.getValidationState(itemDef, this.source);
        
        allCardsHtml += this._createCardHTML(itemDef, selectionState, validationState);
      }
      this.container.innerHTML = allCardsHtml || '<p>No items available for this section.</p>';
    }
  
    /**
     * Attaches a delegated event listener to the container and a global state change listener.
     * @private
     */
    _attachEventListeners() {
      this.container.addEventListener('click', this._boundHandleClick);
      // Listen for global state changes to re-render, ensuring UI is always in sync.
      document.addEventListener('wizard:stateChange', this._boundHandleStateChange);
    }
  
    /**
     * Handles state changes to trigger a re-render.
     * @private
     */
    _onStateChange(event) {
      // Re-render whenever the state changes to reflect new validation states (e.g., points changed)
      this.render();
    }
    
    /**
     * Generates the HTML for a single item card.
     * @param {Object} itemDef - The item's definition.
     * @param {Object|null} selectionState - The current selection state for this item.
     * @param {Object} validationState - The validation state from the RuleEngine.
     * @returns {string} HTML string for the card.
     * @private
     */
    _createCardHTML(itemDef, selectionState, validationState) {
      const isSelected = !!selectionState;
      const isDisabled = validationState.isDisabled;
  
      const disabledClass = isDisabled ? 'disabled-for-selection' : '';
      const selectedClass = isSelected ? 'selected' : '';
      const inputType = (itemDef.maxChoices === 1) ? 'radio' : 'checkbox';
      // Use a unique name for radio button groups to ensure they are mutually exclusive
      const inputName = (itemDef.maxChoices === 1) ? `name="group-${this.source}"` : '';
  
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
     * Generates the HTML for nested options within a card.
     * @param {Object} parentItemDef - The definition of the parent item.
     * @param {Object|null} parentSelectionState - The selection state of the parent item.
     * @returns {string} HTML string for the options section.
     * @private
     */
    _createOptionsHTML(parentItemDef, parentSelectionState) {
      const isParentSelected = !!parentSelectionState;
      const currentSelections = parentSelectionState?.selections || [];
      const inputType = (parentItemDef.maxOptionChoices === 1) ? 'radio' : 'checkbox';
      const inputName = `name="nested-options-${parentItemDef.id}-${this.source}"`;
  
      return `
        <div class="ability-options">
          <p>Choose ${parentItemDef.maxOptionChoices || 'any'}:</p>
          ${parentItemDef.options.map(option => `
            <label class="ability-option">
              <input type="${inputType}" name="${inputName}" value="${option.id}"
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
     * Handles all click events within the component's container.
     * THIS METHOD CONTAINS THE FIX.
     * @param {Event} e - The click event.
     * @private
     */
    _handleClick(e) {
      const card = e.target.closest('.ability-card');
      if (!card) return;
  
      // Prevent action on disabled cards
      if (card.classList.contains('disabled-for-selection')) {
          e.preventDefault();
          return;
      }
  
      const itemId = card.dataset.itemId;
      const itemDef = this.items[itemId];
      if (!itemDef) return;
  
      // Check if the click was on a nested option
      const clickedOptionInput = e.target.closest('input[data-action="select-option"]');
      if (clickedOptionInput) {
        // This click is for a nested option, handle it specifically
        const optionsContainer = clickedOptionInput.closest('.ability-options');
        const allOptionInputs = optionsContainer.querySelectorAll('input[data-action="select-option"]');
        const newNestedSelections = Array.from(allOptionInputs)
          .filter(input => input.checked)
          .map(input => input.value);
        
        this.stateManager.itemManager.updateNestedSelections(itemId, this.source, newNestedSelections);
        return; // Stop further processing
      }
  
      // If the click was not on a nested option, treat it as a click on the main card.
      // This makes the entire card clickable.
      const mainInput = card.querySelector('input[data-action="select-parent"]');
      if (!mainInput) return;
  
      // Manually toggle the checkbox/radio state if the click wasn't on the input itself
      if (e.target !== mainInput) {
          mainInput.checked = !mainInput.checked;
      }
  
      // Now, process the selection based on the new state of the input
      if (mainInput.checked) {
        this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId);
      } else {
        // Only allow deselection for checkboxes, not radio buttons
        if (mainInput.type === 'checkbox') {
          this.stateManager.itemManager.deselectItem(itemId, this.source);
        }
      }
    }
  
    /**
     * Cleans up event listeners when the component is no longer needed.
     */
    cleanup() {
      this.container.removeEventListener('click', this._boundHandleClick);
      document.removeEventListener('wizard:stateChange', this._boundHandleStateChange);
      console.log(`ItemSelectorComponent: Cleaned up for source '${this.source}'.`);
    }
  }
  
  export { ItemSelectorComponent };
  