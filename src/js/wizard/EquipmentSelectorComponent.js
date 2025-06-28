// public/js/components/wizard/EquipmentSelectorComponent.js
// A specialized, reusable component that extends ItemSelectorComponent
// to handle the unique UI needs of equipment and loot.

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
      const selectionState = selections.find(s => s.id === itemDef.id && s.source === this.source);
      const validationState = this.ruleEngine.getValidationState(itemDef, this.source, this.context);
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
    const canAddMore = !validationState.isDisabled;
    
    const isDisabledForSelection = validationState.isDisabled && !isSelected;

    const isEquipped = selectionState?.equipped || false;
    const currentQuantity = selectionState?.quantity || 0;

    const disabledClass = isDisabledForSelection ? 'disabled-for-selection' : '';
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
          
          ${itemDef.itemType === 'equipment' ? `
              <div class="equip-toggle-group">
                  <label>
                      <input type="checkbox" id="equip-${itemDef.id}" class="equip-toggle" 
                             data-action="set-equipped" ${isEquipped ? 'checked' : ''} ${!isSelected ? 'disabled' : ''}>
                      Equip
                  </label>
              </div>` : ''
          }

          <div class="card-buttons">
            ${itemDef.stackable
                ? this._createQuantityControlHTML(itemDef, currentQuantity, canAddMore)
                : `
                  <button class="add-remove-btn" data-action="toggle-select" data-item-id="${itemDef.id}" ${isDisabledForSelection ? 'disabled' : ''}>
                    ${isSelected ? 'Remove' : 'Add'}
                  </button>`
            }
          </div>

        </div>
      </div>
    `;
  }

  /**
   * Generates the HTML for the plus/minus quantity control.
   * @private
   */
  _createQuantityControlHTML(itemDef, currentQuantity, canAddMore) {
    const canDecrement = currentQuantity > 0;
    return `
      <div class="quantity-control">
        <button class="quantity-btn btn-minus" 
                data-action="decrement-quantity" 
                ${!canDecrement ? 'disabled' : ''}>-</button>
        <span class="quantity-display">${currentQuantity}</span>
        <button class="quantity-btn" 
                data-action="increment-quantity" 
                ${!canAddMore ? 'disabled' : ''}>+</button>
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
    if (!action || e.target.disabled) return;

    const card = e.target.closest('.item-card');
    if (!card) return;

    const itemId = card.dataset.itemId;
    const itemDef = this.items[itemId];
    if (!itemDef) return;
    
    const selection = this.stateManager.itemManager.getSelection(itemId, this.source);
    const currentQuantity = selection?.quantity || 0;

    // MODIFIED: All selectItem calls now pass itemDef.groupId
    switch (action) {
      case 'increment-quantity':
        if (this.ruleEngine.getValidationState(itemDef, this.source, this.context).isDisabled) {
            console.warn(`RuleEngine validation prevented adding another '${itemDef.name}'.`);
            return;
        }

        if (currentQuantity === 0) {
          this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId, {
              quantity: 1,
              equipped: itemDef.itemType === 'equipment' ? true : undefined
          });
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

      case 'set-equipped':
        const isEquipped = e.target.checked;
        this.stateManager.itemManager.updateSelection(itemId, this.source, { equipped: isEquipped });
        break;
        
      case 'toggle-select': // For non-stackable items
        this.stateManager.itemManager.selectItem(itemDef, this.source, itemDef.groupId, {
            quantity: 1,
            equipped: itemDef.itemType === 'equipment' ? true : undefined
        });
        break;
    }
  }

  /**
   * Overrides _attachEventListeners to listen for all necessary events.
   * @private
   */
  _attachEventListeners() {
    this.container.addEventListener('click', this._boundHandleClick);
    this.container.addEventListener('change', this._boundHandleClick);
  }
}

export { EquipmentSelectorComponent };