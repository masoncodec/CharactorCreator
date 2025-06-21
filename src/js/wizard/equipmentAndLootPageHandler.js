// equipmentAndLootPageHandler.js
// This module handles the display and interaction for the Equipment and Loot page.

class EquipmentAndLootPageHandler {
  /**
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   * @param {InformerUpdater} informerUpdater - The instance of the InformerUpdater.
   * @param {PageNavigator} pageNavigator - The instance of the PageNavigator.
   * @param {Object} alerter - The alerter utility for displaying messages.
   */
  constructor(stateManager, informerUpdater, pageNavigator, alerter) {
    this.stateManager = stateManager;
    this.informerUpdater = informerUpdater;
    this.pageNavigator = pageNavigator;
    this.alerter = alerter;

    this.boundHandleItemSelection = this._handleItemSelection.bind(this);
    this.boundHandleQuantityChange = this._handleQuantityChange.bind(this);
    this.boundHandleEquipToggle = this._handleEquipToggle.bind(this);

    console.log('EquipmentAndLootPageHandler: Initialized.');
  }

  /**
   * Sets up the page by rendering content and attaching event listeners.
   * @param {HTMLElement} selectorPanel - The DOM element for the selector content.
   * @param {HTMLElement} informerPanel - The DOM element for the informer content.
   */
  setupPage(selectorPanel, informerPanel) {
    console.log('EquipmentAndLootPageHandler.setupPage: Setting up Equipment and Loot page.');

    this.selectorPanel = selectorPanel;
    this.informerPanel = informerPanel;

    this._renderSelectorPanel();
    this._renderInformerPanel();
    this._attachEventListeners();

    // Initial update of navigation
    this.pageNavigator.updateNav();
    this.informerUpdater.update('equipment-and-loot');
  }

  /**
   * Renders the selector panel with available equipment and loot into two columns.
   * @private
   */
  _renderSelectorPanel() {
    const equipmentContainer = this.selectorPanel.querySelector('.equipment-column .scroll-area');
    const lootContainer = this.selectorPanel.querySelector('.loot-column .scroll-area');

    if (!equipmentContainer || !lootContainer) {
      this.selectorPanel.innerHTML = '<p class="text-red-500">Error: Page layout is incorrect. Could not find column containers.</p>';
      return;
    }

    const allItems = this.stateManager.getEquipmentAndLootData();
    if (!allItems) {
      equipmentContainer.innerHTML = '<p>Error: Equipment data not loaded.</p>';
      lootContainer.innerHTML = '<p>Error: Loot data not loaded.</p>';
      return;
    }

    let equipmentHtml = '';
    let lootHtml = '';

    for (const itemId in allItems) {
      const item = allItems[itemId];
      const inventoryItem = this.stateManager.getState().inventory.find(i => i.id === item.id);
      const isInInventory = !!inventoryItem;
      const isEquipped = inventoryItem?.equipped || false;
      const currentQuantity = inventoryItem?.quantity || 0;
      const isRemoveAction = isInInventory && (!item.stackable || currentQuantity > 0);

      const itemCardHtml = `
        <div class="item-card" data-item-id="${item.id}" data-item-type="${item.type}">
          <div class="item-card-header">
            ${item.name} <span class="item-category">(${item.type === 'equipment' ? item.category : 'Loot'})</span>
          </div>
          <div class="item-card-body">
            <div class="item-card-meta">
              <span>Rarity: <span class="rarity">${item.rarity || 'N/A'}</span></span>
              <span>Weight: ${item.weight || 'N/A'}</span>
              ${item.value ? `<span>Value: ${item.value} gold</span>` : ''}
            </div>
            <p class="description">${item.description}</p>
          </div>
          <div class="item-card-footer">
            ${item.type === 'loot' && item.stackable ? `
                <div class="quantity-input-group">
                    <label for="quantity-${item.id}">Qty:</label>
                    <input type="number" id="quantity-${item.id}" class="quantity-input" value="${currentQuantity}" min="0">
                </div>` : ''
            }
            ${item.type === 'equipment' ? `
                <div class="equip-toggle-group">
                    <label>
                        <input type="checkbox" id="equip-${item.id}" class="equip-toggle" ${isEquipped ? 'checked' : ''} ${!isInInventory ? 'disabled' : ''}>
                        Equip
                    </label>
                </div>` : ''
            }
            <button class="add-remove-btn ${isRemoveAction ? 'action-remove' : ''}"
                    data-item-id="${item.id}"
                    data-item-type="${item.type}"
                    data-action="${isRemoveAction ? 'remove' : 'add'}">
              ${isRemoveAction ? 'Remove' : 'Add to Inventory'}
            </button>
          </div>
        </div>
      `;

      if (item.type === 'equipment') {
        equipmentHtml += itemCardHtml;
      } else if (item.type === 'loot') {
        lootHtml += itemCardHtml;
      }
    }

    equipmentContainer.innerHTML = equipmentHtml || '<p>No equipment available.</p>';
    lootContainer.innerHTML = lootHtml || '<p>No loot available.</p>';
  }

