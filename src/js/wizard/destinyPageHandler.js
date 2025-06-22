// destinyPageHandler.js
// This module handles the UI rendering and event handling for the 'destiny' selection page,
// including destinies, flaws, and abilities.

import { alerter } from '../alerter.js'; 

class DestinyPageHandler {
  /**
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   * @param {InformerUpdater} informerUpdater - The instance of the InformerUpdater.
   * @param {PageNavigator} pageNavigator - The instance of the PageNavigator.
   */
  constructor(stateManager, informerUpdater, pageNavigator) {
    this.stateManager = stateManager;
    this.informerUpdater = informerUpdater;
    this.pageNavigator = pageNavigator;
    this.selectorPanel = null; // Will be set when setupPage is called

    console.log('DestinyPageHandler: Initialized.');
  }

  /**
   * Sets up the destiny page by rendering options and attaching event listeners.
   * This method is called by the main CharacterWizard when the 'destiny' page is loaded.
   * @param {HTMLElement} selectorPanel - The DOM element for the selector panel.
   * @param {HTMLElement} informerPanel - The DOM element for the informer panel (not directly used here).
   */
  setupPage(selectorPanel, informerPanel) {
    this.selectorPanel = selectorPanel;
    console.log('DestinyPageHandler.setupPage: Setting up destiny page events and rendering content.');

    this._renderDestinyOptions(); // Render initial destiny options
    this._attachEventListeners();
    this._restoreState(); // Restore state for destiny, flaws, and abilities

    this.informerUpdater.update('destiny'); // Update informer with current destiny state
    this.pageNavigator.updateNav(); // Update navigation buttons and sidebar
  }

  /**
   * Attaches all necessary event listeners to the selector panel.
   * @private
   */
  _attachEventListeners() {
    console.log('DestinyPageHandler._attachEventListeners: Attaching event listeners.');

    // Remove existing listeners if they were previously attached (important for re-setup)
    if (this._boundDestinyOptionClickHandler) {
      this.selectorPanel.removeEventListener('click', this._boundDestinyOptionClickHandler);
    }
    if (this._boundAbilityCardClickHandler) {
      this.selectorPanel.removeEventListener('click', this._boundAbilityCardClickHandler);
    }
    if (this._boundAbilityOptionChangeHandler) {
      this.selectorPanel.removeEventListener('change', this._boundAbilityOptionChangeHandler);
    }

    // Bind 'this' to the event handlers and store references for removal
    this._boundDestinyOptionClickHandler = this._handleDestinyOptionClick.bind(this);
    this._boundAbilityCardClickHandler = this._handleAbilityCardClick.bind(this);
    this._boundAbilityOptionChangeHandler = this._handleAbilityOptionChange.bind(this);

    // Attach new event listeners using the bound functions
    this.selectorPanel.addEventListener('click', this._boundDestinyOptionClickHandler);
    this.selectorPanel.addEventListener('click', this._boundAbilityCardClickHandler);
    this.selectorPanel.addEventListener('change', this._boundAbilityOptionChangeHandler);
  }

  /**
   * Handles click on destiny options.
   * @param {Event} e - The click event.
   * @private
   */
  _handleDestinyOptionClick(e) {
    const destinyOptionDiv = e.target.closest('.destiny-option');
    if (!destinyOptionDiv) return;

    const selectedDestinyId = destinyOptionDiv.dataset.destinyId;
    const currentDestiny = this.stateManager.get('destiny');

    if (currentDestiny !== selectedDestinyId) {
      // Remove 'selected' class from all other destiny options
      this.selectorPanel.querySelectorAll('.destiny-option').forEach(opt => {
        opt.classList.remove('selected');
      });

      // Add 'selected' to the clicked one
      destinyOptionDiv.classList.add('selected');

      // Update state: set new destiny, clear old abilities and destiny-related flaws
      this.stateManager.setState('destiny', selectedDestinyId);
      // Filter out only abilities sourced from 'destiny' when destiny changes
      this.stateManager.set('abilities', this.stateManager.get('abilities').filter(a => a.source !== 'destiny'));
      // Filter out only 'destiny' type flaws
      this.stateManager.set('flaws', this.stateManager.get('flaws').filter(f => f.source !== 'destiny'));
      // Filter out only 'destiny' type perks
      this.stateManager.set('perks', this.stateManager.get('perks').filter(p => p.source !== 'destiny'));
      // Filter out only 'destiny' type inventory items
      this.stateManager.set('inventory', this.stateManager.get('inventory').filter(i => i.source !== 'destiny'));


      console.log(`DestinyPageHandler: Destiny selected: ${selectedDestinyId}.`);

      // Re-render sections and update UI
      this._renderAbilityGroupsSection(); // Re-render ability groups section including flaws and perks
      this._autoSelectAbilitiesInGroup(); // Auto-select abilities if applicable (renamed)
      this._refreshAbilityOptionStates(); // Update disabled states after state change

      this.informerUpdater.update('destiny');
      this.pageNavigator.updateNav();
    } else {
      console.log(`DestinyPageHandler: Re-selected same destiny: ${selectedDestinyId}. No reset performed.`);
    }
  }

