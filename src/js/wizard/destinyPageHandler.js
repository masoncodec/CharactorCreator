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
    // Remove existing listeners to prevent duplicates if setupPage is called multiple times
    this.selectorPanel.removeEventListener('click', this._boundDestinyOptionClickHandler);
    this.selectorPanel.removeEventListener('click', this._boundFlawOptionClickHandler);
    this.selectorPanel.removeEventListener('click', this._boundAbilityCardClickHandler); // This will handle both radio/checkbox parent clicks
    this.selectorPanel.removeEventListener('change', this._boundAbilityOptionChangeHandler); // For nested options

    // Bind event handlers to the class instance
    this._boundDestinyOptionClickHandler = this._handleDestinyOptionClick.bind(this);
    this.selectorPanel.addEventListener('click', this._boundDestinyOptionClickHandler);

    this._boundFlawOptionClickHandler = this._handleFlawOptionClick.bind(this);
    this.selectorPanel.addEventListener('click', this._boundFlawOptionClickHandler);

    this._boundAbilityCardClickHandler = this._handleAbilityCardClick.bind(this);
    this.selectorPanel.addEventListener('click', this._boundAbilityCardClickHandler);

    this._boundAbilityOptionChangeHandler = this._handleAbilityOptionChange.bind(this);
    this.selectorPanel.addEventListener('change', this._boundAbilityOptionChangeHandler);

    console.log('DestinyPageHandler: All event listeners attached.');
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
      this.stateManager.set('flaws', this.stateManager.get('flaws').filter(f => !f.destiny));

      console.log(`DestinyPageHandler: Destiny selected: ${selectedDestinyId}.`);

      // Re-render sections and update UI
      this._renderFlawSelection();
      this._renderAbilityGroupsSection(); // Re-render ability groups section
      this._autoSelectSingleAbilityGroup(); // Auto-select abilities if applicable
      this._refreshAbilityOptionStates(); // Update disabled states after state change

      this.informerUpdater.update('destiny');
      this.pageNavigator.updateNav();
    } else {
      console.log(`DestinyPageHandler: Re-selected same destiny: ${selectedDestinyId}. No reset performed.`);
    }
  }

  /**
   * Handles click on flaw options.
   * @param {Event} e - The click event.
   * @private
   */
  _handleFlawOptionClick(e) {
    const flawOptionDiv = e.target.closest('.flaw-option');
    if (!flawOptionDiv) return;

    const selectedFlawId = flawOptionDiv.dataset.flawId;

    // Clear any existing destiny-specific flaws and add the new one
    this.stateManager.addOrUpdateFlaw({ id: selectedFlawId, destiny: true }, true);

    // Update UI for flaw selection
    this.selectorPanel.querySelectorAll('.flaw-option').forEach(opt => {
      opt.classList.remove('selected');
    });
    flawOptionDiv.classList.add('selected');

    console.log(`DestinyPageHandler: Flaw selected: ${selectedFlawId}.`);

    this.informerUpdater.update('destiny');
    this.pageNavigator.updateNav();
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

    const abilityId = abilityCard.dataset.abilityId;
    const groupId = abilityCard.dataset.groupId;
    const source = abilityCard.dataset.source;
    const maxChoices = parseInt(abilityCard.dataset.maxChoices, 10);

    const inputElement = abilityCard.querySelector(`input[data-ability="${abilityId}"][data-group="${groupId}"][data-source="${source}"]`);
    if (!inputElement) {
      console.warn('DestinyPageHandler: Could not find associated input for clicked ability card.');
      return;
    }

    const currentState = this.stateManager.getState();
    const isParentAbilityCurrentlySelected = currentState.abilities.some(a => a.id === abilityId && a.groupId === groupId && a.source === source);

    // Identify if the click target is the main input itself or an element within its associated label.
    // This addresses the "double click on ability-name" bug.
    const mainLabel = inputElement.closest('label');
    const isClickOnMainInputOrLabel = (e.target === inputElement || (mainLabel && mainLabel.contains(e.target)));

    // NEW & IMPROVED: Identify if the click target is anywhere within the nested ability-options container.
    const isClickOnNestedOptionArea = e.target.closest('.ability-options');

    // --- SCENARIO 1: Clicked anywhere within the nested options area ---
    if (isClickOnNestedOptionArea) {
        if (!isParentAbilityCurrentlySelected) {
            // User clicked a nested option, and the parent ability is NOT selected.
            // We want to select the parent ability FIRST.
            inputElement.checked = true; // Manually check the main ability input
            this._processParentAbilitySelection(abilityId, groupId, source, maxChoices, inputElement, true);

            // After selecting the parent, if the actual target was a nested input,
            // dispatch a 'change' event on it so _handleAbilityOptionChange can handle its state correctly.
            const nestedOptionInput = e.target.matches('input[data-option]') ? e.target : e.target.closest('.ability-options label')?.querySelector('input[data-option]');
            if (nestedOptionInput) {
              nestedOptionInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        // In either case (parent was selected or just got selected),
        // we prevent _handleAbilityCardClick from processing further for this click.
        // The nested option's 'change' event (if an input was clicked) will be handled by _handleAbilityOptionChange.
        return;
    }

    // --- SCENARIO 2: Clicked on main ability card (input, label, or other parts *outside* nested options) ---
    // This logic handles the main ability selection/deselection and addresses the double-click bug.
    let intendedSelectionState;
    if (isClickOnMainInputOrLabel) {
        // If click is on main input or its label, rely on browser's native toggle.
        // The inputElement.checked already reflects the state after browser's native toggle.
        intendedSelectionState = inputElement.checked;
    } else {
        // If click is on other parts of the card (not main input/label, and not nested options),
        // manually toggle the main input.
        intendedSelectionState = !inputElement.checked;
        inputElement.checked = intendedSelectionState; // Apply the manual toggle immediately
    }

    // Process the parent ability selection/deselection based on 'intendedSelectionState'
    this._processParentAbilitySelection(abilityId, groupId, source, maxChoices, inputElement, intendedSelectionState);
  }

  /**
   * Helper function to encapsulate parent ability selection/deselection logic.
   * This is called by _handleAbilityCardClick for both direct clicks and nested option clicks
   * that need to select the parent.
   * @param {string} abilityId
   * @param {string} groupId
   * @param {string} source
   * @param {number} maxChoices - The max choices for the ability group.
   * @param {HTMLInputElement} inputElement - The main ability checkbox/radio input.
   * @param {boolean} intendedSelectionState - The desired checked state for the parent ability.
   * @private
   */
  _processParentAbilitySelection(abilityId, groupId, source, maxChoices, inputElement, intendedSelectionState) {
    const currentState = this.stateManager.getState();
    let currentAbilities = [...currentState.abilities]; // Create a mutable copy

    const selectedAbilitiesInGroup = currentAbilities.filter(a => a.groupId === groupId && a.source === source);
    const isCurrentlyInState = selectedAbilitiesInGroup.some(a => a.id === abilityId);

    const abilityCard = inputElement.closest('.ability-card'); // Get card from input for class toggling

    if (maxChoices === 1) { // Radio button behavior
      if (intendedSelectionState) { // If we intend to select this radio
        // Filter out any existing selections from this group
        const filteredAbilities = currentAbilities.filter(a => !(a.groupId === groupId && a.source === source));
        filteredAbilities.push({ id: abilityId, selections: [], source: source, groupId: groupId });
        this.stateManager.set('abilities', filteredAbilities);

        // Update visual 'selected' class for ability cards within the same group
        this.selectorPanel.querySelectorAll(`.ability-card[data-group-id="${groupId}"][data-source="${source}"]`).forEach(card => {
          card.classList.remove('selected');
        });
        abilityCard.classList.add('selected');
        inputElement.checked = true; // Ensure the radio is checked
      }
      // If intendedSelectionState is false for a radio, it means we clicked an already selected radio
      // or clicked a different radio, which is handled by the 'if (intendedSelectionState)' block above.
      // No explicit deselection logic needed for radios here, as they are inherently single-select.
    } else { // Checkbox behavior
      if (intendedSelectionState && !isCurrentlyInState) { // Selecting
        if (selectedAbilitiesInGroup.length < maxChoices) {
          currentAbilities.push({ id: abilityId, selections: [], source: source, groupId: groupId });
          this.stateManager.set('abilities', currentAbilities);

          abilityCard.classList.add('selected');
          inputElement.checked = true;
        } else {
          alerter.show(`You can only select up to ${maxChoices} abilities from this group.`);
          inputElement.checked = false; // Revert checkbox if max choices exceeded
          this._refreshAbilityOptionStates(); // Update UI immediately after failed selection
          return; // Stop further processing if max choices are met
        }
      } else if (!intendedSelectionState && isCurrentlyInState) { // Deselecting
        currentAbilities = currentAbilities.filter(a => !(a.id === abilityId && a.groupId === groupId && a.source === source));
        this.stateManager.set('abilities', currentAbilities);

        abilityCard.classList.remove('selected');
        inputElement.checked = false;
      } else {
          // This case happens if the click resulted in no actual state change (e.g., clicking already selected checkbox).
          // We still need to update informer/nav and refresh UI for consistency.
          console.log(`DestinyPageHandler: Click on ${abilityId} resulted in no state change (current: ${isCurrentlyInState}, intended: ${intendedSelectionState}).`);
      }
    }

    console.log(`DestinyPageHandler: Ability selected/deselected: ${abilityId}, intended: ${intendedSelectionState}.`);
    this.informerUpdater.update('destiny');
    this.pageNavigator.updateNav(); // Update navigation based on completion
    this._refreshAbilityOptionStates();
  }

  /**
   * Handles change event on nested ability option checkboxes/radio buttons.
   * @param {Event} e - The change event.
   * @private
   */
  _handleAbilityOptionChange(e) {
    // Ensure the event target is an input with data-option (i.e., a nested option)
    if (!e.target.matches('input[data-option]')) {
      return;
    }

    const optionInput = e.target;
    const abilityId = optionInput.dataset.ability;
    const optionId = optionInput.dataset.option;
    // Get groupId and source from the closest parent .ability-card
    const parentAbilityCard = optionInput.closest('.ability-card');
    const groupId = parentAbilityCard.dataset.groupId;
    const source = parentAbilityCard.dataset.source;
    
    const isSelectedFromInput = optionInput.checked; // This is the actual checked state after user interaction

    this._handleAbilityOptionSelection(abilityId, source, groupId, optionId, isSelectedFromInput, optionInput);
  }

  /**
   * Handles the selection of a specific ability from a group.
   * This is typically for radio button style selections within a group.
   * NOTE: This method is largely superseded by _processParentAbilitySelection for clarity and unification.
   * It's kept for any legacy calls that might still exist, but direct calls to it might be removed
   * in favor of _processParentAbilitySelection or direct input toggling.
   * @param {string} groupId - The ID of the group the ability belongs to.
   * @param {string} abilityId - The ID of the selected ability.
   * @param {string} source - The source of the ability (e.g., 'destiny').
   * @private
   */
  _handleGroupSelection(groupId, abilityId, source) {
    console.log(`DestinyPageHandler._handleGroupSelection: Group ${groupId}, Ability: ${abilityId}, Source: ${source}`);
    const currentState = this.stateManager.getState();
    let currentAbilities = [...currentState.abilities];

    // Filter out any existing selections from this group and add the new one
    const filteredAbilities = currentAbilities.filter(a => !(a.groupId === groupId && a.source === source));
    filteredAbilities.push({
      id: abilityId,
      selections: [], // Reset selections for the newly chosen ability in this group
      source: source,
      groupId: groupId
    });
    this.stateManager.set('abilities', filteredAbilities);

    // After updating state, refresh all ability option states globally to reflect changes
    this._refreshAbilityOptionStates();
    this.informerUpdater.update('destiny');
  }

  /**
   * Handles the selection/deselection of an ability option (checkbox/radio) nested within an ability.
   * @param {string} abilityId - The ID of the parent ability.
   * @param {string} source - The source of the parent ability.
   * @param {string} groupId - The ID of the group the parent ability belongs to.
   * @param {string} optionId - The ID of the option selected/deselected.
   * @param {boolean} isSelectedFromInput - True if the input element is checked after the user's interaction, false otherwise.
   * @param {HTMLElement} inputElement - The input element (checkbox/radio).
   * @private
   */
  _handleAbilityOptionSelection(abilityId, source, groupId, optionId, isSelectedFromInput, inputElement) {
    const currentState = this.stateManager.getState();
    // Ensure we find the specific ability by ID, source, and groupId
    const abilityState = currentState.abilities.find(a => a.id === abilityId && a.source === source && a.groupId === groupId);

    if (!abilityState) {
      console.warn(`DestinyPageHandler._handleAbilityOptionSelection: Parent ability '${abilityId}' (source: ${source}, group: ${groupId}) NOT FOUND IN STATE. Cannot select nested option.`);
      inputElement.checked = false; // Ensure it's unchecked if parent isn't selected or in state
      this._refreshAbilityOptionStates();
      return;
    }

    const abilityDef = this.stateManager.getAbility(abilityId);
    let newSelections = [...abilityState.selections]; // Create a mutable copy

    // Determine if the option was *already* selected in the state
    const isOptionCurrentlyInState = abilityState.selections.some(s => s.id === optionId);

    if (inputElement.type === 'radio') {
      // For radio buttons, a click implies selection. We directly update the state.
      // Since it's a radio, it should be the *only* selection in its group.
      newSelections = [{ id: optionId }];
      // Visual state of radio is handled by browser/refresh, no need to explicitly check here after the initial input click
    } else { // Checkbox logic
      if (isOptionCurrentlyInState) { // Option is currently selected in state, user clicked to DESELECT
        newSelections = newSelections.filter(s => s.id !== optionId);
      } else { // Option is NOT currently selected in state, user clicked to SELECT
        if (abilityDef.maxChoices !== undefined && abilityDef.maxChoices !== null &&
            newSelections.length >= abilityDef.maxChoices) {
          inputElement.checked = false; // Revert checkbox state if over limit
          alerter.show(`You can only select up to ${abilityDef.maxChoices} option(s) for ${abilityDef.name}.`);
          this._refreshAbilityOptionStates(); // Refresh to ensure UI consistency
          return;
        }
        newSelections.push({ id: optionId });
      }
    }
    // Update the parent ability's selections array in the state
    this.stateManager.updateAbilitySelections(abilityId, source, groupId, newSelections);
    this.informerUpdater.update('destiny');
    this._refreshAbilityOptionStates(); // Update disabled states based on new selections
  }

  /**
   * Restores the selections for destiny, flaws, and abilities based on the current state.
   * @private
   */
  _restoreState() {
    const currentState = this.stateManager.getState();

    // Restore selected destiny option
    if (currentState.destiny) {
      const destinyOptionDiv = this.selectorPanel.querySelector(`.destiny-option[data-destiny-id="${currentState.destiny}"]`);
      if (destinyOptionDiv) {
        destinyOptionDiv.classList.add('selected');
        console.log(`DestinyPageHandler._restoreState: Destiny option "${currentState.destiny}" re-selected.`);
      }
    }

    // Restore selected flaw div based on the 'destiny' flag
    const selectedDestinyFlaw = currentState.flaws.find(f => f.destiny === true);
    if (selectedDestinyFlaw) {
      const flawDiv = this.selectorPanel.querySelector(`.flaw-option[data-flaw-id="${selectedDestinyFlaw.id}"]`);
      if (flawDiv) {
        flawDiv.classList.add('selected');
        console.log(`DestinyPageHandler._restoreState: Flaw option "${selectedDestinyFlaw.id}" re-selected.`);
      }
    }

    // Restore selected ability cards and their inputs (only those from 'destiny' source)
    currentState.abilities.forEach(abilityState => {
      // Ensure we only restore abilities originating from this page ('destiny')
      if (abilityState.source === 'destiny') {
        const abilityCard = this.selectorPanel.querySelector(
          `.ability-card[data-ability-id="${abilityState.id}"][data-group-id="${abilityState.groupId}"][data-source="${abilityState.source}"]`
        );
        if (abilityCard) {
          abilityCard.classList.add('selected');
          // Select the correct input element within the card based on type (radio/checkbox)
          const groupDef = this.stateManager.getDestiny(currentState.destiny)?.abilityGroups?.[abilityState.groupId];
          const inputType = groupDef?.maxChoices === 1 ? 'radio' : 'checkbox';
          const inputElement = abilityCard.querySelector(`input[type="${inputType}"][data-ability="${abilityState.id}"][data-group="${abilityState.groupId}"][data-source="${abilityState.source}"]`);

          if (inputElement) {
            inputElement.checked = true;
          }
          console.log(`DestinyPageHandler._restoreState: Ability card "${abilityState.id}" (Group ${abilityState.groupId}, Source: ${abilityState.source}) re-selected.`);

          // Restore nested ability options
          if (abilityState.selections && abilityState.selections.length > 0) {
            abilityState.selections.forEach(option => {
              const optionInput = abilityCard.querySelector(`input[data-ability="${abilityState.id}"][data-option="${option.id}"]`);
              if (optionInput) {
                optionInput.checked = true;
              }
            });
          }
        }
      }
    });

    this._autoSelectSingleAbilityGroup(); // Re-run auto-selection on restore
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

    // After rendering destinies, render the associated flaw and ability sections
    this._renderFlawSelection();
    this._renderAbilityGroupsSection(); // Call the new method for rendering ability groups
  }

  /**
   * Renders the flaw selection section for the current destiny.
   * @private
   */
  _renderFlawSelection() {
    const destinyDetailsContainer = this.selectorPanel.querySelector('.destiny-details');
    // Remove old destiny-details container if it exists and no destiny is selected
    if (!this.stateManager.get('destiny')) {
        if (destinyDetailsContainer) destinyDetailsContainer.remove();
        return;
    }

    const destiny = this.stateManager.getDestiny(this.stateManager.get('destiny'));
    if (!destiny) {
        console.warn('DestinyPageHandler: No destiny data to render flaws.');
        return;
    }

    const container = document.createElement('div');
    container.className = 'destiny-details';

    // Helper to check if a flaw is currently selected as a 'destiny' flaw
    const isFlawSelected = (flawId) =>
      this.stateManager.get('flaws').some(f => f.id === flawId && f.destiny === true);

    container.innerHTML = `
      <div class="flaw-selection">
        <h4>Choose your Flaw:</h4>
        <div class="flaw-options-container">
          ${destiny.flaws.map(flawId => {
            const flaw = this.stateManager.getFlaw(flawId);
            if (!flaw) {
              console.warn(`DestinyPageHandler: Missing flaw data for ID: ${flawId}`);
              return '';
            }
            return `
              <div class="flaw-option ${isFlawSelected(flawId) ? 'selected' : ''}"
                   data-flaw-id="${flawId}">
                <span class="flaw-name">${flaw.name}</span>
                <span class="flaw-description">${flaw.description}</span>
              </div>`;
          }).join('')}
        </div>
      </div>
    `;

    // Replace or append the destiny details container
    if (destinyDetailsContainer) {
      destinyDetailsContainer.replaceWith(container);
      console.log('DestinyPageHandler: Replaced existing destiny-details container.');
    } else {
      // Find the appropriate place to insert; often below the destiny options
      const destinyOptionsSection = document.getElementById('destiny-options-container');
      if (destinyOptionsSection) {
          destinyOptionsSection.parentNode.insertBefore(container, destinyOptionsSection.nextSibling);
          console.log('DestinyPageHandler: Appended new destiny-details container.');
      } else {
          this.selectorPanel.appendChild(container); // Fallback
          console.log('DestinyPageHandler: Appended new destiny-details container (fallback).');
      }
    }
  }

  /**
   * Renders the ability groups section for the current destiny.
   * @private
   */
  _renderAbilityGroupsSection() {
    const abilitiesSection = this.selectorPanel.querySelector('.abilities-section');
    // Remove old abilities section if it exists and no destiny is selected
    if (!this.stateManager.get('destiny')) {
        if (abilitiesSection) abilitiesSection.remove();
        return;
    }

    const destiny = this.stateManager.getDestiny(this.stateManager.get('destiny'));
    if (!destiny || !destiny.abilityGroups) {
        console.warn('DestinyPageHandler: No destiny data or ability groups to render abilities.');
        return;
    }

    const container = document.createElement('div');
    container.className = 'abilities-section';
    container.innerHTML = '<h4>Choose Your Abilities</h4>';

    const currentAbilitiesState = this.stateManager.get('abilities');

    Object.entries(destiny.abilityGroups).forEach(([groupId, groupDef]) => {
      const maxChoicesText = groupDef.maxChoices === 1 ? 'Choose 1' : `Choose ${groupDef.maxChoices}`;
      container.innerHTML += `<h5 class="group-header">${groupDef.name} (${maxChoicesText})</h5>`;

      const groupGridContainer = document.createElement('div');
      groupGridContainer.className = 'abilities-grid-container';

      groupDef.abilities.forEach(abilityId => {
        const ability = this.stateManager.getAbility(abilityId);
        if (!ability) {
          console.warn(`DestinyPageHandler: Missing ability: ${abilityId} in group ${groupId}`);
          return;
        }

        // Check if this ability is selected for THIS specific group AND source 'destiny'
        const isSelected = currentAbilitiesState.some(a =>
          a.id === abilityId && a.groupId === groupId && a.source === 'destiny'
        );

        const abilityTypeClass = ability.type === 'active' ? 'active' : (ability.type === 'passive' ? 'passive' : '');
        const inputType = groupDef.maxChoices === 1 ? 'radio' : 'checkbox';
        const inputName = groupDef.maxChoices === 1 ? `name="group-${groupId}"` : ''; // Radios need a name for exclusivity

        groupGridContainer.innerHTML += `
          <div class="ability-container">
              <div class="ability-card ${isSelected ? 'selected' : ''}"
                   data-ability-id="${abilityId}"
                   data-group-id="${groupId}"
                   data-max-choices="${groupDef.maxChoices}"
                   data-source="destiny">
                  <div class="ability-header">
                      <label>
                          <input type="${inputType}" ${inputName}
                              ${isSelected ? 'checked' : ''}
                              data-ability="${abilityId}"
                              data-group="${groupId}"
                              data-source="destiny">
                          <span class="ability-name">${ability.name}</span>
                      </label>
                      <div class="ability-types">
                          <span class="type-tag ${abilityTypeClass}">${this._getTypeIcon(ability.type)} ${ability.type}</span>
                      </div>
                  </div>
                  <div class="ability-description">${this._renderAbilityDescription(ability)}</div>
                  ${ability.options ? this._renderAbilityOptions(ability, abilityId, groupId, 'destiny') : ''}
              </div>
          </div>
        `;
      });
      container.appendChild(groupGridContainer);
    });

    if (abilitiesSection) {
      abilitiesSection.replaceWith(container);
      console.log('DestinyPageHandler: Replaced existing abilities section.');
    } else {
      const destinyDetails = this.selectorPanel.querySelector('.destiny-details');
      if (destinyDetails) {
          destinyDetails.parentNode.insertBefore(container, destinyDetails.nextSibling);
          console.log('DestinyPageHandler: Appended new abilities section after destiny details.');
      } else {
          this.selectorPanel.appendChild(container); // Fallback
          console.log('DestinyPageHandler: Appended new abilities section (fallback).');
      }
    }
  }

  /**
   * Helper function to get type icons for abilities.
   * @param {string} type - The type of ability (e.g., 'Combat', 'Passive').
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
      'Active': '⚡'
    };
    return icons[type] || '✨';
  }

  /**
   * Helper function to render ability descriptions with interpolated values.
   * @param {Object} ability - The ability or option object.
   * @returns {string} The rendered description HTML.
   * @private
   */
  _renderAbilityDescription(ability) {
    let desc = ability.description;
    desc = desc.replace(/\${([^}]+)}/g, (match, p1) => {
      let value;
      try {
        const path = p1.split('.');
        let current = ability;
        for (let i = 0; i < path.length; i++) {
          if (current === null || current === undefined) {
            current = undefined;
            break;
          }
          current = current[path[i]];
        }
        value = current;

        if (value === undefined && typeof ability[p1] !== 'undefined') {
          value = ability[p1];
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
   * Helper function to render ability options (checkboxes/radio buttons) nested within an ability.
   * @param {Object} ability - The parent ability object.
   * @param {string} abilityId - The ID of the parent ability.
   * @param {string} groupId - The ID of the group the parent ability belongs to.
   * @param {string} source - The source of the parent ability.
   * @returns {string} HTML string for options.
   * @private
   */
  _renderAbilityOptions(ability, abilityId, groupId, source) {
    if (!ability.options) return '';

    const currentState = this.stateManager.getState();
    // When rendering, check for the specific ability (ID + source + groupId)
    const abilityState = currentState.abilities.find(a => a.id === abilityId && a.source === source && a.groupId === groupId);
    const currentSelections = abilityState ? abilityState.selections : [];
    const isParentAbilityCurrentlySelected = !!abilityState;

    const inputType = (ability.maxChoices === 1) ? 'radio' : 'checkbox';
    // For nested options, the name should be unique to the parent ability's options, not the group.
    const inputName = (inputType === 'radio') ? `name="ability-options-${abilityId}"` : '';
    const chooseText = (ability.maxChoices === 1) ? 'Choose one' : `Choose ${ability.maxChoices || 'any'}`;

    return `
      <div class="ability-options">
          <p>${chooseText}:</p>
          ${ability.options.map(option => {
            const isOptionSelected = currentSelections.some(s => s.id === option.id);
            const disabledAttribute = !isParentAbilityCurrentlySelected ? 'disabled' : ''; // Initial disabled
            const checkedAttribute = isOptionSelected ? 'checked' : '';

            return `
                <label class="ability-option">
                    <input type="${inputType}"
                        ${inputName}
                        ${checkedAttribute}
                        data-ability="${abilityId}"
                        data-option="${option.id}"
                        data-group="${groupId}"
                        data-source="${source}"
                        ${disabledAttribute}
                    >
                    ${option.name}: ${this._renderAbilityDescription(option)}
                </label>`;
          }).join('')}
      </div>
      `;
  }

  /**
   * Auto-selects abilities if a group has only one option and it's not already selected.
   * @private
   */
  _autoSelectSingleAbilityGroup() {
    const currentState = this.stateManager.getState();
    if (!currentState.destiny) return;

    const destiny = this.stateManager.getDestiny(currentState.destiny);
    if (!destiny || !destiny.abilityGroups) return;

    Object.entries(destiny.abilityGroups).forEach(([groupId, groupDef]) => {
      // Auto-select if exactly one ability in group AND it's a "choose 1" group for the *group itself*
      if (groupDef.abilities.length === 1 && groupDef.maxChoices === 1) {
        const singleAbilityId = groupDef.abilities[0];
        const source = 'destiny'; // Assuming destiny page always implies 'destiny' source for its abilities

        // Check if this specific ability from 'destiny' source and group is already selected
        const isAlreadySelected = currentState.abilities.some(a =>
          a.id === singleAbilityId && a.groupId === groupId && a.source === source
        );

        if (!isAlreadySelected) {
          console.log(`DestinyPageHandler: Auto-selecting ability "${singleAbilityId}" for Group ${groupId} (Source: ${source}).`);
          // Simulate input check and call the handler for group selection
          const inputElement = this.selectorPanel.querySelector(
            `.ability-card[data-ability-id="${singleAbilityId}"][data-group-id="${groupId}"][data-source="${source}"] input[type="radio"]` // Assuming radio for auto-select single
          );
          if (inputElement) {
            inputElement.checked = true; // Visually check
            // Use _processParentAbilitySelection as it's the unified handler now
            this._processParentAbilitySelection(singleAbilityId, groupId, source, groupDef.maxChoices, inputElement, true);
          }
        }
      }
    });
  }

  /**
   * Refreshes the disabled and checked states of all ability options (checkboxes/radio buttons).
   * This is crucial after any state change that affects ability selections.
   * @private
   */
  _refreshAbilityOptionStates() {
    console.log('DestinyPageHandler._refreshAbilityOptionStates: Updating all ability option disabled states.');
    const currentState = this.stateManager.getState();

    // Iterate through each ability card on the page
    this.selectorPanel.querySelectorAll('.ability-card').forEach(abilityCard => {
      const abilityId = abilityCard.dataset.abilityId;
      const groupId = abilityCard.dataset.groupId;
      const source = abilityCard.dataset.source;
      const maxChoicesForGroup = parseInt(abilityCard.dataset.maxChoices, 10);

      const abilityData = this.stateManager.getAbility(abilityId);
      if (!abilityData) {
        console.warn(`_refreshAbilityOptionStates: Missing abilityData for ${abilityId}. Skipping updates for its options.`);
        return; // Should not happen if data is loaded correctly
      }

      // Find the ability state for THIS specific ability coming from 'destiny' page
      const abilityState = currentState.abilities.find(a => a.id === abilityId && a.source === source && a.groupId === groupId);
      const isParentAbilityCurrentlySelected = !!abilityState;

      // Update parent ability card visual 'selected' state
      if (isParentAbilityCurrentlySelected) {
        abilityCard.classList.add('selected');
      } else {
        abilityCard.classList.remove('selected');
      }

      // Handle the main ability input (radio/checkbox for selecting the ability itself within the group)
      const mainAbilityInput = abilityCard.querySelector(`input[data-ability="${abilityId}"][data-group="${groupId}"][data-source="${source}"]`);
      if (mainAbilityInput) {
        const selectedAbilitiesInThisGroup = currentState.abilities.filter(a => a.groupId === groupId && a.source === source);
        const countSelectedInGroup = selectedAbilitiesInThisGroup.length;

        if (maxChoicesForGroup === 1) { // Radio button group
          // Only the truly selected ability for this group should be checked and enabled.
          mainAbilityInput.checked = isParentAbilityCurrentlySelected;
          mainAbilityInput.disabled = false; // All radios within a "choose 1" group are always enabled if the group itself is enabled.
        } else { // Checkbox group
          mainAbilityInput.checked = isParentAbilityCurrentlySelected; // Checkbox state directly reflects its selection
          // Disable if max choices are reached AND this ability is NOT currently selected
          mainAbilityInput.disabled = (countSelectedInGroup >= maxChoicesForGroup && !isParentAbilityCurrentlySelected);
        }
      }


      // Now handle nested options within this ability card
      const optionsContainer = abilityCard.querySelector('.ability-options');
      if (optionsContainer && abilityData && abilityData.options) {
        optionsContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(optionInput => {
          const optionId = optionInput.dataset.option;
          // Check if this option is selected WITHIN this specific ability's selections
          const isOptionSelected = abilityState ? abilityState.selections.some(s => s.id === optionId) : false;

          let shouldBeDisabled = false;

          if (!isParentAbilityCurrentlySelected) {
            shouldBeDisabled = true; // Nested options disabled if parent ability is not selected
            if (optionInput.checked) {
              optionInput.checked = false; // Ensure unselected parent's options are unchecked
            }
          } else {
            const currentSelectionsCount = abilityState.selections.length;
            const maxChoicesForOption = abilityData.maxChoices; // This refers to nested options' maxChoices

            console.debug(`  Option: ${optionId}, isSelected (from state): ${isOptionSelected}, currentSelectionsCount: ${currentSelectionsCount}, maxChoicesForOption: ${maxChoicesForOption}`);

            if (optionInput.type === 'radio') {
              shouldBeDisabled = false; // Nested radios always enabled if parent is selected
            } else { // Nested Checkbox logic
              if (maxChoicesForOption !== undefined && maxChoicesForOption !== null &&
                  currentSelectionsCount >= maxChoicesForOption && !isOptionSelected) {
                shouldBeDisabled = true;
                console.debug(`    Option ${optionId} DISABLED: Max choices reached (${currentSelectionsCount}/${maxChoicesForOption}) and option not selected.`);
              } else {
                shouldBeDisabled = false;
                console.debug(`    Option ${optionId} ENABLED.`);
              }
            }
          }
          optionInput.disabled = shouldBeDisabled;
          optionInput.checked = isOptionSelected; // Ensure input reflects state
          console.debug(`    Option ${optionId} final state: disabled=${optionInput.disabled}, checked=${optionInput.checked}`);
        });
      } else if (optionsContainer) {
        console.debug(`_refreshAbilityOptionStates: Ability ${abilityId} has optionsContainer but no options in abilityData.`);
      }
    });
    this.pageNavigator.updateNav(); // Update navigation based on completion
  }
}

export { DestinyPageHandler };