  /**
   * Renders the informer panel with the character's current inventory summary.
   * @private
   */
  _renderInformerPanel() {
    const currentState = this.stateManager.getState();
    const inventory = currentState.inventory;
    const allItemDefinitions = this.stateManager.getEquipmentAndLootData();

    if (!allItemDefinitions) {
      this.informerPanel.innerHTML = '<p class="text-red-500">Error: Item definitions not loaded for informer.</p>';
      return;
    }

    let inventoryListHtml = '';
    if (inventory.length === 0) {
      inventoryListHtml = '<p class="text-gray-400">Your inventory is empty.</p>';
    } else {
      inventoryListHtml = '<ul class="space-y-2">';
      inventory.forEach(itemState => {
        const itemDef = allItemDefinitions[itemState.id];
        if (itemDef) {
          inventoryListHtml += `
            <li class="bg-gray-800 p-2 rounded flex justify-between items-center text-gray-200 text-sm">
              <span>${itemDef.name} ${itemState.quantity > 1 ? `(x${itemState.quantity})` : ''}</span>
              ${itemState.equipped ? '<span class="text-green-400 text-xs">(Equipped)</span>' : ''}
            </li>
          `;
        }
      });
      inventoryListHtml += '</ul>';
    }

    this.informerPanel.innerHTML = `
      <h3 class="text-xl font-bold mb-4">Current Inventory</h3>
      <div id="current-inventory-list" class="bg-gray-700 p-4 rounded-lg shadow-inner max-h-64 overflow-y-auto">
        ${inventoryListHtml}
      </div>
      <p class="text-gray-300 text-sm mt-4">Total Weight: <span id="total-inventory-weight">${this._calculateTotalWeight()}</span></p>
    `;
  }

  /**
   * Calculates the total weight of items in the current inventory.
   * @returns {number} The total weight.
   * @private
   */
  _calculateTotalWeight() {
    const currentState = this.stateManager.getState();
    const inventory = currentState.inventory;
    const allItemDefinitions = this.stateManager.getEquipmentAndLootData();
    let totalWeight = 0;

    inventory.forEach(itemState => {
      const itemDef = allItemDefinitions[itemState.id];
      if (itemDef && typeof itemDef.weight === 'number') {
        totalWeight += itemDef.weight * itemState.quantity;
      }
    });
    return totalWeight;
  }

  /**
   * Attaches event listeners to the relevant elements on the page.
   * @private
   */
  _attachEventListeners() {
    this.selectorPanel.removeEventListener('click', this.boundHandleItemSelection);
    this.selectorPanel.addEventListener('click', this.boundHandleItemSelection);

    this.selectorPanel.removeEventListener('change', this.boundHandleQuantityChange);
    this.selectorPanel.addEventListener('change', this.boundHandleQuantityChange);

    this.selectorPanel.removeEventListener('change', this.boundHandleEquipToggle);
    this.selectorPanel.addEventListener('change', this.boundHandleEquipToggle);

    document.removeEventListener('wizard:stateChange', this.boundRenderInformerOnStateChange);
    this.boundRenderInformerOnStateChange = this._renderInformerPanel.bind(this);
    document.addEventListener('wizard:stateChange', this.boundRenderInformerOnStateChange);
  }

