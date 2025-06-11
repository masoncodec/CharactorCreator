// destinyPageHandler.js
// This module handles the UI rendering and event handling for the 'destiny' selection page,
// including destinies, flaws, and abilities.

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
    this._renderAbilitiesSection();
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
   * Renders the abilities section for the current destiny.
   * @private
   */
  _renderAbilitiesSection() {
    const abilitiesSection = this.selectorPanel.querySelector('.abilities-section');
    // Remove old abilities section if it exists and no destiny is selected
    if (!this.stateManager.get('destiny')) {
        if (abilitiesSection) abilitiesSection.remove();
        return;
    }

    const destiny = this.stateManager.getDestiny(this.stateManager.get('destiny'));
    if (!destiny) {
        console.warn('DestinyPageHandler: No destiny data to render abilities.');
        return;
    }

    const container = document.createElement('div');
    container.className = 'abilities-section';
    container.innerHTML = '<h4>Abilities</h4>';

    const abilitiesByTier = {};
    destiny.levelUnlocks.forEach(unlock => {
      if (!abilitiesByTier[unlock.level]) {
        abilitiesByTier[unlock.level] = [];
      }
      abilitiesByTier[unlock.level].push(unlock.ability);
    });

    const currentAbilitiesState = this.stateManager.get('abilities');

    Object.entries(abilitiesByTier).forEach(([tier, abilityIds]) => {
      container.innerHTML += `<h5 class="tier-header">Tier ${tier} (Choose 1)</h5>`;

      const tierGridContainer = document.createElement('div');
      tierGridContainer.className = 'abilities-grid-container';

      abilityIds.forEach(abilityId => {
        const ability = this.stateManager.getAbility(abilityId);
        if (!ability) {
          console.warn(`DestinyPageHandler: Missing ability: ${abilityId}`);
          return;
        }

        // Check if this ability is selected AND its source is 'destiny'
        const isSelected = currentAbilitiesState.some(a => a.id === abilityId && a.tier === parseInt(tier) && a.source === 'destiny');
        const abilityTypeClass = ability.type === 'active' ? 'active' : (ability.type === 'passive' ? 'passive' : '');

        tierGridContainer.innerHTML += `
          <div class="ability-container">
              <div class="ability-card ${isSelected ? 'selected' : ''}" data-ability-id="${abilityId}" data-tier="${tier}">
                  <div class="ability-header">
                      <label>
                          <input type="radio" name="tier-${tier}"
                              ${isSelected ? 'checked' : ''}
                              data-tier="${tier}"
                              data-ability="${abilityId}">
                          <span class="ability-name">${ability.name}</span>
                      </label>
                      <div class="ability-types">
                          <span class="type-tag ${abilityTypeClass}">${this._getTypeIcon(ability.type)} ${ability.type}</span>
                      </div>
                  </div>
                  <div class="ability-description">${this._renderAbilityDescription(ability)}</div>
                  ${ability.options ? this._renderAbilityOptions(ability, abilityId) : ''}
              </div>
          </div>
        `;
      });
      container.appendChild(tierGridContainer);
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
   * Attaches all event listeners for the destiny page.
   * Uses event delegation for dynamically added elements.
   * @private
   */
  _attachEventListeners() {
    // Ensure only one listener per event type on the selectorPanel
    this.selectorPanel.removeEventListener('click', this._boundDestinyOptionClickHandler);
    this.selectorPanel.removeEventListener('click', this._boundFlawOptionClickHandler);
    this.selectorPanel.removeEventListener('click', this._boundAbilityCardClickHandler);
    this.selectorPanel.removeEventListener('change', this._boundAbilityOptionChangeHandler);

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
      this._renderAbilitiesSection();
      this._autoSelectSingleAbilityTier(); // Auto-select abilities if applicable
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
   * Handles click on ability cards (radio buttons).
   * @param {Event} e - The click event.
   * @private
   */
  _handleAbilityCardClick(e) {
    const abilityCard = e.target.closest('.ability-card');
    if (!abilityCard) return;

    const abilityId = abilityCard.dataset.abilityId;
    const tier = abilityCard.dataset.tier;
    const radioInput = abilityCard.querySelector(`input[type="radio"][data-ability="${abilityId}"][data-tier="${tier}"]`);

    if (radioInput && !radioInput.checked) {
      radioInput.checked = true; // Manually check the radio if not already
      this._handleTierSelection(tier, abilityId);

      // Update visual 'selected' class for ability cards within the same tier
      this.selectorPanel.querySelectorAll(`.ability-card[data-tier="${tier}"]`).forEach(card => {
        card.classList.remove('selected');
      });
      abilityCard.classList.add('selected');
    }
  }

  /**
   * Handles change event on ability option checkboxes/radio buttons.
   * @param {Event} e - The change event.
   * @private
   */
  _handleAbilityOptionChange(e) {
    if (e.target.matches('.ability-option input[type="checkbox"]') || e.target.matches('.ability-option input[type="radio"]')) {
      const abilityId = e.target.dataset.ability;
      const optionId = e.target.dataset.option;
      const isSelected = e.target.checked;
      this._handleAbilityOptionSelection(abilityId, optionId, isSelected, e.target);
    }
  }

  /**
   * Handles the selection of a specific ability for a tier.
   * @param {string} tier - The tier of the ability.
   * @param {string} abilityId - The ID of the selected ability.
   * @private
   */
  _handleTierSelection(tier, abilityId) {
    console.log(`DestinyPageHandler._handleTierSelection: Tier ${tier}, Ability: ${abilityId}`);
    // Create a new ability state object, explicitly setting the source
    const newAbilityState = {
      id: abilityId,
      tier: parseInt(tier),
      selections: [],
      source: 'destiny' // <--- Explicitly set source here
    };
    this.stateManager.addOrUpdateAbility(newAbilityState);

    // After updating state, refresh all ability option states globally to reflect changes
    this._refreshAbilityOptionStates();
    this.pageNavigator.updateNav();
  }

  /**
   * Handles the selection/deselection of an ability option (checkbox/radio).
   * @param {string} abilityId - The ID of the parent ability.
   * @param {string} optionId - The ID of the option selected/deselected.
   * @param {boolean} isSelected - True if selected, false if deselected.
   * @param {HTMLElement} inputElement - The input element (checkbox/radio).
   * @private
   */
  _handleAbilityOptionSelection(abilityId, optionId, isSelected, inputElement) {
    const currentState = this.stateManager.getState();
    // Ensure we find the ability by ID and source for correct state update if multiple sources exist
    const abilityState = currentState.abilities.find(a => a.id === abilityId && a.source === 'destiny'); // <--- Find by source too

    if (!abilityState) {
      console.warn(`DestinyPageHandler._handleAbilityOptionSelection: Parent ability '${abilityId}' (source: destiny) not found in state.`);
      inputElement.checked = false; // Ensure it's unchecked if parent isn't selected
      this._refreshAbilityOptionStates();
      return;
    }

    const abilityDef = this.stateManager.getAbility(abilityId);
    let newSelections = [...abilityState.selections]; // Create a mutable copy

    if (inputElement.type === 'radio') {
      newSelections = [{ id: optionId }]; // For radio, always one selection
    } else { // Checkbox logic
      if (isSelected) {
        if (abilityDef.maxChoices !== undefined && abilityDef.maxChoices !== null &&
            newSelections.length >= abilityDef.maxChoices) {
          inputElement.checked = false; // Revert checkbox state
          alerter.show(`You can only select up to ${abilityDef.maxChoices} option(s) for ${abilityDef.name}.`);
          this._refreshAbilityOptionStates();
          return;
        }
        if (!newSelections.some(s => s.id === optionId)) {
          newSelections.push({ id: optionId });
        }
      } else {
        newSelections = newSelections.filter(s => s.id !== optionId);
      }
    }

    this.stateManager.updateAbilitySelections(abilityId, newSelections); // Update state manager
    this._refreshAbilityOptionStates(); // Update disabled states based on new selections
    this.informerUpdater.update('destiny');
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

    // Restore selected ability cards and their radio buttons (only those from 'destiny' source)
    currentState.abilities.forEach(abilityState => {
      // Ensure we only restore abilities originating from this page ('destiny')
      if (abilityState.source === 'destiny') { // <--- Check source here
        const abilityCard = this.selectorPanel.querySelector(`.ability-card[data-ability-id="${abilityState.id}"][data-tier="${abilityState.tier}"]`);
        if (abilityCard) {
          abilityCard.classList.add('selected');
          const radioInput = abilityCard.querySelector('input[type="radio"]');
          if (radioInput) {
            radioInput.checked = true;
          }
          console.log(`DestinyPageHandler._restoreState: Ability card "${abilityState.id}" (Tier ${abilityState.tier}, Source: ${abilityState.source}) re-selected.`);
        }
      }
    });

    this._autoSelectSingleAbilityTier(); // Re-run auto-selection on restore
    this._refreshAbilityOptionStates(); // Crucial to update disabled states based on selections
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
   * Helper function to render ability options (checkboxes/radio buttons).
   * @param {Object} ability - The parent ability object.
   * @param {string} abilityId - The ID of the parent ability.
   * @returns {string} HTML string for options.
   * @private
   */
  _renderAbilityOptions(ability, abilityId) {
    if (!ability.options) return '';

    const currentState = this.stateManager.getState();
    // When rendering, check for the specific ability (ID + source)
    const abilityState = currentState.abilities.find(a => a.id === abilityId && a.source === 'destiny'); // <--- Find by source
    const currentSelections = abilityState ? abilityState.selections : [];
    const isParentAbilityCurrentlySelected = !!abilityState;

    const inputType = (ability.maxChoices === 1) ? 'radio' : 'checkbox';
    const inputName = (inputType === 'radio') ? `name="${abilityId}"` : '';
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
                        ${disabledAttribute}
                    >
                    ${option.name}: ${this._renderAbilityDescription(option)}
                </label>`;
          }).join('')}
      </div>
      `;
  }

  /**
   * Auto-selects abilities if a tier has only one option and it's not already selected.
   * @private
   */
  _autoSelectSingleAbilityTier() {
    const currentState = this.stateManager.getState();
    if (!currentState.destiny) return;

    const destiny = this.stateManager.getDestiny(currentState.destiny);
    const abilitiesByTier = {};
    destiny.levelUnlocks.forEach(unlock => {
      if (!abilitiesByTier[unlock.level]) {
        abilitiesByTier[unlock.level] = [];
      }
      abilitiesByTier[unlock.level].push(unlock.ability);
    });

    Object.entries(abilitiesByTier).forEach(([tier, abilityIds]) => {
      if (abilityIds.length === 1) {
        const singleAbilityId = abilityIds[0];
        // Check if this specific ability from 'destiny' source is already selected
        const isAlreadySelected = currentState.abilities.some(a => a.id === singleAbilityId && a.tier === parseInt(tier) && a.source === 'destiny'); // <--- Check source here

        if (!isAlreadySelected) {
          console.log(`DestinyPageHandler: Auto-selecting ability "${singleAbilityId}" for Tier ${tier} (Source: destiny).`);
          // Simulate radio button click to trigger the full handling logic
          const radioInput = this.selectorPanel.querySelector(
            `.ability-card[data-ability-id="${singleAbilityId}"][data-tier="${tier}"] input[type="radio"]`
          );
          if (radioInput) {
            radioInput.checked = true; // Visually check
            this._handleTierSelection(tier, singleAbilityId); // Call the handler directly
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

    this.selectorPanel.querySelectorAll('.ability-container').forEach(abilityContainer => {
      const abilityCard = abilityContainer.querySelector('.ability-card');
      if (!abilityCard) return;

      const abilityId = abilityCard.dataset.abilityId;
      const abilityData = this.stateManager.getAbility(abilityId);

      // Find the ability state for THIS specific ability coming from 'destiny' page
      const abilityState = currentState.abilities.find(a => a.id === abilityId && a.source === 'destiny'); // <--- Find by source too
      const isParentAbilityCurrentlySelected = !!abilityState;

      // Update card visual selection state
      if (isParentAbilityCurrentlySelected) {
        abilityCard.classList.add('selected');
      } else {
        abilityCard.classList.remove('selected');
      }

      const optionsContainer = abilityCard.querySelector('.ability-options');
      if (optionsContainer && abilityData && abilityData.options) {
        optionsContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(optionInput => {
          const optionId = optionInput.dataset.option;
          // Check if this option is selected WITHIN this specific ability's selections
          const isOptionSelected = abilityState ? abilityState.selections.some(s => s.id === optionId) : false;

          let shouldBeDisabled = false;

          if (!isParentAbilityCurrentlySelected) {
            shouldBeDisabled = true;
            if (optionInput.checked) { // Ensure unselected parent's options are unchecked
              optionInput.checked = false;
              // Clean up state if necessary (should be handled by parent ability deselection)
              // Note: The parent ability deselection logic implicitly clears its selections
              // when a new ability for the same tier/source is chosen.
            }
          } else {
            const currentSelectionsCount = abilityState.selections.length;
            const maxChoices = abilityData.maxChoices;

            if (optionInput.type === 'radio') {
              shouldBeDisabled = false; // Radios are always enabled if parent is selected
            } else { // Checkbox logic
              if (maxChoices !== undefined && maxChoices !== null && currentSelectionsCount >= maxChoices && !isOptionSelected) {
                shouldBeDisabled = true;
              } else {
                shouldBeDisabled = false;
              }
            }
          }
          optionInput.disabled = shouldBeDisabled;
          optionInput.checked = isOptionSelected; // Ensure input reflects state
        });
      }
    });
    this.pageNavigator.updateNav(); // Update navigation based on completion
  }
}

export { DestinyPageHandler };
