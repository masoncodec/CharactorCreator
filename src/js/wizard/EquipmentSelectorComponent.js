// public/js/components/wizard/EquipmentSelectorComponent.js
// A specialized, reusable component that extends ItemSelectorComponent
// FINAL VERSION: Intelligently changes UI based on maxChoices and item stackability.

import { ItemSelectorComponent } from './ItemSelectorComponent.js';

class EquipmentSelectorComponent extends ItemSelectorComponent {
  /**
   * Overrides the parent render method to ensure the correct card HTML is used.
   * This method itself doesn't need to change from the parent, but it's here for clarity.
   */
  render() {
    super.render();
  }

  /**
   * --- REPLACED: This method is now much smarter. ---
   * It decides which style of card to render based on the rules you've defined.
   * @private
   */
  _createCardHTML(itemDef, selectionState, validationState) {
    const groupDef = this._getGroupDefinition(itemDef);
    const maxChoices = groupDef?.maxChoices ?? itemDef.maxChoices;

    // RULE 1: If it's a single-choice group (maxChoices === 1)...
    // RULE 2: Or if the item is NOT stackable...
    // ...then render the simple, standard card from the parent class.
    if (maxChoices === 1 || !itemDef.stackable) {
      return this._createSimpleSelectionCard(itemDef, selectionState, validationState);
    }
    
    // Otherwise, render the special card with quantity controls.
    return this._createQuantityControlCard(itemDef, selectionState, validationState);
  }

  /**
   * --- NEW HELPER METHOD ---
   * Renders a standard selection card but injects the "Equip" toggle.
   */
  _createSimpleSelectionCard(itemDef, selectionState, validationState) {
    // Get the standard card HTML (with radio/checkbox) from the parent class.
    const baseCardHTML = super._createCardHTML(itemDef, selectionState, validationState);

    // Create a temporary element to safely manipulate the HTML string.
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
      // Inject the equip toggle at the end of the card.
      cardElement.insertAdjacentHTML('beforeend', equipToggleHTML);
    }

    return tempDiv.innerHTML;
  }

  /**
   * --- NEW HELPER METHOD (was the old _createCardHTML) ---
   * Renders the specialized card for stackable items in multi-choice/point-buy groups.
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
   * --- REPLACED: This method is now also much smarter. ---
   * It decides whether to use its own special logic or pass the event to the parent class.
   * @private
   */
  _handleClick(e) {
    const card = e.target.closest('.ability-card');
    if (!card) return;

    const itemId = card.dataset.itemId;
    const itemDef = this.items[itemId];
    if (!itemDef) return;

    const groupDef = this._getGroupDefinition(itemDef);
    const maxChoices = groupDef?.maxChoices ?? itemDef.maxChoices;

    // If the card is in radio mode or is not stackable, let the parent handle the main selection click.
    if (maxChoices === 1 || !itemDef.stackable) {
      // The only custom action we need to handle is the equip toggle.
      if (e.target.dataset.action === 'set-equipped') {
        const isEquipped = e.target.checked;
        this.stateManager.itemManager.updateSelection(itemId, this.source, { equipped: isEquipped });
        return;
      }
      // For all other clicks (like selecting the card itself), use the parent's logic.
      super._handleClick(e);
      return;
    }

    // Otherwise (it's a stackable item in a multi-choice group), use the quantity logic.
    const action = e.target.dataset.action;
    if (!action || e.target.disabled) return;
    
    const selection = this.stateManager.itemManager.getSelection(itemId, this.source);
    const currentQuantity = selection?.quantity || 0;

    switch (action) {
      case 'increment-quantity':
        if (this.ruleEngine.getValidationState(itemDef, this.source, this.context).isDisabled) {
            return;
        }
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
          // Deselect the item by calling selectItem again (it acts as a toggle)
          this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId);
        }
        break;
    }
  }

  _attachEventListeners() {
    this.container.addEventListener('click', this._boundHandleClick);
    this.container.addEventListener('change', this._boundHandleClick);
  }
}

export { EquipmentSelectorComponent };