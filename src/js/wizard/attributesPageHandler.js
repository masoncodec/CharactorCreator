// attributesPageHandler.js
// This module handles the UI rendering and event handling for the 'attributes' assignment page.
// It includes the logic for managing dice assignments to attributes.

import { alerter } from '../alerter.js'; // Assuming alerter.js is available

/**
 * @private
 * DiceManager class encapsulates the logic for assigning dice to attributes.
 * It is designed to be used internally by AttributesPageHandler.
 */
class DiceManager {
  /**
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   * @param {HTMLElement} tableElement - The DOM element representing the dice assignment table.
   */
  constructor(stateManager, tableElement) {
    this.stateManager = stateManager;
    this.tableElement = tableElement; // Reference to the actual table DOM element

    this.selectedDice = new Map();     // Maps die (e.g., 'd4') to attribute (e.g., 'strength')
    this.assignedAttributes = new Map(); // Maps attribute to die
    this.boundProcessSelection = null; // To store bound event listener

    console.log('DiceManager: Initialized.');
  }

  /**
   * Initializes or re-initializes the dice manager, clearing previous states and
   * restoring assignments from the wizard's state.
   */
  init() {
    console.log('DiceManager.init: Initializing/re-initializing dice manager.');
    this.selectedDice.clear();
    this.assignedAttributes.clear();

    // Reset all buttons visually
    this.tableElement.querySelectorAll('button').forEach(btn => {
      btn.classList.remove('selected');
      btn.disabled = false;
      btn.textContent = btn.dataset.die.toUpperCase();
    });

    // Restore previous attribute assignments from wizard state
    const currentAttributesState = this.stateManager.get('attributes');
    console.log('DiceManager.init: Restoring previous attribute assignments from wizard state:', currentAttributesState);
    Object.entries(currentAttributesState).forEach(([attr, die]) => {
      this.selectedDice.set(die, attr);
      this.assignedAttributes.set(attr, die);
      const btn = this.tableElement.querySelector(`tr[data-attribute="${attr}"] button[data-die="${die}"]`);
      if (btn) {
        btn.classList.add('selected');
        console.log(`DiceManager.init: Restored UI selection for ${attr} with ${die}.`);
      }
    });

    // Ensure only one event listener is active on the correct table
    if (this.boundProcessSelection) {
      this.tableElement.removeEventListener('click', this.boundProcessSelection);
    }
    // Bind 'this' context for the event listener
    this.boundProcessSelection = this._handleTableClick.bind(this);
    this.tableElement.addEventListener('click', this.boundProcessSelection);
    console.log('DiceManager.init: Event listener attached to dice assignment table.');

    this._updateDieStates(); // Update button disabled states based on current assignments
    console.log('DiceManager.init: Dice manager initialized.');
  }

  /**
   * Handles the click event from the table, delegating to processSelection.
   * @param {Event} e - The click event.
   * @private
   */
  _handleTableClick(e) {
    const button = e.target.closest('button[data-die]');
    if (!button) return;

    const row = button.closest('tr');
    const attribute = row.dataset.attribute;
    const die = button.dataset.die;

    this._processSelection(attribute, die, button);
  }

