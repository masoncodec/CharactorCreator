// flawsPageHandler.js
// This module handles the UI rendering and event handling for the 'flaws' selection page.

import { alerter } from '../alerter.js'; // Assuming alerter.js is available

class FlawsPageHandler {
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

    console.log('FlawPageHandler: Initialized.');
  }

  /**
   * Sets up the flaws page by rendering options and attaching event listeners.
   * This method is called by the main CharacterWizard when the 'flaws' page is loaded.
   * @param {HTMLElement} selectorPanel - The DOM element for the selector panel.
   * @param {HTMLElement} informerPanel - The DOM element for the informer panel (not directly used here).
   */
  setupPage(selectorPanel, informerPanel) {
    this.selectorPanel = selectorPanel;
    console.log('FlawPageHandler.setupPage: Setting up flaws page events and rendering content.');

    this._renderFlaws(); // Render initial flaw options
    this._attachEventListeners();
    this._restoreState(); // Restore state for independently selected flaws

    this.informerUpdater.update('flaws'); // Update informer with current flaw state
    this.pageNavigator.updateNav();      // Update navigation based on completion
  }

  /**
   * Attaches all necessary event listeners to the selector panel.
   * @private
   */
  _attachEventListeners() {
    // Remove existing listeners to prevent duplicates if setupPage is called multiple times
    this.selectorPanel.removeEventListener('click', this._boundFlawCardClickHandler);
    this.selectorPanel.removeEventListener('change', this._boundNestedOptionChangeHandler);

    // Bind event handlers to the class instance
    this._boundFlawCardClickHandler = this._handleFlawCardClick.bind(this);
    this.selectorPanel.addEventListener('click', this._boundFlawCardClickHandler);

    this._boundNestedOptionChangeHandler = this._handleNestedOptionChange.bind(this);
    this.selectorPanel.addEventListener('change', this._boundNestedOptionChangeHandler);

    console.log('FlawPageHandler: All event listeners attached.');
  }

  /**
   * Handles click on flaw cards (checkbox inputs).
   * @param {Event} e - The click event.
   * @private
   */
  _handleFlawCardClick(e) {
    const flawCard = e.target.closest('.flaw-card'); // Use .flaw-card for specificity on this page
    if (!flawCard) return;

    const flawId = flawCard.dataset.flawId;
    const source = flawCard.dataset.source; // Should be 'independent-flaw'
    const itemType = 'flaw';
    // Max choices for the parent flaw itself. User wants "as many as they want", so treat as multi-select checkbox.
    // However, if the flaw itself has options, its maxChoices will apply to those.
    const maxChoicesForParent = Infinity; // Effectively allow unlimited selection for parent flaws on this page

    // This is the main input (checkbox) for the parent flaw card
    const inputElement = flawCard.querySelector(`input[data-item="${flawId}"][data-source="${source}"][data-type="${itemType}"]`);
    if (!inputElement) {
      console.warn('FlawPageHandler: Could not find associated input for clicked flaw card.');
      return;
    }

    // If the card is visually disabled (e.g., due to group limits, though not currently applied for parent flaws here), prevent clicks.
    if (flawCard.classList.contains('disabled-for-selection')) {
        console.log(`Click prevented on disabled flaw card: ${flawId}`);
        return;
    }

    const currentState = this.stateManager.getState();
    const currentFlawsInState = currentState.flaws.filter(f => f.source === source); // Only consider independent flaws
    const isParentFlawCurrentlySelected = currentFlawsInState.some(f => f.id === flawId);

    const mainLabel = inputElement.closest('label');
    const isClickOnMainInputOrLabel = (e.target === inputElement || (mainLabel && mainLabel.contains(e.target)));

    const isClickOnNestedOptionArea = e.target.closest('.flaw-options-nested'); // Use .flaw-options-nested
    const clickedNestedOptionInput = e.target.closest('input[data-option]'); // The specific nested option input clicked

    // --- SCENARIO 1: Clicked anywhere within the nested options area ---
    if (isClickOnNestedOptionArea) {
        console.log(`_handleFlawCardClick: Click in nested option area for ${flawId}.`);
        if (!isParentFlawCurrentlySelected) {
            console.log(`_handleFlawCardClick: Parent flaw ${flawId} not selected. Selecting parent first.`);
            // User clicked a nested option, and the parent flaw is NOT selected.
            inputElement.checked = true; // This 'inputElement' refers to the main parent flaw input
            this._processParentFlawSelection(flawId, source, maxChoicesForParent, inputElement, true);
        }

        // Now, dispatch a change event on the clicked nested input to trigger its handler.
        // Use setTimeout to allow the parent state update and refresh to complete first.
        if (clickedNestedOptionInput) {
            console.log(`_handleFlawCardClick: Dispatching change event for nested option ${clickedNestedOptionInput.dataset.option}.`);
            setTimeout(() => {
                clickedNestedOptionInput.dispatchEvent(new Event('change', { bubbles: true }));
            }, 0);
        }
        return; // Important: prevent main flaw card click logic from running
    }

    // --- SCENARIO 2: Clicked on main item card (input, label, or other parts *outside* nested options) ---
    console.log(`_handleFlawCardClick: Click on main flaw card for ${flawId}.`);
    let intendedSelectionState;
    if (isClickOnMainInputOrLabel) {
        intendedSelectionState = inputElement.checked; // Browser's native toggle already updated inputElement.checked
    } else {
        intendedSelectionState = !inputElement.checked;
        inputElement.checked = intendedSelectionState; // Manually toggle the main input
    }
    this._processParentFlawSelection(flawId, source, maxChoicesForParent, inputElement, intendedSelectionState);
  }

  /**
   * Helper function to encapsulate parent flaw selection/deselection logic.
   * @param {string} flawId - The ID of the flaw being selected.
   * @param {string} source - The source of the flaw (e.g., 'independent-flaw').
   * @param {number} maxChoicesForParent - The max choices for the parent flaw (Infinity for this page).
   * @param {HTMLInputElement} inputElement - The main flaw's checkbox input.
   * @param {boolean} intendedSelectionState - The desired checked state for the parent flaw.
   * @private
   */
  _processParentFlawSelection(flawId, source, maxChoicesForParent, inputElement, intendedSelectionState) {
    console.log(`_processParentFlawSelection: Processing flaw ${flawId} with intended state: ${intendedSelectionState}. Source: ${source}`);
    let currentFlaws = [...this.stateManager.get('flaws')]; // Gets a copy of the WHOLE flaws array
    console.log(`_processParentFlawSelection: Initial currentFlaws in state:`, currentFlaws);

    // Filter out flaws not from this page's source, to avoid accidental interference with destiny flaws
    let independentFlaws = currentFlaws.filter(f => f.source === source); // Only independent flaws from the state
    let otherFlaws = currentFlaws.filter(f => f.source !== source); // All other flaws (e.g., destiny-bound)
    console.log(`_processParentFlawSelection: Independent flaws (filtered by source '${source}'):`, independentFlaws);
    console.log(`_processParentFlawSelection: Other flaws:`, otherFlaws);

    const isCurrentlyInIndependentState = independentFlaws.some(f => f.id === flawId);
    console.log(`_processParentFlawSelection: Flaw ${flawId} is currently in independent state: ${isCurrentlyInIndependentState}`);

    const flawCard = inputElement.closest('.flaw-card');

    if (intendedSelectionState && !isCurrentlyInIndependentState) { // Selecting
      console.log(`_processParentFlawSelection: Adding flaw ${flawId} to independent selections.`);
      independentFlaws.push({ id: flawId, selections: [], source: source, groupId: null }); // Add the NEW flaw
      flawCard.classList.add('selected');
      inputElement.checked = true;
    } else if (!intendedSelectionState && isCurrentlyInIndependentState) { // Deselecting
      console.log(`_processParentFlawSelection: Removing flaw ${flawId} from independent selections.`);
      independentFlaws = independentFlaws.filter(f => f.id !== flawId); // Remove the specific flaw
      flawCard.classList.remove('selected');
      inputElement.checked = false;
    } else {
      console.log(`_processParentFlawSelection: Click on ${flawId} resulted in no state change (current: ${isCurrentlyInIndependentState}, intended: ${intendedSelectionState}).`);
      inputElement.checked = isCurrentlyInIndependentState; // Ensure checkbox matches actual state
    }

    // Merge back the independent flaws with other flaws and update state
    const finalFlawsState = [...otherFlaws, ...independentFlaws];
    this.stateManager.set('flaws', finalFlawsState);
    console.log(`_processParentFlawSelection: Final state after update (full flaws array):`, this.stateManager.get('flaws'));
    console.log(`_processParentFlawSelection: Flaw state updated for ${flawId}.`);
    this.informerUpdater.update('flaws');
    this.pageNavigator.updateNav();
    this._refreshFlawOptionStates(); // Update UI for other cards as well
  }

  /**
   * Handles change event on nested flaw option checkboxes/radio buttons.
   * @param {Event} e - The change event.
   * @private
   */
  _handleNestedOptionChange(e) {
    // Ensure the event target is an input with data-option (i.e., a nested option)
    if (!e.target.matches('input[data-option]')) {
      return;
    }

    const optionInput = e.target;
    const flawId = optionInput.dataset.item; // The parent flaw ID
    const optionId = optionInput.dataset.option;
    const source = optionInput.dataset.source; // Should be 'independent-flaw'
    const itemType = 'flaw';
    
    const isSelectedFromInput = optionInput.checked; // This is the actual checked state after user interaction

    console.log(`_handleNestedOptionChange: Processing nested option ${optionId} for flaw ${flawId}. Current input checked: ${isSelectedFromInput}`);

    this._handleNestedOptionSelection(flawId, source, itemType, optionId, isSelectedFromInput, optionInput);
  }

  /**
   * Handles the selection/deselection of an option nested within a flaw.
   * @param {string} flawId - The ID of the parent flaw.
   * @param {string} source - The source of the parent item.
   * @param {string} itemType - 'flaw'.
   * @param {string} optionId - The ID of the option selected/deselected.
   * @param {boolean} isSelectedFromInput - True if the input element is checked after the user's interaction, false otherwise.
   * @param {HTMLElement} inputElement - The input element (checkbox/radio).
   * @private
   */
  _handleNestedOptionSelection(flawId, source, itemType, optionId, isSelectedFromInput, inputElement) {
    const currentState = this.stateManager.getState();
    // Find the specific parent flaw by ID and source (no groupId for independent flaws)
    const parentFlawState = currentState.flaws.find(f => f.id === flawId && f.source === source);

    if (!parentFlawState) {
      console.warn(`FlawPageHandler._handleNestedOptionSelection: Parent flaw '${flawId}' (source: ${source}) NOT FOUND IN STATE. Cannot select nested option. This might be due to timing issues.`);
      inputElement.checked = false; // Ensure UI reflects lack of parent in state
      this._refreshFlawOptionStates();
      return;
    }

    const parentFlawDef = this.stateManager.getFlaw(flawId); // Get the flaw definition
    let newSelections = [...parentFlawState.selections];

    const isOptionCurrentlyInState = parentFlawState.selections.some(s => s.id === optionId);

    if (inputElement.type === 'radio') {
      console.log(`_handleNestedOptionSelection: Handling radio button for flaw ${flawId}, option ${optionId}.`);
      newSelections = [{ id: optionId }]; // For radio buttons, only one selection
    } else { // Checkbox logic
      if (isOptionCurrentlyInState && !isSelectedFromInput) { // Option is currently selected, user clicked to DESELECT
        console.log(`_handleNestedOptionSelection: Deselecting checkbox option ${optionId} for flaw ${flawId}.`);
        newSelections = newSelections.filter(s => s.id !== optionId);
      } else if (!isOptionCurrentlyInState && isSelectedFromInput) { // Option is NOT currently selected, user clicked to SELECT
        console.log(`_handleNestedOptionSelection: Selecting checkbox option ${optionId} for flaw ${flawId}.`);
        if (parentFlawDef.maxChoices !== undefined && parentFlawDef.maxChoices !== null &&
            newSelections.length >= parentFlawDef.maxChoices) {
          inputElement.checked = false; // Revert checkbox state if over limit
          alerter.show(`You can only select up to ${parentFlawDef.maxChoices} option(s) for ${parentFlawDef.name}.`);
          this._refreshFlawOptionStates();
          return;
        }
        newSelections.push({ id: optionId });
      } else {
        console.log(`_handleNestedOptionSelection: Click on option ${optionId} for flaw ${flawId} resulted in no state change (current: ${isOptionCurrentlyInState}, input: ${isSelectedFromInput}).`);
      }
    }
    
    // Update the parent flaw's selections array in the state
    this.stateManager.updateFlawSelections(flawId, source, null, newSelections); // groupId is null for independent flaws
    
    console.log(`_handleNestedOptionSelection: Selections updated for flaw ${flawId}:`, this.stateManager.getState().flaws.find(f => f.id === flawId && f.source === source)?.selections);
    this.informerUpdater.update('flaws');
    this.pageNavigator.updateNav();
    this._refreshFlawOptionStates();
  }

  /**
   * Restores the selections for independently chosen flaws based on the current state.
   * @private
   */
  _restoreState() {
    console.log('FlawPageHandler._restoreState: Restoring page state for independent flaws.');
    const currentState = this.stateManager.getState();
    const independentFlawsInState = currentState.flaws.filter(f => f.source === 'independent-flaw');
    console.log('FlawPageHandler._restoreState: Independent flaws in state to restore:', independentFlawsInState);


    independentFlawsInState.forEach(flawState => {
      const flawCard = this.selectorPanel.querySelector(
        `.flaw-card[data-flaw-id="${flawState.id}"][data-source="${flawState.source}"]`
      );
      if (flawCard) {
        flawCard.classList.add('selected');
        
        const inputElement = flawCard.querySelector(`input[data-item="${flawState.id}"][data-source="${flawState.source}"]`);
        if (inputElement) {
          inputElement.checked = true;
        }
        console.log(`FlawPageHandler._restoreState: Flaw card "${flawState.id}" re-selected.`);

        // Restore nested options
        if (flawState.selections && flawState.selections.length > 0) {
          flawState.selections.forEach(option => {
            const optionInput = flawCard.querySelector(`input[data-item="${flawState.id}"][data-option="${option.id}"]`);
            if (optionInput) {
              optionInput.checked = true;
            }
          });
        }
      }
    });
    this._refreshFlawOptionStates(); // Crucial to update disabled states based on selections
  }

  /**
   * Renders all available flaws as cards in a grid.
   * @private
   */
  _renderFlaws() {
    const flawsOptionsContainer = this.selectorPanel.querySelector('.flaws-options');
    if (!flawsOptionsContainer) {
      console.error('FlawPageHandler: .flaws-options container not found.');
      return;
    }
    flawsOptionsContainer.innerHTML = '<h3>Choose Your Flaws</h3><p>Select any flaws you wish to add to your character:</p>'; // Clear and add title

    const allFlawData = this.stateManager.getFlawData();
    const currentState = this.stateManager.getState();
    const independentFlawsInState = currentState.flaws.filter(f => f.source === 'independent-flaw');

    const flawsGridContainer = document.createElement('div');
    flawsGridContainer.className = 'flaws-grid-container'; // New class for the grid

    // Convert object of flaws to an array of [id, flawObject] pairs for easier iteration
    Object.entries(allFlawData).forEach(([flawId, flaw]) => { // <-- Changed from Object.values to Object.entries
      const isSelected = independentFlawsInState.some(s => s.id === flawId); // Use flawId from the entry
      
      const inputType = 'checkbox'; // Parent flaws are checkboxes for multi-selection
      // Using unique name to prevent accidental grouping by browser, though data-item is primary for JS logic
      const inputName = `name="flaw-selection-${flawId}"`; // Use flawId here

      flawsGridContainer.innerHTML += `
        <div class="flaw-container">
            <div class="flaw-card ${isSelected ? 'selected' : ''}"
                 data-flaw-id="${flawId}"  // <-- Correctly assign flawId here
                 data-source="independent-flaw"
                 data-type="flaw">
                <div class="flaw-header">
                    <label>
                        <input type="${inputType}" ${inputName}
                            ${isSelected ? 'checked' : ''}
                            data-item="${flawId}"  // <-- Correctly assign flawId here
                            data-source="independent-flaw"
                            data-type="flaw">
                        <span class="flaw-name">${flaw.name}</span>
                    </label>
                    <div class="flaw-types">
                        <span class="type-tag flaw-tag">💔 Flaw</span>
                    </div>
                </div>
                <div class="flaw-description">${this._renderDescription(flaw)}</div>
                ${flaw.options ? this._renderFlawOptions(flaw, flawId, 'independent-flaw') : ''}
            </div>
        </div>
      `;
    });
    flawsOptionsContainer.appendChild(flawsGridContainer);
    console.log('FlawPageHandler: Flaw options rendered.');
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

    // Simple placeholder replacement for now, expand if more complex logic is needed
    desc = desc.replace(/\${([^}]+)}/g, (match, p1) => {
        // For now, only handle simple direct property access from the item itself
        if (item.hasOwnProperty(p1)) {
            return item[p1];
        }
        return match; // Return original if not found
    });
    return desc;
  }

  /**
   * Helper function to render options (checkboxes/radio buttons) nested within a flaw.
   * @param {Object} parentFlawDef - The parent flaw's definition object.
   * @param {string} flawId - The ID of the parent flaw.
   * @param {string} source - The source of the parent flaw.
   * @returns {string} HTML string for nested options.
   * @private
   */
  _renderFlawOptions(parentFlawDef, flawId, source) {
    if (!parentFlawDef.options) return '';

    const currentState = this.stateManager.getState();
    // Note: parentFlawState here represents the state of THIS specific flaw (by flawId and source)
    const parentFlawState = currentState.flaws.find(f => f.id === flawId && f.source === source);
    const currentSelections = parentFlawState ? parentFlawState.selections : [];
    const isParentFlawCurrentlySelected = !!parentFlawState;

    const inputType = (parentFlawDef.maxChoices === 1) ? 'radio' : 'checkbox';
    // For nested radio buttons, the 'name' attribute *must* be the same for the group.
    // For checkboxes, it can be unique.
    const inputName = (inputType === 'radio') ? `name="flaw-nested-options-${flawId}"` : '';
    const chooseText = (parentFlawDef.maxChoices === 1) ? 'Choose one' : `Choose ${parentFlawDef.maxChoices || 'any'}`;

    return `
      <div class="flaw-options-nested">
          <p>${chooseText}:</p>
          ${parentFlawDef.options.map(option => {
            const isOptionSelected = currentSelections.some(s => s.id === option.id);
            const disabledAttribute = !isParentFlawCurrentlySelected ? 'disabled' : ''; // Initial disabled
            const checkedAttribute = isOptionSelected ? 'checked' : '';

            return `
                <label class="flaw-option-nested">
                    <input type="${inputType}"
                        ${inputName}
                        ${checkedAttribute}
                        data-item="${flawId}"
                        data-option="${option.id}"
                        data-source="${source}"
                        data-type="flaw"
                        ${disabledAttribute}
                    >
                    <span class="option-visual"></span>
                    <span class="option-text-content">${option.name}: ${this._renderDescription(option)}</span>
                </label>`;
          }).join('')}
      </div>
      `;
  }

  /**
   * Refreshes the disabled and checked states of all flaw options (checkboxes/radio buttons).
   * This is crucial after any state change that affects item selections.
   * @private
   */
  _refreshFlawOptionStates() {
    console.log('FlawPageHandler._refreshFlawOptionStates: Updating all flaw option disabled states.');
    const currentState = this.stateManager.getState();
    // Get ALL independent flaws that are currently in the state
    const independentFlawsInState = currentState.flaws.filter(f => f.source === 'independent-flaw');
    console.log(`_refreshFlawOptionStates: Independent flaws currently in state:`, independentFlawsInState);


    this.selectorPanel.querySelectorAll('.flaw-card').forEach(flawCard => { // Loop through EVERY flaw card on the page
      const flawId = flawCard.dataset.flawId;
      const source = flawCard.dataset.source; // Should be 'independent-flaw' for these cards
      console.log(`_refreshFlawOptionStates: Processing card for flawId: ${flawId}`);

      const flawDef = this.stateManager.getFlaw(flawId); // Get the definition of THIS flaw

      // Check if THIS specific flaw (flawId and source) is present in the independentFlawsInState array
      const parentFlawState = independentFlawsInState.find(f => f.id === flawId);
      const isParentFlawCurrentlySelected = !!parentFlawState; // True if THIS card's flaw is in the state

      console.log(`_refreshFlawOptionStates: Flaw ${flawId} is selected in state: ${isParentFlawCurrentlySelected}`);

      // Update parent flaw card visual 'selected' state
      if (isParentFlawCurrentlySelected) {
        flawCard.classList.add('selected');
      } else {
        flawCard.classList.remove('selected');
      }

      // Handle the main flaw input (checkbox for selecting the flaw itself)
      const mainFlawInput = flawCard.querySelector(`input[data-item="${flawId}"][data-source="${source}"][data-type="flaw"]`);
      if (mainFlawInput) {
        mainFlawInput.checked = isParentFlawCurrentlySelected; // Set its checked state based on state
        // Parent checkboxes are never disabled on this page as user wants "as many as they want"
        mainFlawInput.disabled = false;
        flawCard.classList.remove('disabled-for-selection'); // Ensure it's not visually disabled
      }

      // Now handle nested options within this flaw card
      const optionsContainer = flawCard.querySelector('.flaw-options-nested');
      if (optionsContainer && flawDef && flawDef.options) {
        optionsContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(optionInput => {
          const optionId = optionInput.dataset.option;
          // Check if THIS specific nested option is selected within THIS parent flaw's state
          const isOptionSelected = parentFlawState ? parentFlawState.selections.some(s => s.id === optionId) : false;

          let shouldBeDisabled = false;

          // If the parent flaw itself is not selected, all its nested options should be disabled and unchecked
          if (!isParentFlawCurrentlySelected) {
            shouldBeDisabled = true;
            if (optionInput.checked) {
              optionInput.checked = false; // Deselect if parent is not selected
            }
          } else {
            const currentSelectionsCount = parentFlawState.selections.length;
            const maxChoicesForOption = flawDef.maxChoices; // This refers to nested options' maxChoices

            if (optionInput.type === 'radio') {
              // Radio buttons are generally not disabled unless their parent is,
              // as selecting one automatically deselects others in the same group.
              shouldBeDisabled = false; 
            } else { // Nested Checkbox logic
              if (maxChoicesForOption !== undefined && maxChoicesForOption !== null &&
                  currentSelectionsCount >= maxChoicesForOption && !isOptionSelected) {
                // Disable if max choices reached AND this option is not currently selected
                shouldBeDisabled = true; 
              } else {
                shouldBeDisabled = false;
              }
            }
          }
          optionInput.disabled = shouldBeDisabled;
          // Ensure the input's checked state reflects the state, especially after potential reverts
          optionInput.checked = isOptionSelected;
        });
      } else if (optionsContainer) {
        console.debug(`_refreshFlawOptionStates: Flaw ${flawId} has optionsContainer but no options in flawDef, or vice versa.`);
      }
    });
    this.pageNavigator.updateNav();
  }

  /**
   * Cleans up event listeners when the page is unloaded (optional, for robustness).
   */
  cleanup() {
    console.log('FlawPageHandler.cleanup: Cleaning up flaws page resources.');
    if (this._boundFlawCardClickHandler) {
      this.selectorPanel.removeEventListener('click', this._boundFlawCardClickHandler);
    }
    if (this._boundNestedOptionChangeHandler) {
      this.selectorPanel.removeEventListener('change', this._boundNestedOptionChangeHandler);
    }
  }
}

export { FlawsPageHandler };
