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
      // Filter out only 'destiny' type flaws (now based on source and groupId 'flaws')
      this.stateManager.set('flaws', this.stateManager.get('flaws').filter(f => f.source !== 'destiny' || f.groupId !== 'flaws'));
      // Filter out only 'destiny' type perks
      this.stateManager.set('perks', this.stateManager.get('perks').filter(p => p.source !== 'destiny' || p.groupId !== 'perks'));


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

    const itemId = abilityCard.dataset.itemId; // Can be abilityId or flawId or perkId
    const groupId = abilityCard.dataset.groupId;
    const source = abilityCard.dataset.source;
    const itemType = abilityCard.dataset.type; // 'ability', 'flaw', or 'perk'
    const maxChoices = parseInt(abilityCard.dataset.maxChoices, 10);

    // This is the main input (radio/checkbox) for the parent ability/flaw/perk card
    const inputElement = abilityCard.querySelector(`input[data-item="${itemId}"][data-group="${groupId}"][data-source="${source}"][data-type="${itemType}"]`);
    if (!inputElement) {
      console.warn('DestinyPageHandler: Could not find associated input for clicked ability/flaw/perk card.');
      return;
    }

    // If the card is visually disabled, prevent any clicks on it.
    if (abilityCard.classList.contains('disabled-for-selection')) {
        console.log(`Click prevented on disabled ${itemType} card: ${itemId}`);
        e.preventDefault(); // Prevent default checkbox/radio toggle
        return;
    }

    const currentState = this.stateManager.getState();
    const currentItemsInState = itemType === 'ability' ? currentState.abilities : (itemType === 'flaw' ? currentState.flaws : currentState.perks);
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
            inputElement.checked = true; // This 'inputElement' refers to the main parent ability/flaw/perk input
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
   * Helper function to encapsulate parent item (ability or flaw or perk) selection/deselection logic.
   * @param {string} itemId - The ID of the ability or flaw or perk being selected.
   * @param {string} groupId - The ID of the group the item belongs to.
   * @param {string} source - The source of the item (e.g., 'destiny').
   * @param {string} itemType - 'ability', 'flaw', or 'perk'.
   * @param {number} maxChoices - The max choices for the item's group.
   * @param {HTMLInputElement} inputElement - The main item's checkbox/radio input.
   * @param {boolean} intendedSelectionState - The desired checked state for the parent item.
   * @private
   */
  _processParentItemSelection(itemId, groupId, source, itemType, maxChoices, inputElement, intendedSelectionState) {
    console.log(`_processParentItemSelection: Processing ${itemType} ${itemId} with intended state: ${intendedSelectionState}.`);
    const currentState = this.stateManager.getState();
    let currentItems = itemType === 'ability' ? [...currentState.abilities] : (itemType === 'flaw' ? [...currentState.flaws] : [...currentState.perks]);
    const isCurrentlyInState = currentItems.some(i => i.id === itemId && i.groupId === groupId && i.source === source);

    const itemCard = inputElement.closest('.ability-card'); // Still uses .ability-card class

    // Handle same ID, different source for flaws
    if (itemType === 'flaw' && intendedSelectionState) {
        let currentFlaws = this.stateManager.get('flaws');
        const conflictingFlaws = currentFlaws.filter(f => f.id === itemId && f.source !== source);

        if (conflictingFlaws.length > 0) {
            console.log(`_processParentItemSelection: Conflict detected for flaw "${itemId}". Removing existing flaws with the same ID but different sources.`, conflictingFlaws);
            // Remove all conflicting flaws before adding the new one.
            currentFlaws = currentFlaws.filter(f => !(f.id === itemId && f.source !== source));
            this.stateManager.set('flaws', currentFlaws);
            // Update currentItems local variable to reflect the state change for flaws
            currentItems = currentFlaws;
        }
    }

    if (maxChoices === 1) { // Radio button behavior for the group
      if (intendedSelectionState) {
        // Filter out any existing selections from this group (for this source and group ID)
        const filteredItems = currentItems.filter(i => !(i.groupId === groupId && i.source === source));
        filteredItems.push({ id: itemId, selections: [], source: source, groupId: groupId });

        if (itemType === 'ability') {
            this.stateManager.set('abilities', filteredItems);
        } else if (itemType === 'flaw') {
            this.stateManager.set('flaws', filteredItems);
        } else { // perk
            this.stateManager.set('perks', filteredItems);
        }

        // Update visual 'selected' class for all items within the same group
        this.selectorPanel.querySelectorAll(`.ability-card[data-group-id="${groupId}"][data-source="${source}"]`).forEach(card => {
          card.classList.remove('selected');
        });
        itemCard.classList.add('selected');
        inputElement.checked = true; // Ensure the radio is checked
      } else { // If user tried to deselect a radio, but it's not supported, re-check it
          inputElement.checked = true;
          console.log(`_processParentItemSelection: Cannot deselect radio button for ${itemType} ${itemId}. Re-checking.`);
      }
    } else { // Checkbox behavior for the group
      if (intendedSelectionState && !isCurrentlyInState) { // Selecting
        const selectedItemsInGroup = currentItems.filter(i => i.groupId === groupId && i.source === source);
        if (selectedItemsInGroup.length < maxChoices) {
          currentItems.push({ id: itemId, selections: [], source: source, groupId: groupId });
          
          if (itemType === 'ability') {
            this.stateManager.set('abilities', currentItems);
          } else if (itemType === 'flaw') {
            this.stateManager.set('flaws', currentItems);
          } else { // perk
            this.stateManager.set('perks', currentItems);
          }

          itemCard.classList.add('selected');
          inputElement.checked = true;
        } else {
          alerter.show(`You can only select up to ${maxChoices} ${itemType}${maxChoices === 1 ? '' : 's'} from this group.`);
          inputElement.checked = false; // Revert checkbox if max choices exceeded
          this._refreshAbilityOptionStates(); // Update UI immediately after failed selection
          return;
        }
      } else if (!intendedSelectionState && isCurrentlyInState) { // Deselecting
        currentItems = currentItems.filter(i => !(i.id === itemId && i.groupId === groupId && i.source === source));
        
        if (itemType === 'ability') {
            this.stateManager.set('abilities', currentItems);
        } else if (itemType === 'flaw') {
            this.stateManager.set('flaws', currentItems);
        } else { // perk
            this.stateManager.set('perks', currentItems);
        }

        itemCard.classList.remove('selected');
        inputElement.checked = false;
      } else {
          console.log(`_processParentItemSelection: Click on ${itemId} resulted in no state change (current: ${isCurrentlyInState}, intended: ${intendedSelectionState}).`);
      }
    }

    console.log(`_processParentItemSelection: ${itemType} state updated for ${itemId}.`);
    this.informerUpdater.update('destiny');
    this.pageNavigator.updateNav();
    this._refreshAbilityOptionStates(); // Crucial: Re-sync all UI elements with state after every change
  }

  /**
   * Handles change event on nested ability/flaw/perk option checkboxes/radio buttons.
   * @param {Event} e - The change event.
   * @private
   */
  _handleAbilityOptionChange(e) {
    // Ensure the event target is an input with data-option (i.e., a nested option)
    if (!e.target.matches('input[data-option]')) {
      return;
    }

    const optionInput = e.target;
    const itemId = optionInput.dataset.item;
    const optionId = optionInput.dataset.option;
    const parentItemCard = optionInput.closest('.ability-card'); // Parent card provides context
    const groupId = parentItemCard.dataset.groupId;
    const source = parentItemCard.dataset.source;
    const itemType = parentItemCard.dataset.type; // 'ability', 'flaw', or 'perk'
    
    const isSelectedFromInput = optionInput.checked; // This is the actual checked state after user interaction

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
    const parentStateArray = itemType === 'ability' ? currentState.abilities : (itemType === 'flaw' ? currentState.flaws : currentState.perks);
    
    // Find the specific parent item (ability or flaw) by ID, source, and groupId
    const parentItemState = parentStateArray.find(i => i.id === itemId && i.source === source && i.groupId === groupId);

    if (!parentItemState) {
      console.warn(`DestinyPageHandler._handleNestedOptionSelection: Parent ${itemType} '${itemId}' (source: ${source}, group: ${groupId}) NOT FOUND IN STATE. Cannot select nested option. This might be due to timing issues.`);
      inputElement.checked = false; // Ensure UI reflects lack of parent in state
      this._refreshAbilityOptionStates();
      return;
    }

    const parentItemDef = this.stateManager.getAbilityOrFlawData(itemId, groupId);
    let newSelections = [...parentItemState.selections];

    const isOptionCurrentlyInState = parentItemState.selections.some(s => s.id === optionId);

    if (inputElement.type === 'radio') {
      newSelections = [{ id: optionId }];
    } else { // Checkbox logic
      if (isOptionCurrentlyInState && !isSelectedFromInput) { // Option is currently selected, user clicked to DESELECT
        console.log(`_handleNestedOptionSelection: Deselecting checkbox option ${optionId}.`);
        newSelections = newSelections.filter(s => s.id !== optionId);
      } else if (!isOptionCurrentlyInState && isSelectedFromInput) { // Option is NOT currently selected, user clicked to SELECT
        console.log(`_handleNestedOptionSelection: Selecting checkbox option ${optionId}.`);
        // Check if adding this selection would exceed maxChoices for options
        if (parentItemDef.maxChoices !== undefined && parentItemDef.maxChoices !== null &&
            newSelections.length >= parentItemDef.maxChoices) {
          inputElement.checked = false; // Revert checkbox state if over limit
          alerter.show(`You can only select up to ${parentItemDef.maxChoices} option(s) for ${parentItemDef.name}.`);
          this._refreshAbilityOptionStates(); // Call refresh to enforce UI consistency
          return; // IMPORTANT: Exit here as we've handled the limit and reverted the UI
        }
        newSelections.push({ id: optionId });
      } else {
        console.log(`_handleNestedOptionSelection: Click on option ${optionId} resulted in no state change (current: ${isOptionCurrentlyInState}, input: ${isSelectedFromInput}).`);
      }
    }
    
    // Update the parent item's selections array in the state
    if (itemType === 'ability') {
        this.stateManager.updateAbilitySelections(itemId, source, groupId, newSelections);
    } else if (itemType === 'flaw') {
        this.stateManager.updateFlawSelections(itemId, source, groupId, newSelections);
    } else { // perk
        this.stateManager.updatePerkSelections(itemId, source, groupId, newSelections);
    }
    
    console.log(`_handleNestedOptionSelection: Selections updated for ${itemType} ${itemId}:`, newSelections);
    this.informerUpdater.update('destiny');
    this.pageNavigator.updateNav();
    this._refreshAbilityOptionStates(); // Ensure this refresh happens AFTER state updates
  }

  /**
   * Restores the selections for destiny, flaws, and abilities based on the current state.
   * @private
   */
  _restoreState() {
    console.log('DestinyPageHandler._restoreState: Restoring page state.');
    const currentState = this.stateManager.getState();

    // Restore selected destiny option
    if (currentState.destiny) {
      const destinyOptionDiv = this.selectorPanel.querySelector(`.destiny-option[data-destiny-id="${currentState.destiny}"]`);
      if (destinyOptionDiv) {
        destinyOptionDiv.classList.add('selected');
        console.log(`DestinyPageHandler._restoreState: Destiny option "${currentState.destiny}" re-selected.`);
      }
    }

    // Restore selected ability/flaw/perk cards and their inputs (only those from 'destiny' source)
    const itemsToRestore = [...currentState.abilities, ...currentState.flaws, ...currentState.perks];

    itemsToRestore.forEach(itemState => {
      // Ensure we only restore items originating from this page ('destiny')
      if (itemState.source === 'destiny') {
        const itemCard = this.selectorPanel.querySelector(
          `.ability-card[data-item-id="${itemState.id}"][data-group-id="${itemState.groupId}"][data-source="${itemState.source}"]`
        );
        if (itemCard) {
          itemCard.classList.add('selected');
          
          const destinyDefinition = this.stateManager.getDestiny(currentState.destiny);
          const groupDef = destinyDefinition?.abilityGroups?.[itemState.groupId];
          const inputType = groupDef?.maxChoices === 1 ? 'radio' : 'checkbox';
          
          // Select the correct main input element within the card
          const inputElement = itemCard.querySelector(`input[type="${inputType}"][data-item="${itemState.id}"][data-group="${itemState.groupId}"][data-source="${itemState.source}"]`);

          if (inputElement) {
            inputElement.checked = true;
          }
          console.log(`DestinyPageHandler._restoreState: Item card "${itemState.id}" (Group ${itemState.groupId}, Source: ${itemState.source}) re-selected.`);

          // Restore nested options
          if (itemState.selections && itemState.selections.length > 0) {
            itemState.selections.forEach(option => {
              // Select the correct nested option input
              const optionInput = itemCard.querySelector(`input[data-item="${itemState.id}"][data-option="${option.id}"]`);
              if (optionInput) {
                optionInput.checked = true;
              }
            });
          }
        }
      }
    });

    this._autoSelectAbilitiesInGroup(); // Re-run auto-selection on restore
    this._refreshAbilityOptionStates(); // Crucial to update disabled states based on selections
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
    // Remove old abilities section if it exists and no destiny is selected
    if (!this.stateManager.get('destiny')) {
        if (abilitiesSection) abilitiesSection.remove();
        return;
    }

    const destiny = this.stateManager.getDestiny(this.stateManager.get('destiny'));
    if (!destiny || !destiny.abilityGroups) {
        console.warn('DestinyPageHandler: No destiny data or ability groups to render items.');
        if (abilitiesSection) abilitiesSection.remove(); // Ensure section is gone if no data
        return;
    }

    const container = document.createElement('div');
    container.className = 'abilities-section';
    container.innerHTML = '<h4>Choose Your Character Features</h4>'; // More general header

    const currentState = this.stateManager.getState();

    Object.entries(destiny.abilityGroups).forEach(([groupId, groupDef]) => {
      // Determine if this is the special "flaws" group or "perks" group
      const isFlawGroup = groupId === 'flaws';
      const isPerkGroup = groupId === 'perks';

      const maxChoicesText = groupDef.maxChoices === 1 ? 'Choose 1' : `Choose ${groupDef.maxChoices}`;
      container.innerHTML += `<h5 class="group-header">${groupDef.name} (${maxChoicesText})</h5>`;

      const groupGridContainer = document.createElement('div');
      groupGridContainer.className = 'abilities-grid-container';

      groupDef.abilities.forEach(itemId => { // itemId can be abilityId, flawId, or perkId
        const item = this.stateManager.getAbilityOrFlawData(itemId, groupId); // Get the item data (ability or flaw or perk)
        if (!item) {
          console.warn(`DestinyPageHandler: Missing item data: ${itemId} in group ${groupId}`);
          return;
        }

        // Determine which state array to check for selection
        let currentItemsState;
        let itemDataType;
        if (isFlawGroup) {
          currentItemsState = currentState.flaws;
          itemDataType = 'flaw';
        } else if (isPerkGroup) {
          currentItemsState = currentState.perks;
          itemDataType = 'perk';
        } else {
          currentItemsState = currentState.abilities;
          itemDataType = 'ability';
        }

        const isSelected = currentItemsState.some(i =>
          i.id === itemId && i.groupId === groupId && i.source === 'destiny'
        );

        const itemTypeClass = item.type === 'active' ? 'active' : (item.type === 'passive' ? 'passive' : '');
        const inputType = groupDef.maxChoices === 1 ? 'radio' : 'checkbox';
        const inputName = groupDef.maxChoices === 1 ? `name="group-${groupId}"` : ''; // Radios need a name for exclusivity

        groupGridContainer.innerHTML += `
          <div class="ability-container">
              <div class="ability-card ${isSelected ? 'selected' : ''}"
                   data-item-id="${itemId}"
                   data-group-id="${groupId}"
                   data-max-choices="${groupDef.maxChoices}"
                   data-source="destiny"
                   data-type="${itemDataType}"> <div class="ability-header">
                      <label>
                          <input type="${inputType}" ${inputName}
                              ${isSelected ? 'checked' : ''}
                              data-item="${itemId}"
                              data-group="${groupId}"
                              data-source="destiny"
                              data-type="${itemDataType}"> <span class="ability-name">${item.name}</span>
                      </label>
                      <div class="ability-types">
                          <span class="type-tag ${itemTypeClass}">${this._getTypeIcon(item.type)} ${item.type}</span>
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

    // Append or replace abilities section directly into the new scroll area
    const destinyScrollArea = this.selectorPanel.querySelector('.destiny-content-scroll-area');
    if (destinyScrollArea) {
        const existingAbilitiesSection = destinyScrollArea.querySelector('.abilities-section');
        if (existingAbilitiesSection) {
            existingAbilitiesSection.replaceWith(container);
            console.log('DestinyPageHandler: Replaced existing abilities section within scroll area.');
        } else {
            destinyScrollArea.appendChild(container);
            console.log('DestinyPageHandler: Appended new abilities section within scroll area.');
        }
    } else {
        console.error('DestinyPageHandler: Could not find .destiny-content-scroll-area. Abilities section may not be rendered correctly.');
        // Fallback to appending to selectorPanel directly if scroll area is missing (less ideal)
        this.selectorPanel.appendChild(container);
    }
  }

  /**
   * Helper function to get type icons for abilities.
   * @param {string} type - The type of item (e.g., 'Combat', 'Passive', 'flaw', 'perk').
   * @returns {string} The corresponding emoji icon.
   * @private
   */
  _getTypeIcon(type) {
    const icons = {
      'Combat': '⚔️',
      'Spell': '🔮',
      'Support': '🛡️',
      'Social': '💬',
      'Holy': '✨',
      'Healing': '❤️',
      'Performance': '🎤',
      'Utility': '🛠️',
      'Passive': '⭐',
      'Active': '⚡',
      'flaw': '💔', // Icon for flaws
      'perk': '✨' // Icon for perks
    };
    return icons[type] || '✨';
  }

  /**
   * Helper function to render ability descriptions with interpolated values.
   * @param {Object} item - The ability, flaw, or perk option object.
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
   * Helper function to render options (checkboxes/radio buttons) nested within an item (ability or flaw or perk).
   * @param {Object} parentItemDef - The parent item's definition object (ability or flaw or perk).
   * @param {string} itemId - The ID of the parent item.
   * @param {string} groupId - The ID of the group the parent item belongs to.
   * @param {string} source - The source of the parent item.
   * @param {string} itemType - 'ability', 'flaw', or 'perk'.
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
   * Auto-selects abilities/flaws/perks if a group has a specific configuration (e.g., maxChoices === number of items).
   * @private
   */
  _autoSelectAbilitiesInGroup() {
    const currentState = this.stateManager.getState();
    if (!currentState.destiny) return;

    const destiny = this.stateManager.getDestiny(currentState.destiny);
    if (!destiny || !destiny.abilityGroups) return;

    Object.entries(destiny.abilityGroups).forEach(([groupId, groupDef]) => {
      if (groupDef.maxChoices > 0 && groupDef.maxChoices === groupDef.abilities.length) {
        const isFlawGroup = groupId === 'flaws';
        const isPerkGroup = groupId === 'perks';
        groupDef.abilities.forEach(itemId => {
          const source = 'destiny'; 

          let currentItemsState;
          let itemDataType;
          if (isFlawGroup) {
            currentItemsState = currentState.flaws;
            itemDataType = 'flaw';
          } else if (isPerkGroup) {
            currentItemsState = currentState.perks;
            itemDataType = 'perk';
          } else {
            currentItemsState = currentState.abilities;
            itemDataType = 'ability';
          }

          const isAlreadySelected = currentItemsState.some(i =>
            i.id === itemId && i.groupId === groupId && i.source === source
          );

          if (!isAlreadySelected) {
            console.log(`DestinyPageHandler: Auto-selecting item "${itemId}" for Group ${groupId} (Source: ${source}) due to maxChoices matching item count.`);
            const inputElement = this.selectorPanel.querySelector(
              `.ability-card[data-item-id="${itemId}"][data-group-id="${groupId}"][data-source="${source}"] input[data-item]`
            );
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
   * Refreshes the disabled and checked states of all ability/flaw/perk options (checkboxes/radio buttons).
   * This is crucial after any state change that affects item selections.
   * @private
   */
  _refreshAbilityOptionStates() {
    console.log('DestinyPageHandler._refreshAbilityOptionStates: Updating all item option disabled states.');
    const currentState = this.stateManager.getState();

    // Iterate over all ability-cards (this class is used for abilities, flaws, and perks on this page)
    this.selectorPanel.querySelectorAll('.ability-card').forEach(itemCard => {
      const itemId = itemCard.dataset.itemId;
      const groupId = itemCard.dataset.groupId;
      const source = itemCard.dataset.source;
      const itemType = itemCard.dataset.type; // 'ability', 'flaw', or 'perk'
      const maxChoicesForGroup = parseInt(itemCard.dataset.maxChoices, 10);

      const itemDef = this.stateManager.getAbilityOrFlawData(itemId, groupId);
      if (!itemDef) {
        console.warn(`_refreshAbilityOptionStates: Missing itemDef for ${itemId} (Type: ${itemType}, Group: ${groupId}). Skipping updates for its options.`);
        return;
      }

      // Determine which state array to use
      const currentItemsState = itemType === 'ability' ? currentState.abilities : (itemType === 'flaw' ? currentState.flaws : currentState.perks);
      const parentItemState = currentItemsState.find(i => i.id === itemId && i.source === source && i.groupId === groupId);
      const isParentItemCurrentlySelected = !!parentItemState;

      // Update parent item card visual 'selected' state
      if (isParentItemCurrentlySelected) {
        itemCard.classList.add('selected');
      } else {
        itemCard.classList.remove('selected');
      }

      // Handle the main item input (radio/checkbox for selecting the item itself within the group)
      const mainItemInput = itemCard.querySelector(`input[data-item="${itemId}"][data-group="${groupId}"][data-source="${source}"][data-type="${itemType}"]`);
      if (mainItemInput) {
        const selectedItemsInThisGroup = currentItemsState.filter(i => i.groupId === groupId && i.source === source);
        const countSelectedInGroup = selectedItemsInThisGroup.length;

        // Determine if the main input should be disabled
        let shouldMainInputBeDisabled = false;
        if (maxChoicesForGroup === 1) { // Radio button group
          // Radio buttons are generally not "disabled" for selection unless the whole group is unavailable.
          // They are simply checked/unchecked based on selection.
          shouldMainInputBeDisabled = false; // Always enabled for selection in its group
        } else { // Checkbox group (maxChoices >= 2)
          // Disable if the group is full AND this specific item is NOT currently selected
          if (countSelectedInGroup >= maxChoicesForGroup && !isParentItemCurrentlySelected) {
            shouldMainInputBeDisabled = true;
          }
        }
        mainItemInput.disabled = shouldMainInputBeDisabled;
        mainItemInput.checked = isParentItemCurrentlySelected; // Always sync checked state with actual state

        // Apply visual disabled class to the card if the main input is disabled
        if (shouldMainInputBeDisabled) {
            itemCard.classList.add('disabled-for-selection');
        } else {
            itemCard.classList.remove('disabled-for-selection');
        }
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
   * This method is called by CharacterWizard.loadPage to detach listeners
   * before new page content is loaded.
   */
  cleanup() {
    console.log('DestinyPageHandler.cleanup: Cleaning up destiny page resources.');
    if (this._boundDestinyOptionClickHandler) {
      this.selectorPanel.removeEventListener('click', this._boundDestinyOptionClickHandler);
      this._boundDestinyOptionClickHandler = null; // Clear reference
    }
    if (this._boundAbilityCardClickHandler) {
      this.selectorPanel.removeEventListener('click', this._boundAbilityCardClickHandler);
      this._boundAbilityCardClickHandler = null; // Clear reference
    }
    if (this._boundAbilityOptionChangeHandler) {
      this.selectorPanel.removeEventListener('change', this._boundAbilityOptionChangeHandler);
      this._boundAbilityOptionChangeHandler = null; // Clear reference
    }
  }
}

export { DestinyPageHandler };