  /**
   * Processes a die selection for an attribute.
   * @param {string} attribute - The attribute being assigned.
   * @param {string} die - The die type (e.g., 'd4').
   * @param {HTMLElement} button - The clicked button element.
   * @private
   */
  _processSelection(attribute, die, button) {
    const currentAssignmentForAttribute = this.assignedAttributes.get(attribute);
    console.log(`DiceManager._processSelection: Processing selection for attribute '${attribute}'. Current assignment: ${currentAssignmentForAttribute || 'None'}. New selection: ${die}.`);

    if (currentAssignmentForAttribute === die) {
      console.log(`DiceManager._processSelection: Unassigning ${die} from ${attribute}.`);
      this._clearAssignment(attribute, die);
      button.classList.remove('selected');
    } else {
      if (this.selectedDice.has(die)) {
        const assignedToAttr = this.selectedDice.get(die);
        console.warn(`DiceManager._processSelection: Die ${die} is already assigned to ${assignedToAttr}. Blocking selection.`);
        alerter.show(`This die type (${die.toUpperCase()}) is already assigned to ${assignedToAttr.charAt(0).toUpperCase() + assignedToAttr.slice(1)}`);
        return;
      }

      if (currentAssignmentForAttribute) {
        console.log(`DiceManager._processSelection: Clearing previous assignment (${currentAssignmentForAttribute}) for attribute ${attribute}.`);
        this._clearAssignment(attribute, currentAssignmentForAttribute);
      }

      console.log(`DiceManager._processSelection: Assigning ${die} to ${attribute}.`);
      this.selectedDice.set(die, attribute);
      this.assignedAttributes.set(attribute, die);
      button.classList.add('selected');
    }

    this._updateDieStates();
    this._updateState();
    // Signal to the parent handler/navigator that state might have changed for UI updates
    document.dispatchEvent(new CustomEvent('wizard:stateChange', { detail: { page: 'attributes' } }));
  }

  /**
   * Clears a specific die assignment from an attribute.
   * @param {string} attribute - The attribute.
   * @param {string} die - The die to clear.
   * @private
   */
  _clearAssignment(attribute, die) {
    console.log(`DiceManager._clearAssignment: Clearing assignment of die ${die} from attribute ${attribute}.`);
    this.selectedDice.delete(die);
    this.assignedAttributes.delete(attribute);
    const btn = this.tableElement.querySelector(`tr[data-attribute="${attribute}"] button[data-die="${die}"]`);
    if (btn) btn.classList.remove('selected');
  }

  /**
   * Updates the disabled states of all die buttons based on current assignments.
   * @private
   */
  _updateDieStates() {
    // console.log('DiceManager._updateDieStates: Updating disabled states of die buttons.');
    this.tableElement.querySelectorAll('button[data-die]').forEach(button => {
      const die = button.dataset.die;
      const rowAttribute = button.closest('tr').dataset.attribute;
      const currentAssignment = this.assignedAttributes.get(rowAttribute);

      const shouldBeDisabled = !(currentAssignment === die || !this.selectedDice.has(die));
      button.disabled = shouldBeDisabled;
      button.textContent = die.toUpperCase();
    });
  }

  /**
   * Updates the wizard's state with the current attribute assignments.
   * @private
   */
  _updateState() {
    this.stateManager.set('attributes', Object.fromEntries(this.assignedAttributes));
    console.log('DiceManager._updateState: Wizard state attributes updated:', this.stateManager.get('attributes'));
  }
}

class AttributesPageHandler {
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
    this.diceManager = null;    // Instance of DiceManager

