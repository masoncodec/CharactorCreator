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

    // Initial update of navigation (e.g., enable/disable next button based on page completion)
    this.pageNavigator.updateNav();
    this.informerUpdater.update('equipment-and-loot'); // Update informer specific to this page
  }

  /**
   * Renders the selector panel with available equipment and loot.
   * @private
   */
  _renderSelectorPanel() {
    const allItems = this.stateManager.getEquipmentAndLootData();
    if (!allItems) {
      this.selectorPanel.innerHTML = '<p class="text-red-500">Error: Equipment and loot data not loaded.</p>';
      return;
    }

    let equipmentHtml = '<h3 class="text-xl font-bold mb-4">Equipment</h3><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="equipment-list">';
    let lootHtml = '<h3 class="text-xl font-bold mb-4">Loot</h3><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="loot-list">';

    for (const itemId in allItems) {
      const item = allItems[itemId];
      const isInInventory = this.stateManager.getState().inventory.some(i => i.id === item.id);
      const isEquipped = this.stateManager.getState().inventory.some(i => i.id === item.id && i.equipped);
      const currentQuantity = this.stateManager.getState().inventory.find(i => i.id === item.id)?.quantity || 0;

      const itemCardHtml = `
        <div class="bg-gray-700 p-4 rounded-lg shadow-md flex flex-col item-card" data-item-id="${item.id}" data-item-type="${item.type}">
          <h4 class="text-lg font-semibold mb-2">${item.name} (${item.type === 'equipment' ? item.category : 'Loot'})</h4>
          <p class="text-gray-300 text-sm mb-2">Rarity: <span class="capitalize">${item.rarity || 'N/A'}</span></p>
          <p class="text-gray-300 text-sm mb-2">Weight: ${item.weight || 'N/A'}</p>
          ${item.value ? `<p class="text-gray-300 text-sm mb-2">Value: ${item.value} gold</p>` : ''}
          <p class="text-gray-400 text-xs flex-grow">${item.description}</p>
          
          <div class="mt-4 flex items-center justify-between">
            ${item.type === 'loot' && item.stackable ? `
                <div class="flex items-center space-x-2">
                    <label for="quantity-${item.id}" class="text-gray-300 text-sm">Qty:</label>
                    <input type="number" id="quantity-${item.id}" class="w-16 p-1 rounded bg-gray-800 text-white border border-gray-600 quantity-input" value="${currentQuantity}" min="0">
                </div>` : ''
            }
            ${item.type === 'equipment' ? `
                <div class="flex items-center space-x-2">
                    <input type="checkbox" id="equip-${item.id}" class="form-checkbox h-5 w-5 text-blue-600 rounded equip-toggle" ${isEquipped ? 'checked' : ''} ${!isInInventory ? 'disabled' : ''}>
                    <label for="equip-${item.id}" class="text-gray-300 text-sm">Equip</label>
                </div>` : ''
            }
            <button class="add-remove-btn bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200"
                    data-item-id="${item.id}"
                    data-item-type="${item.type}"
                    data-action="${isInInventory && (!item.stackable || currentQuantity > 0) ? 'remove' : 'add'}">
              ${isInInventory && (!item.stackable || currentQuantity > 0) ? 'Remove' : 'Add to Inventory'}
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

    equipmentHtml += '</div>';
    lootHtml += '</div>';

    this.selectorPanel.innerHTML = equipmentHtml + lootHtml;
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
        } else {
          inventoryListHtml += `
            <li class="bg-gray-800 p-2 rounded text-gray-200 text-sm">
              <span>Unknown Item (ID: ${itemState.id})</span>
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
    // Remove existing listeners to prevent duplicates
    this.selectorPanel.removeEventListener('click', this.boundHandleItemSelection);
    this.selectorPanel.removeEventListener('change', this.boundHandleQuantityChange);
    this.selectorPanel.removeEventListener('change', this.boundHandleEquipToggle);

    // Add new listeners
    this.selectorPanel.addEventListener('click', this.boundHandleItemSelection);
    this.selectorPanel.addEventListener('change', this.boundHandleQuantityChange);
    this.selectorPanel.addEventListener('change', this.boundHandleEquipToggle);

    // Listen for state changes to re-render the informer panel
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
    const itemType = button.dataset.itemType;
    const action = button.dataset.action; // 'add' or 'remove'
    const itemDef = this.stateManager.getInventoryItemDefinition(itemId);

    if (!itemDef) {
      this.alerter.show(`Error: Item definition not found for ${itemId}`, 'error');
      console.error(`EquipmentAndLootPageHandler: Item definition not found for ID: ${itemId}`);
      return;
    }

    let currentQuantityInState = this.stateManager.getState().inventory.find(i => i.id === itemId)?.quantity || 0;
    
    if (action === 'add') {
        const quantityInput = this.selectorPanel.querySelector(`#quantity-${itemId}`);
        let quantityToAdd = itemDef.stackable && quantityInput ? parseInt(quantityInput.value, 10) : 1;
        if (quantityToAdd <= 0 && itemDef.stackable) {
            this.alerter.show('Quantity must be greater than zero to add.', 'warning');
            return;
        }
        
        // If adding a non-stackable item and it's already in inventory, prevent adding again
        if (!itemDef.stackable && currentQuantityInState > 0) {
            this.alerter.show(`${itemDef.name} is not stackable and you already have it.`, 'warning');
            return;
        }

        this.stateManager.addOrUpdateInventoryItem({ id: itemId, quantity: quantityToAdd, equipped: false });
    } else if (action === 'remove') {
        if (itemDef.stackable) {
            const quantityInput = this.selectorPanel.querySelector(`#quantity-${itemId}`);
            let quantityToRemove = quantityInput ? parseInt(quantityInput.value, 10) : 1;
            
            if (quantityToRemove <= 0) {
                this.alerter.show('Quantity must be greater than zero to remove.', 'warning');
                return;
            }
            if (quantityToRemove > currentQuantityInState) {
                this.alerter.show(`Cannot remove ${quantityToRemove} of ${itemDef.name}. You only have ${currentQuantityInState}.`, 'warning');
                quantityToRemove = currentQuantityInState; // Adjust to remove all available
            }
            this.stateManager.removeInventoryItem(itemId, quantityToRemove);
        } else {
            // For non-stackable, just remove 1
            this.stateManager.removeInventoryItem(itemId, 1);
        }
    }
    this._updateItemCardButton(button, itemId, itemDef.stackable);
    this._renderInformerPanel(); // Re-render informer to reflect changes
    this.pageNavigator.updateNav(); // Update navigation as inventory changes might affect completion later
  }

  /**
   * Handles changes to quantity input fields for stackable loot.
   * @param {Event} event - The change event.
   * @private
   */
  _handleQuantityChange(event) {
    const input = event.target.closest('.quantity-input');
    if (!input) return;

    const itemId = input.id.replace('quantity-', '');
    const itemDef = this.stateManager.getInventoryItemDefinition(itemId);
    if (!itemDef || !itemDef.stackable) return; // Only process stackable items

    let newQuantity = parseInt(input.value, 10);
    if (isNaN(newQuantity) || newQuantity < 0) {
      newQuantity = 0; // Default to 0 or some sane value
      input.value = 0;
    }

    // Update the item in state. This will also handle adding if not present
    this.stateManager.addOrUpdateInventoryItem({ id: itemId, quantity: newQuantity });

    const button = input.closest('.item-card').querySelector('.add-remove-btn');
    this._updateItemCardButton(button, itemId, true); // True for stackable

    this._renderInformerPanel(); // Re-render informer to reflect changes
  }

  /**
   * Handles changes to equip checkboxes for equipment.
   * @param {Event} event - The change event.
   * @private
   */
  _handleEquipToggle(event) {
    const checkbox = event.target.closest('.equip-toggle');
    if (!checkbox) return;

    const itemId = checkbox.id.replace('equip-', '');
    const isEquipped = checkbox.checked;
    
    // Ensure the item is actually in the inventory before attempting to equip/unequip
    const currentItemInState = this.stateManager.getState().inventory.find(i => i.id === itemId);

    if (!currentItemInState) {
        this.alerter.show(`Cannot equip/unequip ${this.stateManager.getInventoryItemDefinition(itemId)?.name}. It's not in your inventory.`, 'warning');
        checkbox.checked = false; // Reset checkbox if not in inventory
        return;
    }

    this.stateManager.addOrUpdateInventoryItem({ id: itemId, equipped: isEquipped });
    
    this._renderInformerPanel(); // Re-render informer to reflect changes
  }

  /**
   * Updates the text and action of an item card's add/remove button.
   * @param {HTMLElement} button - The add/remove button element.
   * @param {string} itemId - The ID of the item.
   * @param {boolean} isStackable - True if the item is stackable.
   * @private
   */
  _updateItemCardButton(button, itemId, isStackable) {
    const itemInInventory = this.stateManager.getState().inventory.find(i => i.id === itemId);
    const currentQuantity = itemInInventory?.quantity || 0;

    if (itemInInventory && (isStackable ? currentQuantity > 0 : true)) {
      button.textContent = 'Remove';
      button.dataset.action = 'remove';
      button.classList.remove('bg-blue-600', 'hover:bg-blue-700');
      button.classList.add('bg-red-600', 'hover:bg-red-700');
    } else {
      button.textContent = 'Add to Inventory';
      button.dataset.action = 'add';
      button.classList.remove('bg-red-600', 'hover:bg-red-700');
      button.classList.add('bg-blue-600', 'hover:bg-blue-700');
    }

    // Enable/disable equip checkbox if applicable
    const equipCheckbox = button.closest('.item-card').querySelector('.equip-toggle');
    if (equipCheckbox) {
        equipCheckbox.disabled = !itemInInventory;
        if (!itemInInventory) {
            equipCheckbox.checked = false; // Uncheck if item is no longer in inventory
        }
    }
  }

  /**
   * Cleans up event listeners when the page is no longer active.
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