  /**
   * Handles click on ability cards (radio/checkbox inputs).
   * This method now robustly handles clicks on the card, its input, its label,
   * and its nested options, preventing double-toggling issues and ensuring correct
   * parent ability selection when clicking nested options.
   * @param {Event} e - The click event.
   * @private
   */
  _handleAbilityCardClick(e) {
    const abilityCard = e.target.closest('.ability-card');
    if (!abilityCard) return;

    const itemId = abilityCard.dataset.itemId; // Can be abilityId or flawId or perkId or equipmentId
    const groupId = abilityCard.dataset.groupId;
    const source = abilityCard.dataset.source;
    const itemType = abilityCard.dataset.type; // 'ability', 'flaw', 'perk', or 'equipment'
    const maxChoices = parseInt(abilityCard.dataset.maxChoices, 10);

    // This is the main input (radio/checkbox) for the parent ability/flaw/perk card
    const inputElement = abilityCard.querySelector(`input[data-item="${itemId}"][data-group="${groupId}"][data-source="${source}"][data-type="${itemType}"]`);
    if (!inputElement) {
      console.warn('DestinyPageHandler: Could not find associated input for clicked card.');
      return;
    }

    // If the card is visually disabled, prevent any clicks on it.
    if (abilityCard.classList.contains('disabled-for-selection')) {
        console.log(`Click prevented on disabled ${itemType} card: ${itemId}`);
        e.preventDefault(); // Prevent default checkbox/radio toggle
        return;
    }

    const currentState = this.stateManager.getState();
    const currentItemsInState = {
      ability: currentState.abilities,
      flaw: currentState.flaws,
      perk: currentState.perks,
      equipment: currentState.inventory
    }[itemType];
    const isParentItemCurrentlySelected = currentItemsInState.some(i => i.id === itemId && i.groupId === groupId && i.source === source);

    const mainLabel = inputElement.closest('label');
    const isClickOnMainInputOrLabel = (e.target === inputElement || (mainLabel && mainLabel.contains(e.target)));

    const isClickOnNestedOptionArea = e.target.closest('.ability-options');
    const clickedNestedOptionInput = e.target.closest('input[data-option]'); // The specific nested option input clicked

    // --- SCENARIO 1: Clicked anywhere within the nested options area ---
    if (isClickOnNestedOptionArea) {
        console.log(`_handleAbilityCardClick: Click in nested option area for ${itemId}.`);
        if (!isParentItemCurrentlySelected) {
            console.log(`_handleAbilityCardClick: Parent ${itemType} ${itemId} not selected. Selecting parent first.`);
            // User clicked a nested option, and the parent item is NOT selected.
            // Explicitly set the parent input's checked state to true BEFORE processing parent selection.
            inputElement.checked = true; // This 'inputElement' refers to the main parent card input
            this._processParentItemSelection(itemId, groupId, source, itemType, maxChoices, inputElement, true);
        }

        // Now, dispatch a change event on the clicked nested input to trigger its handler.
        // Use setTimeout to allow the parent state update and refresh to complete first.
        if (clickedNestedOptionInput) {
            console.log(`_handleAbilityCardClick: Dispatching change event for nested option ${clickedNestedOptionInput.dataset.option}.`);
            setTimeout(() => {
                clickedNestedOptionInput.dispatchEvent(new Event('change', { bubbles: true }));
            }, 0);
        }
        return; // Important: prevent main ability card click logic from running
    }

    // --- SCENARIO 2: Clicked on main item card (input, label, or other parts *outside* nested options) ---
    console.log(`_handleAbilityCardClick: Click on main ${itemType} card for ${itemId}.`);
    let intendedSelectionState;
    if (isClickOnMainInputOrLabel) {
        intendedSelectionState = inputElement.checked; // Browser's native toggle already updated inputElement.checked
    } else {
        intendedSelectionState = !inputElement.checked;
        inputElement.checked = intendedSelectionState; // Manually toggle the main input
    }
    this._processParentItemSelection(itemId, groupId, source, itemType, maxChoices, inputElement, intendedSelectionState);
  }

