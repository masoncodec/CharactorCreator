// attributesPageHandler.js
// REFACTORED: This module handles the UI rendering and event handling for the 'attributes' assignment page.
// It now dynamically supports multiple data-driven assignment systems (e.g., "KOB" or "Hope/Fear").

import { alerter } from '../alerter.js';

/**
 * @private
 * REFACTORED: Renamed from DiceManager to AttributeAssignmentManager.
 * This class now encapsulates the generic logic for assigning a set of unique values to attributes.
 */
class AttributeAssignmentManager {
  /**
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   * @param {HTMLElement} tableElement - The DOM element representing the value assignment table.
   * @param {Array<any>} valuesToAssign - The array of assignable values from the module data.
   */
  constructor(stateManager, tableElement, valuesToAssign) {
    this.stateManager = stateManager;
    this.tableElement = tableElement;
    this.valuesToAssign = valuesToAssign; // e.g., ['d4', 'd6'] or [-4, -2, 0, 0, 2, 4]

    // REFACTORED: Tracks which value *index* is assigned to which attribute.
    this.usedValuesByIndex = new Map();     // Maps valueIndex (e.g., 2) to attribute (e.g., 'charm')
    this.assignedAttributes = new Map(); // Maps attribute (e.g., 'charm') to value (e.g., 0)
    this.boundProcessSelection = null;

    console.log('AttributeAssignmentManager: Initialized.');
  }

  /**
   * Initializes or re-initializes the manager, clearing previous states and
   * restoring assignments from the wizard's state.
   */
  init() {
    console.log('AttributeAssignmentManager.init: Initializing/re-initializing assignment manager.');
    this.usedValuesByIndex.clear();
    this.assignedAttributes.clear();

    this.tableElement.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));

    // Restore previous attribute assignments from wizard state.
    const currentAttributesState = this.stateManager.get('attributes');
    console.log('AttributeAssignmentManager.init: Restoring assignments from state:', currentAttributesState);
    Object.entries(currentAttributesState).forEach(([attr, value]) => {
      // Find the first available index for this value that isn't already used.
      const valueIndex = this.valuesToAssign.findIndex((val, idx) => val == value && !this.usedValuesByIndex.has(idx));
      
      if (valueIndex !== -1) {
        this.usedValuesByIndex.set(valueIndex, attr);
        this.assignedAttributes.set(attr, value);
        const btn = this.tableElement.querySelector(`tr[data-attribute="${attr}"] button[data-index="${valueIndex}"]`);
        if (btn) {
          btn.classList.add('selected');
        }
      }
    });

    if (this.boundProcessSelection) {
      this.tableElement.removeEventListener('click', this.boundProcessSelection);
    }
    this.boundProcessSelection = this._handleTableClick.bind(this);
    this.tableElement.addEventListener('click', this.boundProcessSelection);

    this._updateButtonStates();
    console.log('AttributeAssignmentManager.init: Initialization complete.');
  }

  _handleTableClick(e) {
    // CHANGED: Listens for more generic data attributes.
    const button = e.target.closest('button[data-value][data-index]');
    if (!button) return;

    const row = button.closest('tr');
    const attribute = row.dataset.attribute;
    const value = button.dataset.value;
    const valueIndex = parseInt(button.dataset.index, 10);

    this._processSelection(attribute, value, valueIndex, button);
  }

  _processSelection(attribute, value, valueIndex, button) {
    const currentAssignmentForAttribute = this.assignedAttributes.get(attribute);
    const isValueAlreadyUsed = this.usedValuesByIndex.has(valueIndex);
    const attributeUsingValue = this.usedValuesByIndex.get(valueIndex);

    // If we click the button that is already selected for this attribute, unassign it.
    if (attributeUsingValue === attribute) {
      this._clearAssignment(attribute, valueIndex);
    } 
    // If the value at this index is used by another attribute, show an error.
    else if (isValueAlreadyUsed) {
      alerter.show(`This value is already assigned to ${attributeUsingValue.charAt(0).toUpperCase() + attributeUsingValue.slice(1)}.`);
      return;
    } 
    // Otherwise, assign the new value.
    else {
      // If this attribute already has a different value, clear that one first.
      if (currentAssignmentForAttribute !== undefined) {
        const oldIndex = Array.from(this.usedValuesByIndex.entries())
                              .find(([idx, attr]) => attr === attribute)[0];
        this._clearAssignment(attribute, oldIndex);
      }
      // Assign the new value.
      this.usedValuesByIndex.set(valueIndex, attribute);
      this.assignedAttributes.set(attribute, value);
      button.classList.add('selected');
    }

    this._updateButtonStates();
    this._updateState();
    document.dispatchEvent(new CustomEvent('wizard:stateChange', { detail: { page: 'attributes' } }));
  }

  _clearAssignment(attribute, valueIndex) {
    this.usedValuesByIndex.delete(valueIndex);
    this.assignedAttributes.delete(attribute);
    const btn = this.tableElement.querySelector(`tr[data-attribute="${attribute}"] button[data-index="${valueIndex}"]`);
    if (btn) btn.classList.remove('selected');
  }

  _updateButtonStates() {
    this.tableElement.querySelectorAll('button[data-index]').forEach(button => {
      const index = parseInt(button.dataset.index, 10);
      const rowAttribute = button.closest('tr').dataset.attribute;
      
      const isUsed = this.usedValuesByIndex.has(index);
      const usedByCurrentAttribute = this.usedValuesByIndex.get(index) === rowAttribute;

      button.disabled = isUsed && !usedByCurrentAttribute;
    });
  }

  _updateState() {
    // Convert the map to a plain object for the state manager.
    const attributesObject = Object.fromEntries(this.assignedAttributes);
    // Ensure that string numbers are converted to actual numbers if needed.
    for(const key in attributesObject) {
        const num = Number(attributesObject[key]);
        if (!isNaN(num) && attributesObject[key] !== '') {
            attributesObject[key] = num;
        }
    }
    this.stateManager.set('attributes', attributesObject);
  }
}

