// public/js/components/wizard/EquipmentSelectorComponent.js
// FINAL VERSION: Intelligently changes UI based on unlock type and item stackability.

import { ItemSelectorComponent } from './ItemSelectorComponent.js';

class EquipmentSelectorComponent extends ItemSelectorComponent {
  /**
   * Overrides the parent render method to ensure the correct card HTML is used.
   */
  render() {
    // This method can simply call the parent's render, as all logic is in _createCardHTML.
    super.render();
  }

  /**
   * --- REPLACED: This method is now context-aware. ---
   * It decides which style of card to render based on the unlock type.
   * @private
   */
  _createCardHTML(itemDef, selectionState, validationState) {
    const unlockType = this.context?.unlock?.type;

    // On a 'pointBuy' page, we check if the item is stackable.
    if (unlockType === 'pointBuy' && itemDef.stackable) {
      return this._createQuantityControlCard(itemDef, selectionState, validationState);
    }
    
    // On all other pages ('choice' pages) OR for non-stackable items,
    // we render the simple, standard selection card.
    return this._createSimpleSelectionCard(itemDef, selectionState, validationState);
  }

  /**
   * --- NEW HELPER METHOD ---
   * Renders a standard selection card but injects the "Equip" toggle.
   */
  _createSimpleSelectionCard(itemDef, selectionState, validationState) {
    // Get the standard card HTML (with radio/checkbox) from the parent class.
    const baseCardHTML = super._createCardHTML(itemDef, selectionState, validationState);

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = baseCardHTML;
    const cardElement = tempDiv.querySelector('.ability-card');

    if (cardElement) {
      const isSelected = !!selectionState;
      const isEquipped = selectionState?.equipped || false;
      
      const equipToggleHTML = `
        <div class="item-card-footer">
          <div class="equip-toggle-group">
            <label>
              <input type="checkbox" class="equip-toggle" data-action="set-equipped" 
                     ${isEquipped ? 'checked' : ''} ${!isSelected ? 'disabled' : ''}>
              Equip
            </label>
          </div>
        </div>
      `;
      cardElement.insertAdjacentHTML('beforeend', equipToggleHTML);
    }

    return tempDiv.innerHTML;
  }

  /**
   * Renders the specialized card for stackable items on point-buy pages.
   */
  _createQuantityControlCard(itemDef, selectionState, validationState) {
    const isSelected = !!selectionState;
    const canAddMore = !validationState.isDisabled;
    const isDisabledForSelection = validationState.isDisabled && !isSelected;
    const selectedClass = isSelected ? 'selected' : '';
    const disabledClass = isDisabledForSelection ? 'disabled-for-selection' : '';
    const currentQuantity = selectionState?.quantity || 0;

    return `
      <div class="item-container">
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
            <div class="quantity-control">
              <button class="quantity-btn btn-minus" data-action="decrement-quantity" ${currentQuantity === 0 ? 'disabled' : ''}>-</button>
              <span class="quantity-display">${currentQuantity}</span>
              <button class="quantity-btn" data-action="increment-quantity" ${!canAddMore ? 'disabled' : ''}>+</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * --- REPLACED: This method is now also context-aware. ---
   * It decides whether to use its own quantity logic or pass the event to the parent class.
   * @private
   */
  _handleClick(e) {
    const card = e.target.closest('.ability-card');
    if (!card) return;

    const itemId = card.dataset.itemId;
    const itemDef = this.items[itemId];
    if (!itemDef) return;

    const unlockType = this.context?.unlock?.type;

    // If we are on a point-buy page and the item is stackable, use the quantity logic.
    if (unlockType === 'pointBuy' && itemDef.stackable) {
      const action = e.target.dataset.action;
      if (!action || e.target.disabled) return;
      
      const selection = this.stateManager.itemManager.getSelection(itemId, this.source);
      const currentQuantity = selection?.quantity || 0;

      switch (action) {
        case 'increment-quantity':
          if (this.ruleEngine.getValidationState(itemDef, this.source, this.context).isDisabled) return;
          if (currentQuantity === 0) {
            this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId, { quantity: 1, equipped: true });
          } else {
            this.stateManager.itemManager.updateSelection(itemId, this.source, { quantity: currentQuantity + 1 });
          }
          break;
        case 'decrement-quantity':
          if (currentQuantity > 1) {
            this.stateManager.itemManager.updateSelection(itemId, this.source, { quantity: currentQuantity - 1 });
          } else if (currentQuantity === 1) {
            this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId);
          }
          break;
      }
      return; // Stop execution here for quantity controls
    }
    
    // Otherwise (it's a simple selection card), handle the equip toggle or pass to the parent.
    if (e.target.dataset.action === 'set-equipped') {
      const isEquipped = e.target.checked;
      this.stateManager.itemManager.updateSelection(itemId, this.source, { equipped: isEquipped });
      return;
    }

    // For all other clicks, let the parent component handle the selection logic.
    super._handleClick(e);
  }

  _attachEventListeners() {
    this.container.addEventListener('click', this._boundHandleClick);
    this.container.addEventListener('change', this._boundHandleClick);
  }
}

export { EquipmentSelectorComponent };