  /**
   * Helper function to encapsulate parent item selection/deselection logic.
   * @param {string} itemId - The ID of the item being selected.
   * @param {string} groupId - The ID of the group the item belongs to.
   * @param {string} source - The source of the item (e.g., 'destiny').
   * @param {string} itemType - 'ability', 'flaw', 'perk', or 'equipment'.
   * @param {number} maxChoices - The max choices for the item's group.
   * @param {HTMLInputElement} inputElement - The main item's checkbox/radio input.
   * @param {boolean} intendedSelectionState - The desired checked state for the parent item.
   * @private
   */
  _processParentItemSelection(itemId, groupId, source, itemType, maxChoices, inputElement, intendedSelectionState) {
    console.log(`_processParentItemSelection: Processing ${itemType} ${itemId} with intended state: ${intendedSelectionState}.`);
    
    // Logic for abilities, flaws, and perks
    const addOrUpdateMethodMap = {
      ability: 'addOrUpdateAbility',
      flaw: 'addOrUpdateFlaw',
      perk: 'addOrUpdatePerk'
    };
    const removeMethodMap = {
      ability: 'removeAbility',
      flaw: 'removeFlaw',
      perk: 'removePerk'
    };
    const stateArrayMap = {
      ability: 'abilities',
      flaw: 'flaws',
      perk: 'perks',
      equipment: 'inventory'
    };

    if (intendedSelectionState) { // Add or update item
      // For single-choice groups, first remove any other item from the same group/source
      if (maxChoices === 1) {
          const allItems = this.stateManager.get(stateArrayMap[itemType]);
          const otherItemsInGroup = allItems.filter(i => i.groupId === groupId && i.source === source && i.id !== itemId);
          otherItemsInGroup.forEach(otherItem => {
              if (itemType === 'equipment') {
                  this.stateManager.removeInventoryItem(otherItem.id, Infinity, source);
              } else {
                  this.stateManager[removeMethodMap[itemType]](otherItem.id, source, groupId);
              }
          });
      }
      
      if (itemType === 'equipment') {
        this.stateManager.addOrUpdateInventoryItem({ id: itemId, quantity: 1, equipped: true, selections: [] }, source, groupId);
      } else {
        this.stateManager[addOrUpdateMethodMap[itemType]]({ id: itemId, selections: [], source, groupId });
      }
    } else { // Remove item
      if (itemType === 'equipment') {
        this.stateManager.removeInventoryItem(itemId, Infinity, source); // Remove all instances from this source
      } else {
        this.stateManager[removeMethodMap[itemType]](itemId, source, groupId);
      }
    }

    this.informerUpdater.update('destiny');
    this.pageNavigator.updateNav();
    this._refreshAbilityOptionStates();
  }

  /**
   * Handles change event on nested ability/flaw/perk option checkboxes/radio buttons.
   * @param {Event} e - The change event.
   * @private
   */
  _handleAbilityOptionChange(e) {
    // This handler is for nested options. The new equipment items do not have nested options,
    // so this function does not need modification for now. It will be skipped for equipment.
    if (!e.target.matches('input[data-option]')) {
      return;
    }

    const optionInput = e.target;
    const itemId = optionInput.dataset.item;
    const optionId = optionInput.dataset.option;
    const parentItemCard = optionInput.closest('.ability-card'); // Parent card provides context
    const groupId = parentItemCard.dataset.groupId;
    const source = parentItemCard.dataset.source;
    const itemType = parentItemCard.dataset.type;
    
    const isSelectedFromInput = optionInput.checked;

    console.log(`_handleAbilityOptionChange: Processing nested option ${optionId} for ${itemType} ${itemId}. Current input checked: ${isSelectedFromInput}`);

    this._handleNestedOptionSelection(itemId, source, groupId, itemType, optionId, isSelectedFromInput, optionInput);
  }

