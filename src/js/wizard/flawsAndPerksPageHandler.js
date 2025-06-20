// flawsAndPerksPageHandler.js
// This module handles the UI rendering and event handling for both 'flaws' and 'perks' selection pages.

import { alerter } from '../alerter.js'; // Assuming alerter.js is available

class FlawsAndPerksPageHandler { // Renamed class
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
    this.selectorPanel = null; // Will be set when setupPage is called

    // Store bound event handlers for proper removal
    this._boundCardClickHandler = null;
    this._boundNestedOptionChangeHandler = null;

    console.log('FlawsAndPerksPageHandler: Initialized.');
  }

  /**
   * Sets up the flaws and perks page by rendering options and attaching event listeners.
   * This method is called by the main CharacterWizard when the 'flaws-and-perks' page is loaded.
   * @param {HTMLElement} selectorPanel - The DOM element for the selector panel.
   * @param {HTMLElement} informerPanel - The DOM element for the informer panel (not directly used here).
   */
  setupPage(selectorPanel, informerPanel) {
    this.selectorPanel = selectorPanel;
    console.log('FlawsAndPerksPageHandler.setupPage: Setting up flaws and perks page events and rendering content.');

    this._renderItems(); // Render initial flaw and perk options
    this._attachEventListeners();
    this._restoreState(); // Restore state for independently selected flaws and perks

    this.informerUpdater.update('flaws-and-perks'); // Update informer with current flaw/perk state
    this.pageNavigator.updateNav();      // Update navigation based on completion
  }

  /**
   * Attaches all necessary event listeners to the selector panel.
   * @private
   */
  _attachEventListeners() {
    // Remove existing listeners to prevent duplicates if setupPage is called multiple times
    this.selectorPanel.removeEventListener('click', this._boundCardClickHandler);
    this.selectorPanel.removeEventListener('change', this._boundNestedOptionChangeHandler);

    // Bind event handlers to the class instance
    this._boundCardClickHandler = this._handleCardClick.bind(this);
    this.selectorPanel.addEventListener('click', this._boundCardClickHandler);

    this._boundNestedOptionChangeHandler = this._handleNestedOptionChange.bind(this);
    this.selectorPanel.addEventListener('change', this._boundNestedOptionChangeHandler);

    console.log('FlawsAndPerksPageHandler: All event listeners attached.');
  }

  /**
   * Handles click on flaw or perk cards (checkbox inputs).
   * @param {Event} e - The click event.
   * @private
   */
  _handleCardClick(e) {
    const card = e.target.closest('.flaw-card, .perk-card');
    if (!card) return;

    const itemId = card.dataset.itemId;
    const source = card.dataset.source; // Should be 'independent-flaw' or 'independent-perk'
    const itemType = card.dataset.type; // 'flaw' or 'perk'

    // IMPORTANT: Check if the card is disabled by another source first
    if (card.classList.contains('disabled-by-other-source')) {
      this.alerter.show(`'${itemId}' is already selected from another section and cannot be independently chosen.`, 'info');
      e.preventDefault(); // Prevent default checkbox toggle
      return;
    }

    const maxChoicesForParent = Infinity; // Independent selection has no limit from parent group

    const inputElement = card.querySelector(`input[data-item="${itemId}"][data-source="${source}"][data-type="${itemType}"]`);
    if (!inputElement) {
      console.warn(`FlawsAndPerksPageHandler: Could not find associated input for clicked ${itemType} card.`);
      return;
    }

    // If the card is visually disabled (e.g., due to perk weight limits), prevent clicks.
    if (card.classList.contains('disabled-for-selection')) {
        console.log(`Click prevented on disabled ${itemType} card: ${itemId}`);
        return;
    }

    const currentState = this.stateManager.getState();
    const currentItemsInState = (itemType === 'flaw' ? currentState.flaws : currentState.perks).filter(item => item.source === source);
    const isParentItemCurrentlySelected = currentItemsInState.some(item => item.id === itemId);

    const mainLabel = inputElement.closest('label');
    const isClickOnMainInputOrLabel = (e.target === inputElement || (mainLabel && mainLabel.contains(e.target)));

    const isClickOnNestedOptionArea = e.target.closest('.flaw-options-nested, .perk-options-nested');
    const clickedNestedOptionInput = e.target.closest('input[data-option]');

    // --- SCENARIO 1: Clicked anywhere within the nested options area ---
    if (isClickOnNestedOptionArea) {
        console.log(`_handleCardClick: Click in nested option area for ${itemId}.`);
        if (!isParentItemCurrentlySelected) {
            console.log(`_handleCardClick: Parent ${itemType} ${itemId} not selected. Selecting parent first.`);
            inputElement.checked = true;
            this._processParentItemSelection(itemId, source, itemType, maxChoicesForParent, inputElement, true);
        }

        if (clickedNestedOptionInput) {
            console.log(`_handleCardClick: Dispatching change event for nested option ${clickedNestedOptionInput.dataset.option}.`);
            // Using setTimeout to ensure the parent item state update (if any)
            // has propagated before the nested option change is processed.
            setTimeout(() => {
                clickedNestedOptionInput.dispatchEvent(new Event('change', { bubbles: true }));
            }, 0);
        }
        return;
    }

    // --- SCENARIO 2: Clicked on main item card (input, label, or other parts *outside* nested options) ---
    console.log(`_handleCardClick: Click on main ${itemType} card for ${itemId}.`);
    let intendedSelectionState;
    if (isClickOnMainInputOrLabel) {
        intendedSelectionState = inputElement.checked;
    } else {
        intendedSelectionState = !inputElement.checked;
        inputElement.checked = intendedSelectionState;
    }
    this._processParentItemSelection(itemId, source, itemType, maxChoicesForParent, inputElement, intendedSelectionState);
  }

  /**
   * Helper function to encapsulate parent item (flaw or perk) selection/deselection logic.
   * @param {string} itemId - The ID of the item being selected.
   * @param {string} source - The source of the item (e.g., 'independent-flaw', 'independent-perk').
   * @param {string} itemType - 'flaw' or 'perk'.
   * @param {number} maxChoicesForParent - The max choices for the parent item (Infinity for this page).
   * @param {HTMLInputElement} inputElement - The main item's checkbox input.
   * @param {boolean} intendedSelectionState - The desired checked state for the parent item.
   * @private
   */
  _processParentItemSelection(itemId, source, itemType, maxChoicesForParent, inputElement, intendedSelectionState) {
    console.log(`_processParentItemSelection: Processing ${itemType} ${itemId} with intended state: ${intendedSelectionState}. Source: ${source}`);
    
    let currentItems = (itemType === 'flaw' ? this.stateManager.get('flaws') : this.stateManager.get('perks'));
    let independentItems = currentItems.filter(item => item.source === source);
    let otherItems = currentItems.filter(item => item.source !== source);

    const isCurrentlyInIndependentState = independentItems.some(item => item.id === itemId);

    const card = inputElement.closest('.flaw-card, .perk-card');

    if (intendedSelectionState && !isCurrentlyInIndependentState) { // Selecting
      const itemDef = this.stateManager.getAbilityOrFlawData(itemId, (itemType === 'flaw' ? 'flaws' : 'perks'));
      if (!itemDef) {
        console.error(`_processParentItemSelection: Item definition not found for ${itemType} ${itemId}.`);
        inputElement.checked = false;
        this._refreshItemOptionStates();
        return;
      }

      // NEW: Perk selection logic - check against flaw points
      if (itemType === 'perk') {
        const currentTotalFlawPoints = this.stateManager.getIndependentFlawTotalWeight();
        const currentTotalPerkPoints = this.stateManager.getIndependentPerkTotalWeight();
        if ((currentTotalPerkPoints + itemDef.weight) > currentTotalFlawPoints) {
          this.alerter.show(`You do not have enough Flaw Points (${currentTotalFlawPoints}) to select the perk '${itemDef.name}' (costs ${itemDef.weight} points). You need to select more flaws first.`, 'error');
          inputElement.checked = false; // Keep it unchecked
          this._refreshItemOptionStates();
          return;
        }
      }

      console.log(`_processParentItemSelection: Adding ${itemType} ${itemId} to independent selections.`);
      if (itemType === 'flaw') {
        // When adding, ensure selections array is initialized, even if empty.
        this.stateManager.addOrUpdateFlaw({ id: itemId, selections: [], source: source, groupId: null });
      } else { // perk
        this.stateManager.addOrUpdatePerk({ id: itemId, selections: [], source: source, groupId: null });
      }
      card.classList.add('selected');
      inputElement.checked = true;
    } else if (!intendedSelectionState && isCurrentlyInIndependentState) { // Deselecting
      console.log(`_processParentItemSelection: Removing ${itemType} ${itemId} from independent selections.`);
      if (itemType === 'flaw') {
        this.stateManager.removeFlaw(itemId, source, null);
      } else { // perk
        this.stateManager.removePerk(itemId, source, null);
      }
      card.classList.remove('selected');
      inputElement.checked = false;
    } else {
      console.log(`_processParentItemSelection: Click on ${itemId} resulted in no state change (current: ${isCurrentlyInIndependentState}, intended: ${intendedSelectionState}).`);
      inputElement.checked = isCurrentlyInIndependentState;
    }

    this.informerUpdater.update('flaws-and-perks');
    this.pageNavigator.updateNav();
    this._refreshItemOptionStates(); // Update UI for other cards as well
  }

  /**
   * Handles change event on nested flaw/perk option checkboxes/radio buttons.
   * @param {Event} e - The change event.
   * @private
   */
  _handleNestedOptionChange(e) {
    console.log('Nested option change event fired!', e.target); 
    const inputElement = e.target;

    const cardElement = inputElement.closest('.flaw-card, .perk-card');

    if (!cardElement || (cardElement.dataset.type !== 'flaw' && cardElement.dataset.type !== 'perk')) {
        console.debug('FlawsAndPerksPageHandler._handleNestedOptionChange: Event not from a Flaw/Perk card, ignoring.');
        return; // Ignore events not originating from a flaw or perk card
    }

    const optionId = inputElement.value; // Assuming option value is its ID
    const itemId = cardElement.dataset.itemId;
    const itemSource = cardElement.dataset.source;
    const itemType = cardElement.dataset.type;

    let parentItemState;
    const currentState = this.stateManager.getState(); // Get the current state
    if (itemType === 'flaw') {
        // CORRECTED: Get the actual flaw object from the state.flaws array
        parentItemState = currentState.flaws.find(f => f.id === itemId && f.source === itemSource && f.groupId === null);
    } else if (itemType === 'perk') {
        // CORRECTED: Get the actual perk object from the state.perks array
        parentItemState = currentState.perks.find(p => p.id === itemId && p.source === itemSource && p.groupId === null);
    } else {
        console.error(`FlawsAndPerksPageHandler._handleNestedOptionChange: Logic error: Reached unexpected itemType: ${itemType}`);
        return;
    }

    if (!parentItemState) {
        console.warn(`FlawsAndPerksPageHandler._handleNestedOptionChange: Parent item '${itemId}' (source: ${itemSource}, type: ${itemType}) NOT FOUND IN STATE. Cannot update nested option.`);
        inputElement.checked = false; 
        this._refreshItemOptionStates();
        return;
    }

    if (!Array.isArray(parentItemState.selections)) {
        parentItemState.selections = [];
    }

    const isOptionSelected = parentItemState.selections.includes(optionId);

    if (inputElement.type === 'radio') {
        if (inputElement.checked) {
            parentItemState.selections = [optionId];
        }
    } else { // Checkbox
        if (inputElement.checked) {
            if (!isOptionSelected) {
                const parentItemDef = this.stateManager.getAbilityOrFlawData(itemId, itemType === 'flaw' ? 'flaws' : 'perks');
                if (parentItemDef && parentItemDef.maxChoices !== undefined && parentItemDef.maxChoices !== null &&
                    parentItemState.selections.length >= parentItemDef.maxChoices) {
                    this.alerter.show(`You can only select up to ${parentItemDef.maxChoices} option(s) for ${parentItemDef.name}.`, 'warning');
                    inputElement.checked = false;
                    this._refreshItemOptionStates();
                    return;
                }
                parentItemState.selections.push(optionId);
            }
        } else {
            if (isOptionSelected) {
                parentItemState.selections = parentItemState.selections.filter(s => s !== optionId);
            }
        }
    }
    
    // DEBUG LOGS (Keep them for now for verification)
    console.log('DEBUG: parentItemState AFTER updating selections but BEFORE calling stateManager.addOrUpdateFlaw/Perk:', JSON.stringify(parentItemState));
    console.log('DEBUG: parentItemState.selections AFTER updating selections but BEFORE calling stateManager.addOrUpdateFlaw/Perk:', JSON.stringify(parentItemState.selections));

    // Update the state manager with the modified parent item state
    if (itemType === 'flaw') {
        this.stateManager.addOrUpdateFlaw(parentItemState);
    } else if (itemType === 'perk') {
        this.stateManager.addOrUpdatePerk(parentItemState);
    }

    this._refreshItemOptionStates();
    this.informerUpdater.update('flaws-and-perks');
    this.pageNavigator.updateNav();
  }

  /**
   * Handles the selection/deselection of an option nested within a flaw or perk.
   * NOTE: This function appears to be a duplicate or previous version of logic
   * now primarily handled by _handleNestedOptionChange. It's not currently called
   * directly within _handleNestedOptionChange. Keeping it for reference, but its
   * usage should be reviewed if actual issues persist after fixing _handleNestedOptionChange.
   * @param {string} itemId - The ID of the parent item.
   * @param {string} source - The source of the parent item.
   * @param {string} itemType - 'flaw' or 'perk'.
   * @param {string} optionId - The ID of the option selected/deselected.
   * @param {boolean} isSelectedFromInput - True if the input element is checked after the user's interaction, false otherwise.
   * @param {HTMLElement} inputElement - The input element (checkbox/radio).
   * @private
   */
  _handleNestedOptionSelection(itemId, source, itemType, optionId, isSelectedFromInput, inputElement) {
    // This function seems to be an older approach or a helper not currently invoked directly
    // by the _handleNestedOptionChange event listener. The logic within _handleNestedOptionChange
    // itself is performing the state updates directly.
    console.warn("'_handleNestedOptionSelection' was called. This function might be deprecated or unused as _handleNestedOptionChange now handles updates directly.");

    const currentState = this.stateManager.getState();
    const parentItemState = (itemType === 'flaw' ? currentState.flaws : currentState.perks)
      .find(item => item.id === itemId && item.source === source);

    if (!parentItemState) {
      console.warn(`FlawsAndPerksPageHandler._handleNestedOptionSelection: Parent ${itemType} '${itemId}' (source: ${source}) NOT FOUND IN STATE. Cannot select nested option. This might be due to timing issues.`);
      inputElement.checked = false;
      this._refreshItemOptionStates();
      return;
    }

    const parentItemDef = this.stateManager.getAbilityOrFlawData(itemId, (itemType === 'flaw' ? 'flaws' : 'perks'));
    let newSelections = [...parentItemState.selections]; // Ensure selections are simple strings/IDs

    // Ensure the options stored in state are just the IDs (strings)
    const isOptionCurrentlyInState = parentItemState.selections.includes(optionId);


    if (inputElement.type === 'radio') {
      newSelections = [optionId]; // For radio, just store the single selected ID
    } else { // Checkbox
      if (isOptionCurrentlyInState && !isSelectedFromInput) {
        console.log(`_handleNestedOptionSelection: Deselecting checkbox option ${optionId} for ${itemType} ${itemId}.`);
        newSelections = newSelections.filter(s => s !== optionId);
      } else if (!isOptionCurrentlyInState && isSelectedFromInput) {
        console.log(`_handleNestedOptionSelection: Selecting checkbox option ${optionId} for ${itemType} ${itemId}.`);
        if (parentItemDef.maxChoices !== undefined && parentItemDef.maxChoices !== null &&
            newSelections.length >= parentItemDef.maxChoices) {
          inputElement.checked = false;
          this.alerter.show(`You can only select up to ${parentItemDef.maxChoices} option(s) for ${parentItemDef.name}.`);
          this._refreshItemOptionStates();
          return;
        }
        newSelections.push(optionId); // Add the ID as a string
      } else {
        console.log(`_handleNestedOptionSelection: Click on option ${optionId} for ${itemType} ${itemId} resulted in no state change (current: ${isOptionCurrentlyInState}, input: ${isSelectedFromInput}).`);
      }
    }
    
    if (itemType === 'flaw') {
      // Ensure the state manager updates the selections correctly
      this.stateManager.addOrUpdateFlaw({ ...parentItemState, selections: newSelections });
    } else { // perk
      this.stateManager.addOrUpdatePerk({ ...parentItemState, selections: newSelections });
    }
    
    console.log(`_handleNestedOptionSelection: Selections updated for ${itemType} ${itemId}:`,
      (itemType === 'flaw' ? this.stateManager.getState().flaws : this.stateManager.getState().perks)
        .find(f => f.id === itemId && f.source === source)?.selections);
    
    this.informerUpdater.update('flaws-and-perks');
    this.pageNavigator.updateNav();
    this._refreshItemOptionStates(); // Update all items, especially if perk limits are affected
  }

  /**
   * Restores the selections for independently chosen flaws and perks based on the current state.
   * @private
   */
  _restoreState() {
    console.log('FlawsAndPerksPageHandler._restoreState: Restoring page state for independent flaws and perks.'); 
    const currentState = this.stateManager.getState();

    // Restore Flaws
    const independentFlawsInState = currentState.flaws.filter(f => f.source === 'independent-flaw');
    independentFlawsInState.forEach(flawState => {
      const flawCard = this.selectorPanel.querySelector(
        `.flaw-card[data-item-id="${flawState.id}"][data-source="${flawState.source}"]`
      );
      if (flawCard) {
        flawCard.classList.add('selected');
        const inputElement = flawCard.querySelector(`input[data-item="${flawState.id}"][data-source="${flawState.source}"]`);
        if (inputElement) {
          inputElement.checked = true;
        }
        console.log(`FlawsAndPerksPageHandler._restoreState: Independent flaw card "${flawState.id}" re-selected.`); 
        if (flawState.selections && flawState.selections.length > 0) {
          // Iterate over string IDs, not objects
          flawState.selections.forEach(optionId => {
            const optionInput = flawCard.querySelector(`input[data-item="${flawState.id}"][data-option="${optionId}"]`);
            if (optionInput) {
              optionInput.checked = true;
            }
          });
        }
      }
    });

    // Restore Perks
    const independentPerksInState = currentState.perks.filter(p => p.source === 'independent-perk');
    independentPerksInState.forEach(perkState => {
      const perkCard = this.selectorPanel.querySelector(
        `.perk-card[data-item-id="${perkState.id}"][data-source="${perkState.source}"]`
      );
      if (perkCard) {
        perkCard.classList.add('selected');
        const inputElement = perkCard.querySelector(`input[data-item="${perkState.id}"][data-source="${perkState.source}"]`);
        if (inputElement) {
          inputElement.checked = true;
        }
        console.log(`FlawsAndPerksPageHandler._restoreState: Independent perk card "${perkState.id}" re-selected.`); 
        if (perkState.selections && perkState.selections.length > 0) {
          // Iterate over string IDs, not objects
          perkState.selections.forEach(optionId => {
            const optionInput = perkCard.querySelector(`input[data-item="${perkState.id}"][data-option="${optionId}"]`);
            if (optionInput) {
              optionInput.checked = true;
            }
          });
        }
      }
    });

    this._refreshItemOptionStates();
  }

  /**
   * Renders all available flaws and perks as cards in their respective grids.
   * @private
   */
  _renderItems() {
    // Query the *actual* grid containers where cards are appended
    const flawsGridContainer = this.selectorPanel.querySelector('.flaws-grid-container');
    const perksGridContainer = this.selectorPanel.querySelector('.perks-grid-container');
    if (!flawsGridContainer || !perksGridContainer) {
      console.error('FlawsAndPerksPageHandler: .flaws-grid-container or .perks-grid-container not found within the selectorPanel. This might lead to rendering issues if the HTML structure is not as expected.');
      return;
    }

    flawsGridContainer.innerHTML = ''; // Clear previous options
    perksGridContainer.innerHTML = ''; // Clear previous options

    const allFlawData = this.stateManager.getFlawData();
    const allPerkData = this.stateManager.getPerkData(); // NEW: Get perk data
    const currentState = this.stateManager.getState();
    
    // Render Flaws
    Object.entries(allFlawData).forEach(([flawId, flaw]) => {
      // Check if this flaw (by ID) is already in the state from a *different* source
      const isSelectedFromOtherSource = currentState.flaws.some(f => f.id === flawId && f.source !== 'independent-flaw');
      // Determine if it's independently selected on THIS page
      const isIndependentlySelected = currentState.flaws.some(f => f.id === flawId && f.source === 'independent-flaw');

      const inputType = 'checkbox';
      const inputName = `name="flaw-selection-${flawId}"`;

      const disabledClass = isSelectedFromOtherSource ? 'disabled-by-other-source' : '';
      const selectedClass = isIndependentlySelected && !isSelectedFromOtherSource ? 'selected' : '';

      flawsGridContainer.innerHTML += `
        <div class="item-container">
            <div class="flaw-card ${selectedClass} ${disabledClass}"
                 data-item-id="${flawId}"
                 data-source="independent-flaw"
                 data-type="flaw">
                <div class="item-header">
                    <label>
                        <input type="${inputType}" ${inputName}
                            ${isIndependentlySelected ? 'checked' : ''}
                            ${isSelectedFromOtherSource ? 'disabled' : ''}
                            data-item="${flawId}"
                            data-source="independent-flaw"
                            data-type="flaw">
                        <span class="item-name">${flaw.name}</span>
                    </label>
                    <div class="item-types">
                        <span class="type-tag flaw-tag">💔 Flaw (${flaw.weight})</span>
                    </div>
                </div>
                <div class="item-description">${this._renderDescription(flaw)}</div>
                ${flaw.options ? this._renderItemOptions(flaw, flawId, 'independent-flaw', 'flaw') : ''}
            </div>
        </div>
      `;
    });
    console.log('FlawsAndPerksPageHandler: Flaw options rendered.');

    // Render Perks (NEW)
    Object.entries(allPerkData).forEach(([perkId, perk]) => {
        const isSelectedFromOtherSource = currentState.perks.some(p => p.id === perkId && p.source !== 'independent-perk');
        const isIndependentlySelected = currentState.perks.some(p => p.id === perkId && p.source === 'independent-perk');

        const inputType = 'checkbox';
        const inputName = `name="perk-selection-${perkId}"`;

        const disabledClass = isSelectedFromOtherSource ? 'disabled-by-other-source' : '';
        const selectedClass = isIndependentlySelected && !isSelectedFromOtherSource ? 'selected' : '';

        // Add a temporary class that will be updated by _refreshItemOptionStates based on weight limits
        const weightDisabledClass = 'temp-disabled-by-weight';

        perksGridContainer.innerHTML += `
            <div class="item-container">
                <div class="perk-card ${selectedClass} ${disabledClass} ${weightDisabledClass}"
                     data-item-id="${perkId}"
                     data-source="independent-perk"
                     data-type="perk">
                    <div class="item-header">
                        <label>
                            <input type="${inputType}" ${inputName}
                                ${isIndependentlySelected ? 'checked' : ''}
                                ${isSelectedFromOtherSource ? 'disabled' : ''}
                                data-item="${perkId}"
                                data-source="independent-perk"
                                data-type="perk">
                            <span class="item-name">${perk.name}</span>
                        </label>
                        <div class="item-types">
                            <span class="type-tag perk-tag">✨ Perk (${perk.weight})</span>
                        </div>
                    </div>
                    <div class="item-description">${this._renderDescription(perk)}</div>
                    ${perk.options ? this._renderItemOptions(perk, perkId, 'independent-perk', 'perk') : ''}
                </div>
            </div>
        `;
    });
    console.log('FlawsAndPerksPageHandler: Perk options rendered.');
  }

  /**
   * Helper function to render descriptions with interpolated values.
   * @param {Object} item - The flaw or option object.
   * @returns {string} The rendered description HTML.
   * @private
   */
  _renderDescription(item) {
    let desc = item.description;
    if (!desc) return '';

    desc = desc.replace(/\${([^}]+)}/g, (match, p1) => {
        if (item.hasOwnProperty(p1)) {
            return item[p1];
        }
        return match;
    });
    return desc;
  }

  /**
   * Helper function to render options (checkboxes/radio buttons) nested within a flaw or perk.
   * @param {Object} parentItemDef - The parent item's definition object.
   * @param {string} itemId - The ID of the parent item.
   * @param {string} source - The source of the parent item.
   * @param {string} itemType - 'flaw' or 'perk'.
   * @returns {string} HTML string for nested options.
   * @private
   */
  _renderItemOptions(parentItemDef, itemId, source, itemType) {
    if (!parentItemDef.options) return '';

    const currentState = this.stateManager.getState();
    const parentItemStates = (itemType === 'flaw' ? currentState.flaws : currentState.perks);
    const parentItemState = parentItemStates.find(item => item.id === itemId && item.source === source);
    // Ensure selections are an array of string IDs, not objects
    const currentSelections = parentItemState ? parentItemState.selections : [];
    const isParentItemCurrentlySelected = !!parentItemState;

    // Check if the parent item is selected from another source.
    // If so, its nested options should also be disabled.
    const isParentDisabledByOtherSource = parentItemStates.some(item => item.id === itemId && item.source !== source);

    const inputType = (parentItemDef.maxChoices === 1) ? 'radio' : 'checkbox';
    // For radio buttons, the 'name' attribute ensures only one can be selected within the group.
    // For checkboxes, a name is not strictly required for grouping behavior, but good practice.
    const inputName = (inputType === 'radio') ? `name="${itemType}-nested-options-${itemId}"` : `name="${itemType}-nested-option-${itemId}-${source}"`;
    const chooseText = (parentItemDef.maxChoices === 1) ? 'Choose one' : `Choose ${parentItemDef.maxChoices || 'any'}`;

    const optionsClass = itemType === 'flaw' ? 'flaw-options-nested' : 'perk-options-nested';
    const optionLabelClass = itemType === 'flaw' ? 'flaw-option-nested' : 'perk-option-nested';

    return `
      <div class="${optionsClass}">
          <p>${chooseText}:</p>
          ${parentItemDef.options.map(option => {
            // Check if the option's ID is present in the current selections array (which should contain string IDs)
            const isOptionSelected = currentSelections.includes(option.id);
            
            // Disable if parent is not selected OR if parent is disabled by other source
            const disabledAttribute = (!isParentItemCurrentlySelected || isParentDisabledByOtherSource) ? 'disabled' : '';
            const checkedAttribute = isOptionSelected ? 'checked' : '';

            return `
                <label class="${optionLabelClass}">
                    <input type="${inputType}"
                        ${inputName}
                        ${checkedAttribute}
                        value="${option.id}" data-item="${itemId}"
                        data-option="${option.id}"
                        data-source="${source}"
                        data-type="${itemType}"
                        ${disabledAttribute}
                    >
                    <span class="option-visual"></span>
                    <span class="option-text-content">${option.name}</span> </label>`;
          }).join('')}
      </div>
      `;
  }

  /**
   * Refreshes the disabled and checked states of all flaw and perk options (checkboxes/radio buttons).
   * This is crucial after any state change that affects item selections.
   * @private
   */
  _refreshItemOptionStates() {
    console.log('FlawsAndPerksPageHandler._refreshItemOptionStates: Updating all item option disabled states.'); 
    const currentState = this.stateManager.getState();
    const allFlawsInState = currentState.flaws;
    const allPerksInState = currentState.perks;
    const currentTotalFlawPoints = this.stateManager.getIndependentFlawTotalWeight();
    const currentTotalPerkPoints = this.stateManager.getIndependentPerkTotalWeight();

    // Handle Flaw cards
    this.selectorPanel.querySelectorAll('.flaw-card').forEach(card => {
      const itemId = card.dataset.itemId;
      const currentCardSource = card.dataset.source; // Should be 'independent-flaw'
      const itemType = card.dataset.type; // 'flaw'

      const itemDef = this.stateManager.getAbilityOrFlawData(itemId, 'flaws'); // Use getAbilityOrFlawData for definitions
      if (!itemDef) {
        console.warn(`_refreshItemOptionStates: Flaw definition not found for ID: ${itemId}. Skipping card update.`);
        return;
      }

      const isSelectedFromOtherSource = allFlawsInState.some(f => f.id === itemId && f.source !== 'independent-flaw');
      const independentItemState = allFlawsInState.find(f => f.id === itemId && f.source === currentCardSource);
      const isIndependentlySelected = !!independentItemState;

      const mainItemInput = card.querySelector(`input[data-item="${itemId}"][data-source="${currentCardSource}"][data-type="${itemType}"]`);

      if (isSelectedFromOtherSource) {
        card.classList.add('disabled-by-other-source');
        card.classList.remove('selected');
        if (mainItemInput) {
          mainItemInput.checked = false;
          mainItemInput.disabled = true;
        }
        if (isIndependentlySelected) {
          this.stateManager.removeFlaw(itemId, currentCardSource, null); // Remove if selected independently but now from other source
        }
      } else {
        card.classList.remove('disabled-by-other-source');
        if (mainItemInput) {
          mainItemInput.disabled = false;
        }
        if (isIndependentlySelected) {
          card.classList.add('selected');
          if (mainItemInput) mainItemInput.checked = true;
        } else {
          card.classList.remove('selected');
          if (mainItemInput) mainItemInput.checked = false;
        }
      }

      // Handle nested options for flaws
      const optionsContainer = card.querySelector('.flaw-options-nested');
      if (optionsContainer && itemDef && itemDef.options) {
        optionsContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(optionInput => {
          const optionId = optionInput.dataset.option;
          // Ensure selections is an array of string IDs
          const isOptionSelected = independentItemState ? independentItemState.selections.includes(optionId) : false;

          let shouldBeDisabled = false;
          if (isSelectedFromOtherSource || !isIndependentlySelected) {
            shouldBeDisabled = true;
            if (optionInput.checked) optionInput.checked = false; // Uncheck if disabled
          } else {
            const currentSelectionsCount = independentItemState.selections.length;
            const maxChoicesForOption = itemDef.maxChoices; // This refers to the parent item's maxChoices for its options
            if (optionInput.type === 'radio') {
              shouldBeDisabled = false; // Radio buttons are typically managed by their group, not maxChoices directly
            } else { // Checkbox
              if (maxChoicesForOption !== undefined && maxChoicesForOption !== null &&
                  currentSelectionsCount >= maxChoicesForOption && !isOptionSelected) {
                shouldBeDisabled = true; // Disable if max choices reached and this option isn't selected
              } else {
                shouldBeDisabled = false;
              }
            }
          }
          optionInput.disabled = shouldBeDisabled;
          optionInput.checked = isOptionSelected;
        });
      }
    });

    // Handle Perk cards
    this.selectorPanel.querySelectorAll('.perk-card').forEach(card => {
      const itemId = card.dataset.itemId;
      const currentCardSource = card.dataset.source; // Should be 'independent-perk'
      const itemType = card.dataset.type; // 'perk'

      const itemDef = this.stateManager.getAbilityOrFlawData(itemId, 'perks'); // Use getAbilityOrFlawData for definitions
      if (!itemDef) {
        console.warn(`_refreshItemOptionStates: Perk definition not found for ID: ${itemId}. Skipping card update.`);
        return;
      }

      const isSelectedFromOtherSource = allPerksInState.some(p => p.id === itemId && p.source !== 'independent-perk');
      const independentItemState = allPerksInState.find(p => p.id === itemId && p.source === currentCardSource);
      const isIndependentlySelected = !!independentItemState;

      const mainItemInput = card.querySelector(`input[data-item="${itemId}"][data-source="${currentCardSource}"][data-type="${itemType}"]`);

      // Determine if the perk should be disabled due to weight limits
      const willExceedFlawPoints = (currentTotalPerkPoints + itemDef.weight) > currentTotalFlawPoints;
      // A perk should be disabled by weight if it's *not* currently selected independently
      // AND selecting it would exceed flaw points.
      const shouldBeDisabledByWeight = !isIndependentlySelected && willExceedFlawPoints;

      if (isSelectedFromOtherSource) {
        card.classList.add('disabled-by-other-source');
        card.classList.remove('selected');
        card.classList.remove('disabled-for-selection'); // Remove any weight-based disable if already from other source
        if (mainItemInput) {
          mainItemInput.checked = false;
          mainItemInput.disabled = true;
        }
        if (isIndependentlySelected) {
          this.stateManager.removePerk(itemId, currentCardSource, null);
        }
      } else {
        card.classList.remove('disabled-by-other-source'); // Ensure not disabled by other source
        if (mainItemInput) {
          mainItemInput.disabled = false; // Re-enable if previously disabled by other source
        }

        if (shouldBeDisabledByWeight) {
          card.classList.add('disabled-for-selection'); // Apply weight-based disable
          card.classList.remove('selected'); // Cannot be selected
          if (mainItemInput) mainItemInput.checked = false; // Ensure unchecked
        } else {
          card.classList.remove('disabled-for-selection'); // Remove weight-based disable
          // Only update selected class and checked state if not disabled by weight
          if (isIndependentlySelected) {
            card.classList.add('selected');
            if (mainItemInput) mainItemInput.checked = true;
          } else {
            card.classList.remove('selected');
            if (mainItemInput) mainItemInput.checked = false;
          }
        }
      }

      // Handle nested options for perks
      const optionsContainer = card.querySelector('.perk-options-nested');
      if (optionsContainer && itemDef && itemDef.options) {
        optionsContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(optionInput => {
          const optionId = optionInput.dataset.option;
          // Ensure selections is an array of string IDs
          const isOptionSelected = independentItemState ? independentItemState.selections.includes(optionId) : false;

          let shouldBeDisabled = false;
          // Nested options are disabled if parent card is disabled by other source OR
          // if parent card is disabled by weight OR
          // if parent card is not independently selected
          if (isSelectedFromOtherSource || shouldBeDisabledByWeight || !isIndependentlySelected) {
            shouldBeDisabled = true;
            if (optionInput.checked) optionInput.checked = false; // Uncheck if disabled
          } else {
            const currentSelectionsCount = independentItemState.selections.length;
            const maxChoicesForOption = itemDef.maxChoices; // This refers to the parent item's maxChoices for its options
            if (optionInput.type === 'radio') {
              shouldBeDisabled = false;
            } else { // Checkbox
              if (maxChoicesForOption !== undefined && maxChoicesForOption !== null &&
                  currentSelectionsCount >= maxChoicesForOption && !isOptionSelected) {
                shouldBeDisabled = true; // Disable if max choices reached and this option isn't selected
              } else {
                shouldBeDisabled = false;
              }
            }
          }
          optionInput.disabled = shouldBeDisabled;
          optionInput.checked = isOptionSelected;
        });
      }
    });

    this.pageNavigator.updateNav();
    this.informerUpdater.update('flaws-and-perks');
  }

  /**
   * Cleans up event listeners when the page is unloaded (optional, for robustness).\
   */
  cleanup() {
    console.log('FlawsAndPerksPageHandler.cleanup: Cleaning up flaws and perks page resources.');
    if (this._boundCardClickHandler) {
      this.selectorPanel.removeEventListener('click', this._boundCardClickHandler);
    }
    if (this._boundNestedOptionChangeHandler) {
      this.selectorPanel.removeEventListener('change', this._boundNestedOptionChangeHandler);
    }
  }
}

export { FlawsAndPerksPageHandler };