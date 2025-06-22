// equipmentAndLootPageHandler.js
// This module handles the display and interaction for the Equipment and Loot page.
// REWORKED for point-based system

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
    this.SOURCE_ID = 'equipment-and-loot'; // Define a source constant

    // Bindings for event listeners
    this.boundHandleItemSelection = this._handleItemSelection.bind(this);
    this.boundHandleQuantityChange = this._handleQuantityChange.bind(this);
    this.boundHandleEquipToggle = this._handleEquipToggle.bind(this);
    this.boundOnStateChange = this._onStateChange.bind(this);

    console.log('EquipmentAndLootPageHandler: Initialized (Point System).');
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
    this._attachEventListeners();

    // The informer updater is now the single source of truth for the informer panel
    this.informerUpdater.update('equipment-and-loot');
    this.pageNavigator.updateNav();
  }

  /**
   * Renders the selector panel with available equipment and loot.
   * The actual state (disabled, etc.) is handled by _updateAllItemCardStates.
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
    const currentInventory = this.stateManager.getState().inventory;

    for (const itemId in allItems) {
      const item = allItems[itemId];
      const inventoryItem = currentInventory.find(i => i.id === item.id && i.source === this.SOURCE_ID);
      const isInInventory = !!inventoryItem;
      const isEquipped = inventoryItem?.equipped || false;
      const currentQuantity = inventoryItem?.quantity || 0;

      const itemCardHtml = `
        <div class="item-card" data-item-id="${item.id}" data-item-type="${item.type}">
          <div class="item-card-header">
            ${item.name} <span class="item-category">(${item.type === 'equipment' ? item.category : 'Loot'})</span>
          </div>
          <div class="item-card-body">
            <div class="item-card-meta">
              <span>Rarity: <span class="rarity">${item.rarity || 'N/A'}</span></span>
              <!-- Changed Weight to Points -->
              <span class="font-bold">Points: ${item.weight || '0'}</span>
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
            <button class="add-remove-btn" data-item-id="${item.id}">
              Add to Inventory
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
    
    // Initial update of all card states (buttons, disabled status, etc.)
    this._updateAllItemCardStates();
  }

  /**
   * Attaches all necessary event listeners for the page.
   * @private
   */
  _attachEventListeners() {
    this.selectorPanel.removeEventListener('click', this.boundHandleItemSelection);
    this.selectorPanel.addEventListener('click', this.boundHandleItemSelection);

    // Using 'input' for a more responsive feel than 'change'
    this.selectorPanel.removeEventListener('input', this.boundHandleQuantityChange);
    this.selectorPanel.addEventListener('input', this.boundHandleQuantityChange);

    this.selectorPanel.removeEventListener('change', this.boundHandleEquipToggle);
    this.selectorPanel.addEventListener('change', this.boundHandleEquipToggle);

    // Listen for global state changes to update card affordance
    document.addEventListener('wizard:stateChange', this.boundOnStateChange);
  }

  /**
   * Callback for the wizard:stateChange event.
   * Updates the UI if the inventory has changed.
   * @param {CustomEvent} event - The event object.
   * @private
   */
  _onStateChange(event) {
    if (event.detail && event.detail.key === 'inventory') {
        this._updateAllItemCardStates();
        // The informer updater is now responsible for its own content
        this.informerUpdater.update('equipment-and-loot');
    }
  }

  /**
   * Updates all item cards to reflect the current point state.
   * This will enable/disable cards, buttons, and inputs based on remaining points.
   * @private
   */
  _updateAllItemCardStates() {
    const { remaining } = this.stateManager.getEquipmentPointsSummary();
    const allItemDefs = this.stateManager.getEquipmentAndLootData();
    const inventory = this.stateManager.getState().inventory;
    const itemCards = this.selectorPanel.querySelectorAll('.item-card');

    itemCards.forEach(card => {
        const itemId = card.dataset.itemId;
        const itemDef = allItemDefs[itemId];
        if (!itemDef) return;

        const inventoryItem = inventory.find(i => i.id === itemId && i.source === this.SOURCE_ID);
        const isInInventory = !!inventoryItem;
        const currentQuantity = inventoryItem?.quantity || 0;
        const itemCost = itemDef.weight || 0;

        const button = card.querySelector('.add-remove-btn');
        const quantityInput = card.querySelector('.quantity-input');
        const equipToggle = card.querySelector('.equip-toggle');

        // Update button text and action based on whether the item is in inventory
        const isRemoveAction = isInInventory && currentQuantity > 0;
        button.textContent = isRemoveAction ? 'Remove' : 'Add to Inventory';
        button.dataset.action = isRemoveAction ? 'remove' : 'add';
        button.classList.toggle('action-remove', isRemoveAction);
        
        // Determine if the item is affordable to be ADDED
        const canAfford = itemCost <= remaining;
        
        if (!isInInventory) {
            button.disabled = !canAfford;
            card.classList.toggle('card-disabled', !canAfford);
        } else {
            // If it's already in, the remove button should always be enabled
            button.disabled = false;
            card.classList.remove('card-disabled');
        }
        
        // Update quantity input for stackable items
        if (quantityInput) {
            const pointsAvailableForThisStack = remaining + (currentQuantity * itemCost);
            const maxCanAfford = itemCost > 0 ? Math.floor(pointsAvailableForThisStack / itemCost) : 9999;
            // Store the max affordable quantity on the element for later validation
            quantityInput.dataset.maxAfford = maxCanAfford;
        }

        // Update equip toggle
        if (equipToggle) {
            equipToggle.disabled = !isInInventory;
            if (!isInInventory) equipToggle.checked = false;
        }
    });
  }

  /**
   * Handles click events for Add/Remove buttons.
   * @param {Event} event - The click event.
   * @private
   */
  _handleItemSelection(event) {
    const button = event.target.closest('.add-remove-btn');
    if (!button || button.disabled) return;

    const itemId = button.dataset.itemId;
    const action = button.dataset.action;
    const itemDef = this.stateManager.getInventoryItemDefinition(itemId);
    if (!itemDef) return;

    const itemCost = itemDef.weight || 0;
    const { remaining } = this.stateManager.getEquipmentPointsSummary();
    const inventoryItem = this.stateManager.getState().inventory.find(i => i.id === itemId && i.source === this.SOURCE_ID);
    
    if (action === 'add') {
      if (inventoryItem) return; // Safeguard: should not be able to add an item that's already in inventory
      
      if (itemCost > remaining) {
        this.alerter.show(`Not enough points. Needs ${itemCost}, you have ${remaining}.`, 'warning');
        return;
      }
      
      let quantityToAdd = 1;
      if (itemDef.stackable) {
          const quantityInput = this.selectorPanel.querySelector(`#quantity-${itemId}`);
          quantityToAdd = parseInt(quantityInput.value, 10) || 1;
          if (quantityToAdd <= 0) quantityToAdd = 1; // Default to 1 if input is invalid
          quantityInput.value = quantityToAdd;

          const totalCost = quantityToAdd * itemCost;
          if (totalCost > remaining) {
              this.alerter.show(`Cannot afford ${quantityToAdd} of ${itemDef.name}. Cost: ${totalCost}, Remaining Points: ${remaining}.`, 'warning');
              return;
          }
      }
      this.stateManager.addOrUpdateInventoryItem({ id: itemId, quantity: quantityToAdd, equipped: false }, this.SOURCE_ID, null);

    } else if (action === 'remove') {
      // Remove all items of this type from the page
      this.stateManager.removeInventoryItem(itemId, inventoryItem.quantity, this.SOURCE_ID);
    }
  }

  /**
   * Handles changes to quantity input fields for stackable loot.
   * @param {Event} event - The input event.
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
    }
    
    const maxAfford = parseInt(input.dataset.maxAfford, 10);
    if (newQuantity > maxAfford) {
        this.alerter.show(`Cannot afford ${newQuantity} of ${itemDef.name}. You can afford a maximum of ${maxAfford}.`, 'warning');
        newQuantity = maxAfford;
        input.value = newQuantity; // Visually correct the input value in the browser
    }

    this.stateManager.addOrUpdateInventoryItem({ id: itemId, quantity: newQuantity }, this.SOURCE_ID, null);
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
    
    const currentItemInState = this.stateManager.getState().inventory.find(i => i.id === itemId && i.source === this.SOURCE_ID);

    if (!currentItemInState) {
      this.alerter.show(`Cannot equip/unequip. It's not in your inventory.`, 'warning');
      checkbox.checked = false;
      return;
    }

    this.stateManager.addOrUpdateInventoryItem({
      id: itemId,
      quantity: currentItemInState.quantity,
      equipped: isEquipped
    }, this.SOURCE_ID, null);
  }

  /**
   * Cleans up event listeners when the page is changed.
   */
  cleanup() {
    console.log('EquipmentAndLootPageHandler.cleanup: Cleaning up event listeners.');
    this.selectorPanel.removeEventListener('click', this.boundHandleItemSelection);
    this.selectorPanel.removeEventListener('input', this.boundHandleQuantityChange);
    this.selectorPanel.removeEventListener('change', this.boundHandleEquipToggle);
    document.removeEventListener('wizard:stateChange', this.boundOnStateChange);
  }
}

export { EquipmentAndLootPageHandler };