  /**
   * Handles the selection/deselection of an option nested within an ability or flaw or perk.
   * @param {string} itemId - The ID of the parent ability or flaw or perk.
   * @param {string} source - The source of the parent item.
   * @param {string} groupId - The ID of the group the parent item belongs to.
   * @param {string} itemType - 'ability', 'flaw', or 'perk'.
   * @param {string} optionId - The ID of the option selected/deselected.
   * @param {boolean} isSelectedFromInput - True if the input element is checked after the user's interaction, false false otherwise.
   * @param {HTMLElement} inputElement - The input element (checkbox/radio).
   * @private
   */
  _handleNestedOptionSelection(itemId, source, groupId, itemType, optionId, isSelectedFromInput, inputElement) {
    const currentState = this.stateManager.getState();
    const parentStateArray = {
        ability: currentState.abilities,
        flaw: currentState.flaws,
        perk: currentState.perks,
        // Equipment items don't have nested options in this implementation
    }[itemType];
    
    const parentItemState = parentStateArray.find(i => i.id === itemId && i.source === source && i.groupId === groupId);

    if (!parentItemState) {
      console.warn(`DestinyPageHandler._handleNestedOptionSelection: Parent ${itemType} '${itemId}' NOT FOUND IN STATE.`);
      inputElement.checked = false;
      this._refreshAbilityOptionStates();
      return;
    }

    const parentItemDef = this.stateManager.getAbilityOrFlawData(itemId, groupId);
    let newSelections = [...parentItemState.selections];

    const isOptionCurrentlyInState = parentItemState.selections.some(s => s.id === optionId);

    if (inputElement.type === 'radio') {
      newSelections = [{ id: optionId }];
    } else { // Checkbox logic
      if (isOptionCurrentlyInState && !isSelectedFromInput) {
        newSelections = newSelections.filter(s => s.id !== optionId);
      } else if (!isOptionCurrentlyInState && isSelectedFromInput) {
        if (parentItemDef.maxChoices !== undefined && newSelections.length >= parentItemDef.maxChoices) {
          inputElement.checked = false;
          alerter.show(`You can only select up to ${parentItemDef.maxChoices} option(s) for ${parentItemDef.name}.`);
          this._refreshAbilityOptionStates();
          return;
        }
        newSelections.push({ id: optionId });
      }
    }
    
    // Update the parent item's selections array in the state
    switch (itemType) {
        case 'ability': this.stateManager.updateAbilitySelections(itemId, source, groupId, newSelections); break;
        case 'flaw': this.stateManager.updateFlawSelections(itemId, source, groupId, newSelections); break;
        case 'perk': this.stateManager.updatePerkSelections(itemId, source, groupId, newSelections); break;
    }
    
    console.log(`_handleNestedOptionSelection: Selections updated for ${itemType} ${itemId}:`, newSelections);
    this.informerUpdater.update('destiny');
    this.pageNavigator.updateNav();
    this._refreshAbilityOptionStates();
  }

  /**
   * Restores the selections for destiny, flaws, and abilities based on the current state.
   * @private
   */
  _restoreState() {
    console.log('DestinyPageHandler._restoreState: Restoring page state.');
    const currentState = this.stateManager.getState();

    if (currentState.destiny) {
      const destinyOptionDiv = this.selectorPanel.querySelector(`.destiny-option[data-destiny-id="${currentState.destiny}"]`);
      if (destinyOptionDiv) {
        destinyOptionDiv.classList.add('selected');
      }
    }

    // Combine all selectable items from this page into one array for iteration
    const itemsToRestore = [
      ...currentState.abilities, 
      ...currentState.flaws, 
      ...currentState.perks,
      ...currentState.inventory // Also check inventory for sourced items
    ];

    itemsToRestore.forEach(itemState => {
      // Ensure we only restore items originating from 'destiny' source on this page
      if (itemState.source === 'destiny' && itemState.groupId) {
        const itemCard = this.selectorPanel.querySelector(
          `.ability-card[data-item-id="${itemState.id}"][data-group-id="${itemState.groupId}"][data-source="${itemState.source}"]`
        );
        if (itemCard) {
          itemCard.classList.add('selected');
          
          const inputElement = itemCard.querySelector(`input[data-item="${itemState.id}"]`);
          if (inputElement) {
            inputElement.checked = true;
          }
          console.log(`DestinyPageHandler._restoreState: Item card "${itemState.id}" re-selected.`);

          // Restore nested options (if any)
          if (itemState.selections && itemState.selections.length > 0) {
            itemState.selections.forEach(option => {
              const optionInput = itemCard.querySelector(`input[data-option="${option.id}"]`);
              if (optionInput) {
                optionInput.checked = true;
              }
            });
          }
        }
      }
    });

    this._autoSelectAbilitiesInGroup();
    this._refreshAbilityOptionStates();
  }