    console.log('AttributesPageHandler: Initialized.');
  }

  /**
   * Sets up the attributes page by rendering the dice assignment table and attaching event listeners.
   * This method is called by the main CharacterWizard when the 'attributes' page is loaded.
   * @param {HTMLElement} selectorPanel - The DOM element for the selector panel.
   * @param {HTMLElement} informerPanel - The DOM element for the informer panel (not directly used here).
   */
  setupPage(selectorPanel, informerPanel) {
    this.selectorPanel = selectorPanel;
    console.log('AttributesPageHandler.setupPage: Setting up attributes page.');

    this._renderAttributeTable();
    this._initDiceManager(); // Initialize or re-initialize DiceManager after table is rendered

    // Listen for state changes from DiceManager to update navigation
    this._boundStateChangeHandler = this._handleStateChange.bind(this);
    document.addEventListener('wizard:stateChange', this._boundStateChangeHandler);

    this.informerUpdater.update('attributes');
    this.pageNavigator.updateNav();
  }

  /**
   * Renders the attribute assignment table based on the selected module.
   * @private
   */
  _renderAttributeTable() {
    const currentModule = this.stateManager.get('module');
    // Check if the table needs to be refreshed (e.g., module changed or no table yet)
    let currentTable = this.selectorPanel.querySelector('.dice-assignment-table');
    const previouslyRenderedModule = currentTable ? currentTable.dataset.renderedModule : null;
    const needsTableRefresh = !currentTable || (currentModule && previouslyRenderedModule !== currentModule);

    console.log(`AttributesPageHandler._renderAttributeTable: Needs table refresh: ${needsTableRefresh}. Current Module: ${currentModule}, Previously Rendered: ${previouslyRenderedModule}`);

    if (needsTableRefresh) {
      console.log('AttributesPageHandler._renderAttributeTable: Re-rendering attribute table.');

      const newTable = document.createElement('table');
      newTable.classList.add('dice-assignment-table');
      newTable.dataset.renderedModule = currentModule; // Store the module that rendered this table
      newTable.innerHTML = `
        <thead>
            <tr>
                <th>Attribute</th>
                <th colspan="6">Assign Die</th>
            </tr>
        </thead>
        <tbody></tbody>
      `;

      const newTableBody = newTable.querySelector('tbody');

      if (currentModule) {
        const moduleData = this.stateManager.getModule(currentModule);
        (moduleData?.attributes || []).forEach(attr => {
          const row = document.createElement('tr');
          row.dataset.attribute = attr.toLowerCase();
          row.innerHTML = `
            <td>${attr}</td>
            <td><button type="button" data-die="d4">D4</button></td>
            <td><button type="button" data-die="d6">D6</button></td>
            <td><button type="button" data-die="d8">D8</button></td>
            <td><button type="button" data-die="d10">D10</button></td>
            <td><button type="button" data-die="d12">D12</button></td>
            <td><button type="button" data-die="d20">D20</button></td>
          `;
          newTableBody.appendChild(row);
        });
        console.log(`AttributesPageHandler._renderAttributeTable: Attribute rows generated for module: ${currentModule}`);
      } else {
        console.log('AttributesPageHandler._renderAttributeTable: No module selected, cannot generate attributes table.');
      }

      if (currentTable) {
        currentTable.replaceWith(newTable);
        console.log('AttributesPageHandler._renderAttributeTable: Replaced existing table with new one.');
      } else {
        this.selectorPanel.appendChild(newTable);
        console.log('AttributesPageHandler._renderAttributeTable: Appended new table to selector panel.');
      }
      currentTable = newTable; // Update reference to the new table
    } else {
      console.log('AttributesPageHandler._renderAttributeTable: Attribute table does not need re-rendering. Module is unchanged or table exists.');
    }

    // Reset the moduleChanged flag in stateManager after handling its effect on rendering
    // this specifically is used to reset DOM
    this.stateManager.resetModuleChangedFlag();
  }

  /**
   * Initializes the DiceManager with the current table element.
   * @private
   */
  _initDiceManager() {
    const tableElement = this.selectorPanel.querySelector('.dice-assignment-table');
    if (tableElement) {
      if (!this.diceManager) {
        this.diceManager = new DiceManager(this.stateManager, tableElement);
      } else {
        // If diceManager already exists, update its table reference and re-initialize
        this.diceManager.tableElement = tableElement;
      }
      this.diceManager.init();
    } else {
      console.error('AttributesPageHandler: Dice assignment table not found for DiceManager initialization.');
    }
  }

  /**
   * Handles custom state change events dispatched by DiceManager.
   * @param {CustomEvent} event - The custom event.
   * @private
   */
  _handleStateChange(event) {
    if (event.detail.page === 'attributes') {
      this.informerUpdater.update('attributes');
      this.pageNavigator.updateNav();
    }
  }

  /**
   * Cleans up event listeners when the page is unloaded (optional, for robustness).
   */
  cleanup() {
    console.log('AttributesPageHandler.cleanup: Cleaning up attributes page resources.');
    if (this.boundStateChangeHandler) {
      document.removeEventListener('wizard:stateChange', this._boundStateChangeHandler);
    }
    // DiceManager itself handles removal of its button listeners when re-initialized
  }
}

export { AttributesPageHandler };