class AttributesPageHandler {
  constructor(stateManager, informerUpdater, pageNavigator, alerter) {
    this.stateManager = stateManager;
    this.informerUpdater = informerUpdater;
    this.pageNavigator = pageNavigator;
    this.alerter = alerter;
    this.selectorPanel = null;
    this.assignmentManager = null; // REFACTORED: Renamed from diceManager

    console.log('AttributesPageHandler: Initialized.');
  }

  setupPage(selectorPanel, informerPanel) {
    this.selectorPanel = selectorPanel;
    console.log('AttributesPageHandler.setupPage: Setting up attributes page.');

    this._renderAttributeTable();
    this._initAssignmentManager();

    this._boundStateChangeHandler = this._handleStateChange.bind(this);
    document.addEventListener('wizard:stateChange', this._boundStateChangeHandler);

    this.informerUpdater.update('attributes');
    this.pageNavigator.updateNav();
  }

  /**
   * REFACTORED: Renders the attribute assignment table dynamically
   * based on the selected module's attribute data.
   * @private
   */
  _renderAttributeTable() {
    this.selectorPanel.innerHTML = ''; // Clear previous content
    const currentModuleId = this.stateManager.get('module');
    if (!currentModuleId) {
      this.selectorPanel.innerHTML = '<p>Select a module first to see available attributes.</p>';
      return;
    }
    
    const moduleData = this.stateManager.getModule(currentModuleId);
    const attrConfig = moduleData?.attributes;

    if (!attrConfig || !attrConfig.names || !attrConfig.values) {
        this.selectorPanel.innerHTML = '<p>The selected module does not have a valid attribute configuration.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'dice-assignment-table'; // Re-using class for styling
    
    // Generate Header
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    const th1 = document.createElement('th');
    th1.textContent = 'Attribute';
    headerRow.appendChild(th1);
    const th2 = document.createElement('th');
    th2.textContent = 'Assign Value';
    th2.colSpan = attrConfig.values.length;
    headerRow.appendChild(th2);

    // Generate Body
    const tbody = table.createTBody();
    attrConfig.names.forEach(attrName => {
        const row = tbody.insertRow();
        row.dataset.attribute = attrName.toLowerCase();
        const cell = row.insertCell();
        cell.textContent = attrName;

        attrConfig.values.forEach((value, index) => {
            const btnCell = row.insertCell();
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.value = value;
            button.dataset.index = index;
            button.textContent = value.toString().toUpperCase();
            btnCell.appendChild(button);
        });
    });

    this.selectorPanel.appendChild(table);
  }

  /**
   * REFACTORED: Initializes the AttributeAssignmentManager.
   * @private
   */
  _initAssignmentManager() {
    const tableElement = this.selectorPanel.querySelector('.dice-assignment-table');
    const moduleData = this.stateManager.getModule(this.stateManager.get('module'));
    const values = moduleData?.attributes?.values;

    if (tableElement && values) {
      this.assignmentManager = new AttributeAssignmentManager(this.stateManager, tableElement, values);
      this.assignmentManager.init();
    } else {
      console.error('AttributesPageHandler: Attribute table or values not found for AssignmentManager initialization.');
      this.assignmentManager = null;
    }
  }

  _handleStateChange(event) {
    if (event.detail.page === 'attributes') {
      this.informerUpdater.update('attributes');
      this.pageNavigator.updateNav();
    }
  }

  cleanup() {
    console.log('AttributesPageHandler.cleanup: Cleaning up attributes page resources.');
    if (this._boundStateChangeHandler) {
      document.removeEventListener('wizard:stateChange', this._boundStateChangeHandler);
    }
  }
}

export { AttributesPageHandler };