  /**
   * Renders the destiny options based on the selected module.
   * @private
   */
  _renderDestinyOptions() {
    const destinyOptionsContainer = document.getElementById('destiny-options-container');
    if (!destinyOptionsContainer) {
      console.error('DestinyPageHandler: destiny-options-container not found.');
      return;
    }
    destinyOptionsContainer.innerHTML = ''; // Clear previous options

    const currentModuleId = this.stateManager.get('module');
    if (currentModuleId) {
      const moduleData = this.stateManager.getModule(currentModuleId);
      const destiniesForModule = moduleData?.destinies || [];
      const currentDestiny = this.stateManager.get('destiny');

      destiniesForModule.forEach(destinyId => {
        const destiny = this.stateManager.getDestiny(destinyId);
        if (!destiny) {
          console.error(`DestinyPageHandler: Missing destiny data for: ${destinyId}`);
          return;
        }
        const isSelected = currentDestiny === destinyId;
        const destinyOptionDiv = document.createElement('div');
        destinyOptionDiv.classList.add('destiny-option');
        if (isSelected) {
          destinyOptionDiv.classList.add('selected');
        }
        destinyOptionDiv.dataset.destinyId = destinyId;
        destinyOptionDiv.innerHTML = `
          <span class="destiny-name">${destiny.displayName}</span>
        `;
        destinyOptionsContainer.appendChild(destinyOptionDiv);
      });
      console.log(`DestinyPageHandler: Destiny options rendered for module: ${currentModuleId}`);
    } else {
      destinyOptionsContainer.innerHTML = '<p>Please select a Module first to see available Destinies.</p>';
      console.log('DestinyPageHandler: No module selected, cannot render destinies.');
    }

    // After rendering destinies, render the associated ability sections (which now include flaws and perks)
    this._renderAbilityGroupsSection();
  }

  /**
   * Renders the ability groups section for the current destiny, now including flaws and perks.
   * @private
   */
  _renderAbilityGroupsSection() {
    let abilitiesSection = this.selectorPanel.querySelector('.abilities-section');
    if (!this.stateManager.get('destiny')) {
        if (abilitiesSection) abilitiesSection.remove();
        return;
    }

    const destiny = this.stateManager.getDestiny(this.stateManager.get('destiny'));
    if (!destiny || !destiny.choiceGroups) {
        console.warn('DestinyPageHandler: No destiny data or choice groups to render items.');
        if (abilitiesSection) abilitiesSection.remove();
        return;
    }

    const container = document.createElement('div');
    container.className = 'abilities-section';
    container.innerHTML = '<h4>Choose Your Character Features</h4>';

    const currentState = this.stateManager.getState();

    Object.entries(destiny.choiceGroups).forEach(([groupId, groupDef]) => {
      const isFlawGroup = groupId === 'flaws';
      const isPerkGroup = groupId === 'perks';
      const isEquipmentGroup = groupId === 'equipment';

      const maxChoicesText = groupDef.maxChoices === 1 ? 'Choose 1' : `Choose ${groupDef.maxChoices}`;
      container.innerHTML += `<h5 class="group-header">${groupDef.name} (${maxChoicesText})</h5>`;

      const groupGridContainer = document.createElement('div');
      groupGridContainer.className = 'abilities-grid-container';

      groupDef.abilities.forEach(itemId => {
        let item;
        let itemDataType;
        let currentItemsState;

        // Determine item type and get data accordingly
        if (isFlawGroup) {
            itemDataType = 'flaw';
            item = this.stateManager.getAbilityOrFlawData(itemId, groupId);
            currentItemsState = currentState.flaws;
        } else if (isPerkGroup) {
            itemDataType = 'perk';
            item = this.stateManager.getAbilityOrFlawData(itemId, groupId);
            currentItemsState = currentState.perks;
        } else if (isEquipmentGroup) {
            itemDataType = 'equipment';
            item = this.stateManager.getInventoryItemDefinition(itemId);
            if (item) item.type = 'equipment'; // Ensure type is set for icon
            currentItemsState = currentState.inventory;
        } else {
            itemDataType = 'ability';
            item = this.stateManager.getAbilityOrFlawData(itemId, groupId);
            currentItemsState = currentState.abilities;
        }
        
        if (!item) {
          console.warn(`DestinyPageHandler: Missing item data: ${itemId} in group ${groupId}`);
          return;
        }

        const isSelected = currentItemsState.some(i =>
          i.id === itemId && i.groupId === groupId && i.source === 'destiny'
        );

        const itemTypeClass = item.type === 'active' ? 'active' : (item.type === 'passive' ? 'passive' : '');
        const inputType = groupDef.maxChoices === 1 ? 'radio' : 'checkbox';
        const inputName = groupDef.maxChoices === 1 ? `name="group-${groupId}"` : '';

        groupGridContainer.innerHTML += `
          <div class="ability-container">
              <div class="ability-card ${isSelected ? 'selected' : ''}"
                   data-item-id="${itemId}"
                   data-group-id="${groupId}"
                   data-max-choices="${groupDef.maxChoices}"
                   data-source="destiny"
                   data-type="${itemDataType}">
                  <div class="ability-header">
                      <label>
                          <input type="${inputType}" ${inputName}
                              ${isSelected ? 'checked' : ''}
                              data-item="${itemId}"
                              data-group="${groupId}"
                              data-source="destiny"
                              data-type="${itemDataType}">
                          <span class="ability-name">${item.name}</span>
                      </label>
                      <div class="ability-types">
                          <span class="type-tag ${itemTypeClass}">${this._getTypeIcon(item.category || item.type)} ${item.category || item.type}</span>
                      </div>
                  </div>
                  <div class="ability-description">${this._renderAbilityDescription(item)}</div>
                  ${item.options ? this._renderAbilityOptions(item, itemId, groupId, 'destiny', itemDataType) : ''}
              </div>
          </div>
        `;
      });
      container.appendChild(groupGridContainer);
    });

    const destinyScrollArea = this.selectorPanel.querySelector('.destiny-content-scroll-area');
    if (destinyScrollArea) {
        const existingAbilitiesSection = destinyScrollArea.querySelector('.abilities-section');
        if (existingAbilitiesSection) {
            existingAbilitiesSection.replaceWith(container);
        } else {
            destinyScrollArea.appendChild(container);
        }
    } else {
        this.selectorPanel.appendChild(container);
    }
  }

