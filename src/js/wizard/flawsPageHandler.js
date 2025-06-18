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

    console.log('FlawsPageHandler: Initialized.');
  }

  /**
   * Sets up the flaws page by rendering options and attaching event listeners.
   * This method is called by the main CharacterWizard when the 'flaws' page is loaded.
   * @param {HTMLElement} selectorPanel - The DOM element for the selector panel.
   * @param {HTMLElement} informerPanel - The DOM element for the informer panel (not directly used here).
   */
  setupPage(selectorPanel, informerPanel) {
    this.selectorPanel = selectorPanel;
    console.log('FlawsPageHandler.setupPage: Setting up flaws page events and rendering content.'); 

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

    console.log('FlawsPageHandler: All event listeners attached.');
  }

  /**
   * Handles click on flaw cards (checkbox inputs).
   * @param {Event} e - The click event.
   * @private
   */
  _handleFlawCardClick(e) {
    const flawCard = e.target.closest('.flaw-card');
    if (!flawCard) return;

    const flawId = flawCard.dataset.flawId;
    const source = flawCard.dataset.source; // Should be 'independent-flaw'
    const itemType = 'flaw';

    // IMPORTANT: Check if the card is disabled by another source first
    if (flawCard.classList.contains('disabled-by-other-source')) {
      this.alerter.show(`'${flawId}' is already selected from another section and cannot be independently chosen.`, 'info');
      e.preventDefault(); // Prevent default checkbox toggle
      return;
    }

    const maxChoicesForParent = Infinity;

    const inputElement = flawCard.querySelector(`input[data-item="${flawId}"][data-source="${source}"][data-type="${itemType}"]`);
    if (!inputElement) {
      console.warn('FlawsPageHandler: Could not find associated input for clicked flaw card.'); 
      return;
    }
    
    // If the card is visually disabled (e.g., due to group limits, though not currently applied for parent flaws here), prevent clicks.
    if (flawCard.classList.contains('disabled-for-selection')) {
        console.log(`Click prevented on disabled flaw card: ${flawId}`);
        return;
    }

    const currentState = this.stateManager.getState();
    const currentFlawsInState = currentState.flaws.filter(f => f.source === source);
    const isParentFlawCurrentlySelected = currentFlawsInState.some(f => f.id === flawId);

    const mainLabel = inputElement.closest('label');
    const isClickOnMainInputOrLabel = (e.target === inputElement || (mainLabel && mainLabel.contains(e.target)));

    const isClickOnNestedOptionArea = e.target.closest('.flaw-options-nested');
    const clickedNestedOptionInput = e.target.closest('input[data-option]');

    // --- SCENARIO 1: Clicked anywhere within the nested options area ---
    if (isClickOnNestedOptionArea) {
        console.log(`_handleFlawCardClick: Click in nested option area for ${flawId}.`);
        if (!isParentFlawCurrentlySelected) {
            console.log(`_handleFlawCardClick: Parent flaw ${flawId} not selected. Selecting parent first.`);
            inputElement.checked = true;
            this._processParentFlawSelection(flawId, source, maxChoicesForParent, inputElement, true);
        }

        if (clickedNestedOptionInput) {
            console.log(`_handleFlawCardClick: Dispatching change event for nested option ${clickedNestedOptionInput.dataset.option}.`);
            setTimeout(() => {
                clickedNestedOptionInput.dispatchEvent(new Event('change', { bubbles: true }));
            }, 0);
        }
        return;
    }

    // --- SCENARIO 2: Clicked on main item card (input, label, or other parts *outside* nested options) ---
    console.log(`_handleFlawCardClick: Click on main flaw card for ${flawId}.`);
    let intendedSelectionState;
    if (isClickOnMainInputOrLabel) {
        intendedSelectionState = inputElement.checked;
    } else {
        intendedSelectionState = !inputElement.checked;
        inputElement.checked = intendedSelectionState;
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
    let currentFlaws = [...this.stateManager.get('flaws')];
    console.log(`_processParentFlawSelection: Initial currentFlaws in state:`, currentFlaws);

    let independentFlaws = currentFlaws.filter(f => f.source === source);
    let otherFlaws = currentFlaws.filter(f => f.source !== source);
    console.log(`_processParentFlawSelection: Independent flaws (filtered by source '${source}'):`, independentFlaws);
    console.log(`_processParentFlawSelection: Other flaws:`, otherFlaws);

    const isCurrentlyInIndependentState = independentFlaws.some(f => f.id === flawId);
    console.log(`_processParentFlawSelection: Flaw ${flawId} is currently in independent state: ${isCurrentlyInIndependentState}`);

    const flawCard = inputElement.closest('.flaw-card');

    if (intendedSelectionState && !isCurrentlyInIndependentState) { // Selecting
      console.log(`_processParentFlawSelection: Adding flaw ${flawId} to independent selections.`);
      independentFlaws.push({ id: flawId, selections: [], source: source, groupId: null });
      flawCard.classList.add('selected');
      inputElement.checked = true;
    } else if (!intendedSelectionState && isCurrentlyInIndependentState) { // Deselecting
      console.log(`_processParentFlawSelection: Removing flaw ${flawId} from independent selections.`);
      independentFlaws = independentFlaws.filter(f => f.id !== flawId);
      flawCard.classList.remove('selected');
      inputElement.checked = false;
    } else {
      console.log(`_processParentFlawSelection: Click on ${flawId} resulted in no state change (current: ${isCurrentlyInIndependentState}, intended: ${intendedSelectionState}).`);
      inputElement.checked = isCurrentlyInIndependentState;
    }

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
    const flawId = optionInput.dataset.item;
    const optionId = optionInput.dataset.option;
    const source = optionInput.dataset.source;
    const itemType = 'flaw';
    
    // IMPORTANT: Check if the parent card is disabled by another source first
    const flawCard = optionInput.closest('.flaw-card');
    if (flawCard && flawCard.classList.contains('disabled-by-other-source')) {
      this.alerter.show(`'${flawId}' is already selected from another section and cannot be independently chosen.`, 'info');
      e.preventDefault(); // Prevent default checkbox/radio toggle
      optionInput.checked = false; // Ensure it stays unchecked
      return;
    }

    const isSelectedFromInput = optionInput.checked;

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
    const parentFlawState = currentState.flaws.find(f => f.id === flawId && f.source === source);

    if (!parentFlawState) {
      console.warn(`FlawsPageHandler._handleNestedOptionSelection: Parent flaw '${flawId}' (source: ${source}) NOT FOUND IN STATE. Cannot select nested option. This might be due to timing issues.`); 
      inputElement.checked = false;
      this._refreshFlawOptionStates();
      return;
    }

    const parentFlawDef = this.stateManager.getFlaw(flawId);
    let newSelections = [...parentFlawState.selections];

    const isOptionCurrentlyInState = parentFlawState.selections.some(s => s.id === optionId);

    if (inputElement.type === 'radio') {
      console.log(`_handleNestedOptionSelection: Handling radio button for flaw ${flawId}, option ${optionId}.`);
      newSelections = [{ id: optionId }];
    } else {
      if (isOptionCurrentlyInState && !isSelectedFromInput) {
        console.log(`_handleNestedOptionSelection: Deselecting checkbox option ${optionId} for flaw ${flawId}.`);
        newSelections = newSelections.filter(s => s.id !== optionId);
      } else if (!isOptionCurrentlyInState && isSelectedFromInput) {
        console.log(`_handleNestedOptionSelection: Selecting checkbox option ${optionId} for flaw ${flawId}.`);
        if (parentFlawDef.maxChoices !== undefined && parentFlawDef.maxChoices !== null &&
            newSelections.length >= parentFlawDef.maxChoices) {
          inputElement.checked = false;
          alerter.show(`You can only select up to ${parentFlawDef.maxChoices} option(s) for ${parentFlawDef.name}.`);
          this._refreshFlawOptionStates();
          return;
        }
        newSelections.push({ id: optionId });
      } else {
        console.log(`_handleNestedOptionSelection: Click on option ${optionId} for flaw ${flawId} resulted in no state change (current: ${isOptionCurrentlyInState}, input: ${isSelectedFromInput}).`);
      }
    }
    
    this.stateManager.updateFlawSelections(flawId, source, null, newSelections);
    
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
    console.log('FlawsPageHandler._restoreState: Restoring page state for independent flaws.'); 
    const currentState = this.stateManager.getState();
    console.log('FlawsPageHandler._restoreState: Full flaws in state during restore:', currentState.flaws); 

    const independentFlawsInState = currentState.flaws.filter(f => f.source === 'independent-flaw');
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
        console.log(`FlawsPageHandler._restoreState: Independent flaw card "${flawState.id}" re-selected.`); 

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
    this._refreshFlawOptionStates();
  }

  /**
   * Renders all available flaws as cards in a grid.
   * @private
   */
  _renderFlaws() {
    const flawsOptionsContainer = this.selectorPanel.querySelector('.flaws-options');
    if (!flawsOptionsContainer) {
      console.error('FlawsPageHandler: .flaws-options container not found.'); 
      return;
    }
    flawsOptionsContainer.innerHTML = '<h3>Choose Your Flaws</h3><p>Select any flaws you wish to add to your character:</p>';

    const allFlawData = this.stateManager.getFlawData();
    const currentState = this.stateManager.getState();
    
    const flawsGridContainer = document.createElement('div');
    flawsGridContainer.className = 'flaws-grid-container';

    Object.entries(allFlawData).forEach(([flawId, flaw]) => {
      // Check if this flaw (by ID) is already in the state from a *different* source
      const isSelectedFromOtherSource = currentState.flaws.some(f => f.id === flawId && f.source !== 'independent-flaw');
      
      // Determine if it's independently selected on THIS page
      const isIndependentlySelected = currentState.flaws.some(f => f.id === flawId && f.source === 'independent-flaw');

      const inputType = 'checkbox';
      const inputName = `name="flaw-selection-${flawId}"`; 

      const disabledClass = isSelectedFromOtherSource ? 'disabled-by-other-source' : '';
      const selectedClass = isIndependentlySelected && !isSelectedFromOtherSource ? 'selected' : ''; // Only 'selected' if not disabled by other source

      flawsGridContainer.innerHTML += `
        <div class="flaw-container">
            <div class="flaw-card ${selectedClass} ${disabledClass}"
                 data-flaw-id="${flawId}"
                 data-source="independent-flaw"
                 data-type="flaw">
                <div class="flaw-header">
                    <label>
                        <input type="${inputType}" ${inputName}
                            ${isIndependentlySelected ? 'checked' : ''}
                            ${isSelectedFromOtherSource ? 'disabled' : ''}
                            data-item="${flawId}"
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
    console.log('FlawsPageHandler: Flaw options rendered.'); 
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
    const parentFlawState = currentState.flaws.find(f => f.id === flawId && f.source === source);
    const currentSelections = parentFlawState ? parentFlawState.selections : [];
    const isParentFlawCurrentlySelected = !!parentFlawState;

    // Check if the parent flaw is selected from another source.
    // If so, its nested options should also be disabled.
    const isParentDisabledByOtherSource = currentState.flaws.some(f => f.id === flawId && f.source !== source);

    const inputType = (parentFlawDef.maxChoices === 1) ? 'radio' : 'checkbox';
    const inputName = (inputType === 'radio') ? `name="flaw-nested-options-${flawId}"` : '';
    const chooseText = (parentFlawDef.maxChoices === 1) ? 'Choose one' : `Choose ${parentFlawDef.maxChoices || 'any'}`;

    return `
      <div class="flaw-options-nested">
          <p>${chooseText}:</p>
          ${parentFlawDef.options.map(option => {
            const isOptionSelected = currentSelections.some(s => s.id === option.id);
            // Disable if parent is not selected OR if parent is disabled by other source
            const disabledAttribute = (!isParentFlawCurrentlySelected || isParentDisabledByOtherSource) ? 'disabled' : '';
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
    console.log('FlawsPageHandler._refreshFlawOptionStates: Updating all flaw option disabled states.'); 
    const currentState = this.stateManager.getState();
    const allFlawsInState = currentState.flaws;
    console.log(`_refreshFlawOptionStates: All flaws currently in state:`, allFlawsInState);

    this.selectorPanel.querySelectorAll('.flaw-card').forEach(flawCard => {
      const flawId = flawCard.dataset.flawId;
      const currentCardSource = flawCard.dataset.source; // Should be 'independent-flaw'

      console.log(`_refreshFlawOptionStates: Processing card for flawId: ${flawId}, source: ${currentCardSource}`);

      const flawDef = this.stateManager.getFlaw(flawId);
      if (!flawDef) {
        console.warn(`_refreshFlawOptionStates: Flaw definition not found for ID: ${flawId}. Skipping card update.`);
        return;
      }

      // Check if this flaw exists in the state from *any* source that is NOT 'independent-flaw'
      const isSelectedFromOtherSource = allFlawsInState.some(f => f.id === flawId && f.source !== 'independent-flaw');
      console.log(`_refreshFlawOptionStates: Flaw ${flawId} is selected from other source: ${isSelectedFromOtherSource}`);

      // Find the state of this flaw specifically from 'independent-flaw' source
      const independentFlawState = allFlawsInState.find(f => f.id === flawId && f.source === currentCardSource);
      const isIndependentlySelected = !!independentFlawState;
      console.log(`_refreshFlawOptionStates: Flaw ${flawId} is independently selected: ${isIndependentlySelected}`);

      const mainFlawInput = flawCard.querySelector(`input[data-item="${flawId}"][data-source="${currentCardSource}"][data-type="flaw"]`);

      if (isSelectedFromOtherSource) {
        // If selected from another source, disable this card entirely on the 'flaws' page
        flawCard.classList.add('disabled-by-other-source');
        flawCard.classList.remove('selected'); // Cannot be independently selected visually

        if (mainFlawInput) {
          mainFlawInput.checked = false; // Ensure it's unchecked
          mainFlawInput.disabled = true; // Disable the input
        }

        // IMPORTANT: If this flaw was previously independently selected, remove it from the state
        if (isIndependentlySelected) {
          console.log(`_refreshFlawOptionStates: Removing independently selected flaw ${flawId} due to other source selection.`);
          const updatedFlaws = allFlawsInState.filter(f => !(f.id === flawId && f.source === currentCardSource));
          this.stateManager.set('flaws', updatedFlaws); // Update state to remove the duplicate
        }

      } else {
        // If NOT selected from another source, ensure it's enabled
        flawCard.classList.remove('disabled-by-other-source');
        if (mainFlawInput) {
          mainFlawInput.disabled = false;
        }
        // Update its 'selected' class and checked state based on its independent status
        if (isIndependentlySelected) {
          flawCard.classList.add('selected');
          if (mainFlawInput) mainFlawInput.checked = true;
        } else {
          flawCard.classList.remove('selected');
          if (mainFlawInput) mainFlawInput.checked = false;
        }
      }

      // Now handle nested options within this flaw card
      const optionsContainer = flawCard.querySelector('.flaw-options-nested');
      if (optionsContainer && flawDef && flawDef.options) {
        optionsContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(optionInput => {
          const optionId = optionInput.dataset.option;
          // Determine if this option should be checked based on the *independent* flaw's selections
          const isOptionSelected = independentFlawState ? independentFlawState.selections.some(s => s.id === optionId) : false;

          let shouldBeDisabled = false;

          // Nested options are disabled if the parent card itself is disabled by another source OR
          // if the parent card is not independently selected (meaning its checkbox is unchecked)
          if (isSelectedFromOtherSource || !isIndependentlySelected) {
            shouldBeDisabled = true;
            if (optionInput.checked) {
              optionInput.checked = false; // Deselect if parent is not selected or disabled
            }
          } else {
            const currentSelectionsCount = independentFlawState.selections.length;
            const maxChoicesForOption = flawDef.maxChoices;

            if (optionInput.type === 'radio') {
              shouldBeDisabled = false;
            } else {
              if (maxChoicesForOption !== undefined && maxChoicesForOption !== null &&
                  currentSelectionsCount >= maxChoicesForOption && !isOptionSelected) {
                shouldBeDisabled = true;
              } else {
                shouldBeDisabled = false;
              }
            }
          }
          optionInput.disabled = shouldBeDisabled;
          optionInput.checked = isOptionSelected; // Ensure checked state matches the independent state
        });
      } else if (optionsContainer) {
        console.debug(`_refreshFlawOptionStates: Flaw ${flawId} has optionsContainer but no options in flawDef, or vice versa.`);
      }
    });
    this.pageNavigator.updateNav();
    this.informerUpdater.update('flaws');
  }

  /**
   * Cleans up event listeners when the page is unloaded (optional, for robustness).
   */
  cleanup() {
    console.log('FlawsPageHandler.cleanup: Cleaning up flaws page resources.'); 
    if (this._boundFlawCardClickHandler) {
      this.selectorPanel.removeEventListener('click', this._boundFlawCardClickHandler);
    }
    if (this._boundNestedOptionChangeHandler) {
      this.selectorPanel.removeEventListener('change', this._boundNestedOptionChangeHandler);
    }
  }
}

export { FlawsPageHandler };
