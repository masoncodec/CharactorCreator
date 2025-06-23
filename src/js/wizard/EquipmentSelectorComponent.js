// public/js/components/wizard/EquipmentSelectorComponent.js
// A specialized, reusable component that extends ItemSelectorComponent
// to handle the unique UI needs of equipment and loot, such as
// quantity inputs and equip toggles.

import { ItemSelectorComponent } from './ItemSelectorComponent.js';

class EquipmentSelectorComponent extends ItemSelectorComponent {
  /**
   * Overrides the parent render method to use the specialized card HTML.
   */
  render() {
    if (!this.container) return;
    let allCardsHtml = '';
    const selections = this.stateManager.get('selections');

    for (const itemId in this.items) {
      const itemDef = this.items[itemId];
      // Find the specific selection for this item from this source
      const selectionState = selections.find(s => s.id === itemDef.id && s.source === this.source);
      const validationState = this.ruleEngine.getValidationState(itemDef, this.source);
      allCardsHtml += this._createCardHTML(itemDef, selectionState, validationState);
    }
    this.container.innerHTML = allCardsHtml || '<p>No items available for this section.</p>';
  }

  /**
   * Overrides the parent _createCardHTML to add quantity and equip controls.
   * @param {Object} itemDef - The full definition of the item.
   * @param {Object|null} selectionState - The current selection state for this item, if any.
   * @param {Object} validationState - The validation result from the RuleEngine.
   * @returns {string} The HTML for the item card.
   * @private
   */
  _createCardHTML(itemDef, selectionState, validationState) {
    const isSelected = !!selectionState;
    const isDisabled = validationState.isDisabled && !isSelected; // An item can't be disabled if it's already selected
    const isEquipped = selectionState?.equipped || false;
    const currentQuantity = selectionState?.quantity || 0;

    const disabledClass = isDisabled ? 'disabled-for-selection' : '';
    const selectedClass = isSelected ? 'selected' : '';

    return `
      <div class="item-card ability-card ${selectedClass} ${disabledClass}" 
           data-item-id="${itemDef.id}"
           title="${validationState.reason}">
        <div class="ability-header">
          <span class="ability-name">${itemDef.name}</span>
          <div class="ability-types">
            <span class="type-tag">${itemDef.itemType} (${itemDef.weight || 0} pts)</span>
          </div>
        </div>
        <div class="ability-description">${itemDef.description}</div>
        
        <div class="item-card-footer">
          ${itemDef.stackable ? `
              <div class="quantity-input-group">
                  <label for="quantity-${itemDef.id}">Qty:</label>
                  <input type="number" id="quantity-${itemDef.id}" class="quantity-input" 
                         data-action="set-quantity" value="${currentQuantity}" min="0" ${!isSelected ? 'disabled' : ''}>
              </div>` : ''
          }
          ${itemDef.itemType === 'equipment' ? `
              <div class="equip-toggle-group">
                  <label>
                      <input type="checkbox" id="equip-${itemDef.id}" class="equip-toggle" 
                             data-action="set-equipped" ${isEquipped ? 'checked' : ''} ${!isSelected ? 'disabled' : ''}>
                      Equip
                  </label>
              </div>` : ''
          }
          <button class="add-remove-btn" data-action="toggle-select" data-item-id="${itemDef.id}" ${isDisabled ? 'disabled' : ''}>
            ${isSelected ? 'Remove' : 'Add'}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Overrides the parent _handleClick to manage the new actions.
   * @param {Event} e - The click or input event.
   * @private
   */
  _handleClick(e) {
    const action = e.target.dataset.action;
    if (!action) return;

    const card = e.target.closest('.item-card');
    if (!card) return;

    const itemId = card.dataset.itemId;
    const itemDef = this.items[itemId];
    if (!itemDef) return;

    switch (action) {
      case 'toggle-select':
        // The itemManager's selectItem handles both selection (if not present)
        // and deselection (if present and not a radio button).
        this.stateManager.itemManager.selectItem(itemDef, this.source, null, {
            quantity: 1,
            equipped: itemDef.itemType === 'equipment' ? true : undefined
        });
        break;

      case 'set-quantity':
        // Handle quantity change for stackable items
        const newQuantity = parseInt(e.target.value, 10);
        if (!isNaN(newQuantity)) {
            this.stateManager.itemManager.updateSelection(itemId, this.source, { quantity: newQuantity });
        }
        break;

      case 'set-equipped':
        // Handle equip toggle for equipment
        const isEquipped = e.target.checked;
        this.stateManager.itemManager.updateSelection(itemId, this.source, { equipped: isEquipped });
        break;
    }
  }

  /**
   * Overrides _attachEventListeners to listen for 'input' and 'change' events
   * for the new controls.
   * @private
   */
  _attachEventListeners() {
    this.container.addEventListener('click', this._boundHandleClick);
    this.container.addEventListener('input', this._boundHandleClick); // For quantity input
    this.container.addEventListener('change', this._boundHandleClick); // For equip checkbox
  }
}

export { EquipmentSelectorComponent };