  /**
   * Helper function to get type icons for items.
   * @param {string} type - The type of item (e.g., 'passive', 'flaw', 'weapon', 'armor').
   * @returns {string} The corresponding emoji icon.
   * @private
   */
  _getTypeIcon(type) {
    const icons = {
      'Combat': '⚔️', 'weapon': '⚔️',
      'Spell': '🔮',
      'Support': '🛡️', 'armor': '🛡️', 'shield': '🛡️',
      'Social': '💬',
      'Holy': '✨',
      'Healing': '❤️',
      'Performance': '🎤',
      'Utility': '🛠️',
      'passive': '⭐',
      'active': '⚡',
      'flaw': '💔',
      'perk': '✨',
      'accessory': '💍',
      'equipment': '🎒'
    };
    return icons[type] || '❔';
  }

  /**
   * Helper function to render item descriptions.
   * @param {Object} item - The item object.
   * @returns {string} The rendered description HTML.
   * @private
   */
  _renderAbilityDescription(item) {
    let desc = item.description;
    if (!desc) return ''; // Handle cases where description might be missing

    desc = desc.replace(/\${([^}]+)}/g, (match, p1) => {
      let value;
      try {
        const path = p1.split('.');
        let current = item;
        for (let i = 0; i < path.length; i++) {
          if (current === null || current === undefined) {
            current = undefined;
            break;
          }
          current = current[path[i]];
        }
        value = current;

        if (value === undefined && typeof item[p1] !== 'undefined') {
          value = item[p1];
        }
      } catch (e) {
        console.error(`DestinyPageHandler: Error resolving template variable ${p1}:`, e);
        value = undefined;
      }

      if (value !== undefined) {
        if (p1 === 'cost.gold' && typeof value === 'number') {
          return `${value} gold`;
        }
        return value;
      }
      return match;
    });
    return desc;
  }

  /**
   * Helper function to render options nested within an item.
   * @param {Object} parentItemDef - The parent item's definition.
   * @param {string} itemId - The ID of the parent item.
   * @param {string} groupId - The ID of the group.
   * @param {string} source - The source of the item.
   * @param {string} itemType - The type of item ('ability', 'flaw', etc.).
   * @returns {string} HTML string for options.
   * @private
   */
  _renderAbilityOptions(parentItemDef, itemId, groupId, source, itemType) {
    if (!parentItemDef.options) return '';

    const currentState = this.stateManager.getState();
    const parentStateArray = itemType === 'ability' ? currentState.abilities : (itemType === 'flaw' ? currentState.flaws : currentState.perks);
    
    // Find the specific parent item (ability or flaw or perk) state
    const parentItemState = parentStateArray.find(i => i.id === itemId && i.source === source && i.groupId === groupId);
    const currentSelections = parentItemState ? parentItemState.selections : [];
    const isParentItemCurrentlySelected = !!parentItemState;

    const inputType = (parentItemDef.maxChoices === 1) ? 'radio' : 'checkbox';
    // For nested options, the name should be unique to the parent item's options.
    const inputName = (inputType === 'radio') ? `name="item-options-${itemId}"` : '';
    const chooseText = (parentItemDef.maxChoices === 1) ? 'Choose one' : `Choose ${parentItemDef.maxChoices || 'any'}`;

    return `
      <div class="ability-options">
          <p>${chooseText}:</p>
          ${parentItemDef.options.map(option => {
            const isOptionSelected = currentSelections.some(s => s.id === option.id);
            const disabledAttribute = !isParentItemCurrentlySelected ? 'disabled' : ''; // Initial disabled
            const checkedAttribute = isOptionSelected ? 'checked' : '';

            return `
                <label class="ability-option">
                    <input type="${inputType}"
                        ${inputName}
                        ${checkedAttribute}
                        data-item="${itemId}"
                        data-option="${option.id}"
                        data-group="${groupId}"
                        data-source="${source}"
                        data-type="${itemType}"
                        ${disabledAttribute}
                    >
                    <span class="option-visual"></span>
                    <span class="option-text-content">${option.name}: ${this._renderAbilityDescription(option)}</span> </label>`;
          }).join('')}
      </div>
      `;
  }

  /**
   * Auto-selects items if a group has a specific configuration.
   * @private
   */
  _autoSelectAbilitiesInGroup() {
    // ... (This function needs to be generalized for equipment)
    const currentState = this.stateManager.getState();
    if (!currentState.destiny) return;

    const destiny = this.stateManager.getDestiny(currentState.destiny);
    if (!destiny || !destiny.choiceGroups) return;

    Object.entries(destiny.choiceGroups).forEach(([groupId, groupDef]) => {
      if (groupDef.maxChoices > 0 && groupDef.maxChoices === groupDef.abilities.length) {
        const isFlawGroup = groupId === 'flaws';
        const isPerkGroup = groupId === 'perks';
        const isEquipmentGroup = groupId === 'equipment';

        groupDef.abilities.forEach(itemId => {
          const source = 'destiny';
          let itemDataType;
          let currentItemsState;

          if (isFlawGroup) { itemDataType = 'flaw'; currentItemsState = currentState.flaws; }
          else if (isPerkGroup) { itemDataType = 'perk'; currentItemsState = currentState.perks; }
          else if (isEquipmentGroup) { itemDataType = 'equipment'; currentItemsState = currentState.inventory; }
          else { itemDataType = 'ability'; currentItemsState = currentState.abilities; }

          const isAlreadySelected = currentItemsState.some(i => i.id === itemId && i.groupId === groupId && i.source === source);

          if (!isAlreadySelected) {
            console.log(`DestinyPageHandler: Auto-selecting item "${itemId}" for Group ${groupId}.`);
            const inputElement = this.selectorPanel.querySelector(`.ability-card[data-item-id="${itemId}"][data-group-id="${groupId}"] input`);
            if (inputElement) {
              inputElement.checked = true;
              this._processParentItemSelection(itemId, groupId, source, itemDataType, groupDef.maxChoices, inputElement, true);
            }
          }
        });
      }
    });
  }

  /**
   * Refreshes the disabled and checked states of all item options.
   * @private
   */
  _refreshAbilityOptionStates() {
    // ... (This function needs generalization for equipment)
    console.log('DestinyPageHandler._refreshAbilityOptionStates: Updating all item option disabled states.');
    const currentState = this.stateManager.getState();

    this.selectorPanel.querySelectorAll('.ability-card').forEach(itemCard => {
      const itemId = itemCard.dataset.itemId;
      const groupId = itemCard.dataset.groupId;
      const source = itemCard.dataset.source;
      const itemType = itemCard.dataset.type;
      const maxChoicesForGroup = parseInt(itemCard.dataset.maxChoices, 10);
      
      let itemDef;
      let currentItemsState;

      if (itemType === 'equipment') {
          itemDef = this.stateManager.getInventoryItemDefinition(itemId);
          currentItemsState = currentState.inventory;
      } else {
          itemDef = this.stateManager.getAbilityOrFlawData(itemId, groupId);
          if (itemType === 'ability') currentItemsState = currentState.abilities;
          else if (itemType === 'flaw') currentItemsState = currentState.flaws;
          else if (itemType === 'perk') currentItemsState = currentState.perks;
      }

      if (!itemDef) {
        console.warn(`_refreshAbilityOptionStates: Missing itemDef for ${itemId}.`);
        return;
      }

      const parentItemState = currentItemsState.find(i => i.id === itemId && i.source === source && i.groupId === groupId);
      const isParentItemCurrentlySelected = !!parentItemState;
      
      itemCard.classList.toggle('selected', isParentItemCurrentlySelected);

      const mainItemInput = itemCard.querySelector(`input[data-item="${itemId}"]`);
      if (mainItemInput) {
        const selectedItemsInThisGroup = currentItemsState.filter(i => i.groupId === groupId && i.source === source);
        const countSelectedInGroup = selectedItemsInThisGroup.length;

        let shouldMainInputBeDisabled = false;
        if (maxChoicesForGroup > 1 && countSelectedInGroup >= maxChoicesForGroup && !isParentItemCurrentlySelected) {
          shouldMainInputBeDisabled = true;
        }

        mainItemInput.disabled = shouldMainInputBeDisabled;
        mainItemInput.checked = isParentItemCurrentlySelected;
        
        itemCard.classList.toggle('disabled-for-selection', shouldMainInputBeDisabled);
      }

      // Now handle nested options within this item card
      const optionsContainer = itemCard.querySelector('.ability-options'); // This class is used for nested options in destiny page
      if (optionsContainer && itemDef && itemDef.options) {
        optionsContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(optionInput => {
          const optionId = optionInput.dataset.option;
          // IMPORTANT: Check against the current state's selections for this specific parent item
          const isOptionSelected = parentItemState ? parentItemState.selections.some(s => s.id === optionId) : false;

          let shouldBeDisabled = false;

          // Nested options are disabled if their parent card is not currently selected
          if (!isParentItemCurrentlySelected) {
            shouldBeDisabled = true;
            // If parent is not selected, its nested options should not be checked
            if (optionInput.checked) {
              optionInput.checked = false; // Force uncheck
            }
          } else {
            const currentNestedSelectionsCount = parentItemState.selections.length;
            const maxChoicesForOption = itemDef.maxChoices; // This refers to nested options' maxChoices

            if (optionInput.type === 'radio') {
              shouldBeDisabled = false; // Radio options are always selectable if parent is selected
            } else { // Nested Checkbox logic (maxChoices >= 2 for nested options)
              // Disable if max choices for nested options are met AND this specific option is NOT already selected
              if (maxChoicesForOption !== undefined && maxChoicesForOption !== null &&
                  currentNestedSelectionsCount >= maxChoicesForOption && !isOptionSelected) {
                shouldBeDisabled = true;
              } else {
                shouldBeDisabled = false;
              }
            }
          }
          // Apply the determined disabled state
          optionInput.disabled = shouldBeDisabled;
          // ALWAYS set the checked state based on the current state. This is the crucial part.
          optionInput.checked = isOptionSelected;
        });
      } else if (optionsContainer) {
        console.debug(`_refreshAbilityOptionStates: Item ${itemId} has optionsContainer but no options in itemDef, or vice versa.`);
      }
    });
    this.pageNavigator.updateNav();
  }

  /**
   * Cleans up event listeners when the page is unloaded.
   */
  cleanup() {
    console.log('DestinyPageHandler.cleanup: Cleaning up destiny page resources.');
    if (this._boundDestinyOptionClickHandler) {
      this.selectorPanel.removeEventListener('click', this._boundDestinyOptionClickHandler);
      this._boundDestinyOptionClickHandler = null;
    }
    if (this._boundAbilityCardClickHandler) {
      this.selectorPanel.removeEventListener('click', this._boundAbilityCardClickHandler);
      this._boundAbilityCardClickHandler = null;
    }
    if (this._boundAbilityOptionChangeHandler) {
      this.selectorPanel.removeEventListener('change', this._boundAbilityOptionChangeHandler);
      this._boundAbilityOptionChangeHandler = null;
    }
  }
}

export { DestinyPageHandler };