  /**
   * Handles click events on item "Add/Remove" buttons.
   * @param {Event} event - The click event.
   * @private
   */
  _handleItemSelection(event) {
    const button = event.target.closest('.add-remove-btn');
    if (!button) return;

    const itemId = button.dataset.itemId;
    const action = button.dataset.action;
    const itemDef = this.stateManager.getInventoryItemDefinition(itemId);

    if (!itemDef) {
      this.alerter.show(`Error: Item definition not found for ${itemId}`, 'error');
      return;
    }

    let currentQuantityInState = this.stateManager.getState().inventory.find(i => i.id === itemId)?.quantity || 0;
    
    if (action === 'add') {
      const quantityInput = this.selectorPanel.querySelector(`#quantity-${itemId}`);
      let quantityToAdd = (itemDef.stackable && quantityInput) ? parseInt(quantityInput.value, 10) : 1;

      if (quantityToAdd <= 0 && itemDef.stackable) {
        this.alerter.show('Quantity must be greater than zero to add.', 'warning');
        return;
      }
      if (!itemDef.stackable && currentQuantityInState > 0) {
        this.alerter.show(`${itemDef.name} is not stackable and you already have it.`, 'warning');
        return;
      }

      this.stateManager.addOrUpdateInventoryItem({ id: itemId, quantity: quantityToAdd, equipped: false });
    } else if (action === 'remove') {
      let quantityToRemove = 1;
      if (itemDef.stackable) {
        const quantityInput = this.selectorPanel.querySelector(`#quantity-${itemId}`);
        quantityToRemove = quantityInput ? parseInt(quantityInput.value, 10) : 1;

        if (quantityToRemove <= 0) {
          this.alerter.show('Quantity must be greater than zero to remove.', 'warning');
          return;
        }
        if (quantityToRemove > currentQuantityInState) {
          this.alerter.show(`Cannot remove ${quantityToRemove} of ${itemDef.name}. You only have ${currentQuantityInState}.`, 'warning');
          quantityToRemove = currentQuantityInState;
        }
      }
      this.stateManager.removeInventoryItem(itemId, quantityToRemove);
    }
    this._updateItemCardButton(button, itemId, itemDef.stackable);
    this._renderInformerPanel();
    this.pageNavigator.updateNav();
  }
  
  /**
   * Handles changes to quantity input fields for stackable loot.
   * @param {Event} event - The change event.
   * @private
   */
  _handleQuantityChange(event) {
    const input = event.target.closest('.quantity-input');
    if (!input) return;

    const card = input.closest('.item-card');
    const itemId = card.dataset.itemId;
    const itemDef = this.stateManager.getInventoryItemDefinition(itemId);
    if (!itemDef || !itemDef.stackable) return;

    let newQuantity = parseInt(input.value, 10);
    if (isNaN(newQuantity) || newQuantity < 0) {
      newQuantity = 0;
      input.value = 0;
    }

    this.stateManager.addOrUpdateInventoryItem({ id: itemId, quantity: newQuantity });
    const button = card.querySelector('.add-remove-btn');
    this._updateItemCardButton(button, itemId, true);
    this._renderInformerPanel();
  }
  
  /**
   * Handles changes to equip checkboxes for equipment.
   * @param {Event} event - The change event.
   * @private
   */
  _handleEquipToggle(event) {
    const checkbox = event.target.closest('.equip-toggle');
    if (!checkbox) return;

    const itemId = checkbox.closest('.item-card').dataset.itemId;
    const isEquipped = checkbox.checked;
    
    const currentItemInState = this.stateManager.getState().inventory.find(i => i.id === itemId);

    if (!currentItemInState) {
      this.alerter.show(`Cannot equip/unequip. It's not in your inventory.`, 'warning');
      checkbox.checked = false;
      return;
    }

    this.stateManager.addOrUpdateInventoryItem({
      id: itemId,
      quantity: currentItemInState.quantity,
      equipped: isEquipped
    });
    this._renderInformerPanel();
  }

  /**
   * Updates an item card's add/remove button style and action.
   * @param {HTMLElement} button - The button element.
   * @param {string} itemId - The ID of the item.
   * @param {boolean} isStackable - True if the item is stackable.
   * @private
   */
  _updateItemCardButton(button, itemId, isStackable) {
    const itemInInventory = this.stateManager.getState().inventory.find(i => i.id === itemId);
    const currentQuantity = itemInInventory?.quantity || 0;
    const isRemoveAction = itemInInventory && (isStackable ? currentQuantity > 0 : true);

    if (isRemoveAction) {
      button.textContent = 'Remove';
      button.dataset.action = 'remove';
      button.classList.add('action-remove');
    } else {
      button.textContent = 'Add to Inventory';
      button.dataset.action = 'add';
      button.classList.remove('action-remove');
    }

    const card = button.closest('.item-card');
    const equipCheckbox = card.querySelector('.equip-toggle');
    if (equipCheckbox) {
      equipCheckbox.disabled = !itemInInventory;
      if (!itemInInventory) {
        equipCheckbox.checked = false;
      }
    }
  }

  /**
   * Cleans up event listeners.
   */
  cleanup() {
    console.log('EquipmentAndLootPageHandler.cleanup: Cleaning up event listeners.');
    this.selectorPanel.removeEventListener('click', this.boundHandleItemSelection);
    this.selectorPanel.removeEventListener('change', this.boundHandleQuantityChange);
    this.selectorPanel.removeEventListener('change', this.boundHandleEquipToggle);
    document.removeEventListener('wizard:stateChange', this.boundRenderInformerOnStateChange);
  }
}

export { EquipmentAndLootPageHandler };