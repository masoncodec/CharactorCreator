// attributesPageHandler.js
// This module handles the UI for the 'attributes' assignment page
// UPDATED: Now displays attribute bonuses from leveling and calculates totals.

import { alerter } from '../alerter.js';

/**
 * @private
 * This class encapsulates the generic logic for assigning a set of unique values to attributes.
 * NOTE: This class remains unchanged.
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
    this.valuesToAssign = valuesToAssign;
    this.usedValuesByIndex = new Map();
    this.assignedAttributes = new Map();
    this.boundProcessSelection = null;
  }

  init() {
    this.usedValuesByIndex.clear();
    this.assignedAttributes.clear();
    this.tableElement.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
    const currentAttributesState = this.stateManager.get('attributes');
    Object.entries(currentAttributesState).forEach(([attr, value]) => {
      const valueIndex = this.valuesToAssign.findIndex((val, idx) => val == value && !this.usedValuesByIndex.has(idx));
      if (valueIndex !== -1) {
        this.usedValuesByIndex.set(valueIndex, attr);
        this.assignedAttributes.set(attr, value);
        const btn = this.tableElement.querySelector(`tr[data-attribute="${attr}"] button[data-index="${valueIndex}"]`);
        if (btn) btn.classList.add('selected');
      }
    });
    if (this.boundProcessSelection) {
      this.tableElement.removeEventListener('click', this.boundProcessSelection);
    }
    this.boundProcessSelection = this._handleTableClick.bind(this);
    this.tableElement.addEventListener('click', this.boundProcessSelection);
    this._updateButtonStates();
  }
  _handleTableClick(e) {
    const button = e.target.closest('button[data-value][data-index]');
    if (!button) return;
    const row = button.closest('tr');
    const attribute = row.dataset.attribute;
    const value = button.dataset.value;
    const valueIndex = parseInt(button.dataset.index, 10);
    this._processSelection(attribute, value, valueIndex, button);
  }
  _processSelection(attribute, value, valueIndex, button) {
    const attributeUsingValue = this.usedValuesByIndex.get(valueIndex);
    if (attributeUsingValue === attribute) {
      this._clearAssignment(attribute, valueIndex);
    } else if (this.usedValuesByIndex.has(valueIndex)) {
      alerter.show(`This value is already assigned to ${attributeUsingValue.charAt(0).toUpperCase() + attributeUsingValue.slice(1)}.`);
      return;
    } else {
      if (this.assignedAttributes.has(attribute)) {
        const oldIndex = Array.from(this.usedValuesByIndex.entries()).find(([, attr]) => attr === attribute)[0];
        this._clearAssignment(attribute, oldIndex);
      }
      this.usedValuesByIndex.set(valueIndex, attribute);
      this.assignedAttributes.set(attribute, value);
      button.classList.add('selected');
    }
    this._updateButtonStates();
    this._updateState();
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
    const attributesObject = Object.fromEntries(this.assignedAttributes);
    for (const key in attributesObject) {
      const num = Number(attributesObject[key]);
      if (!isNaN(num) && attributesObject[key] !== '') {
        attributesObject[key] = num;
      }
    }
    this.stateManager.set('attributes', attributesObject);
  }
}


class AttributesPageHandler {
  constructor(stateManager, alerter) {
    this.stateManager = stateManager;
    this.alerter = alerter;
    this.selectorPanel = null;
    this.assignmentManager = null;
    // --- NEW: Bound listener for state changes ---
    this._boundStateChangeHandler = this._updateTotals.bind(this);
    console.log('AttributesPageHandler: Initialized (Refactored).');
  }

  setupPage(selectorPanel, informerPanel, pageNavigator, informerUpdater) {
    this.selectorPanel = selectorPanel;
    this._renderAttributeTable();
    this._initAssignmentManager();
    // --- NEW: Listen for state changes to update totals ---
    document.addEventListener('wizard:stateChange', this._boundStateChangeHandler);
    this._updateTotals(); // Initial call to set totals
  }

  /**
   * --- REPLACED: Now renders a table with Bonus and Total columns. ---
   */
  _renderAttributeTable() {
    this.selectorPanel.innerHTML = '';
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

    // --- NEW: Get level-up bonuses ---
    const bonuses = this.stateManager.getCombinedAttributeBonuses();

    const table = document.createElement('table');
    table.className = 'dice-assignment-table';
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    // --- NEW: Updated header row ---
    headerRow.innerHTML = `<th>Attribute</th><th>Bonus</th><th colspan="${attrConfig.values.length}">Assign Value</th><th>Total</th>`;

    const tbody = table.createTBody();
    attrConfig.names.forEach(attrName => {
        const attrKey = attrName.toLowerCase();
        const bonusValue = bonuses[attrKey] || 0;
        const row = tbody.insertRow();
        row.dataset.attribute = attrKey;
        
        row.insertCell().textContent = attrName; // Attribute Name
        
        const bonusCell = row.insertCell(); // Bonus
        bonusCell.textContent = `+${bonusValue}`;
        bonusCell.className = 'bonus-cell';

        attrConfig.values.forEach((value, index) => { // Assignment Buttons
            const btnCell = row.insertCell();
            btnCell.innerHTML = `<button type="button" data-value="${value}" data-index="${index}">${value.toString().toUpperCase()}</button>`;
        });

        const totalCell = row.insertCell(); // Total
        totalCell.id = `${attrKey}-total`; // ID for easy updating
        totalCell.className = 'total-cell';
        totalCell.textContent = '...';
    });
    this.selectorPanel.appendChild(table);
  }

  /**
   * --- NEW: Updates the 'Total' column for all attributes. ---
   */
  _updateTotals() {
      const bonuses = this.stateManager.getCombinedAttributeBonuses();
      const assigned = this.stateManager.get('attributes');
      
      const moduleData = this.stateManager.getModule(this.stateManager.get('module'));
      const attrNames = moduleData?.attributes?.names || [];

      attrNames.forEach(attrName => {
          const attrKey = attrName.toLowerCase();
          const totalEl = this.selectorPanel.querySelector(`#${attrKey}-total`);
          if (totalEl) {
              const bonusValue = bonuses[attrKey] || 0;
              const assignedValue = assigned[attrKey] || 0;
              const total = assignedValue + bonusValue;
              totalEl.textContent = total;
          }
      });
  }

  _initAssignmentManager() {
    const tableElement = this.selectorPanel.querySelector('.dice-assignment-table');
    const moduleData = this.stateManager.getModule(this.stateManager.get('module'));
    const values = moduleData?.attributes?.values;
    if (tableElement && values) {
      this.assignmentManager = new AttributeAssignmentManager(this.stateManager, tableElement, values);
      this.assignmentManager.init();
    } else {
      this.assignmentManager = null;
    }
  }

  /**
   * --- REPLACED: Informer now shows the full breakdown of attribute values. ---
   */
  getInformerContent() {
    const currentState = this.stateManager.getState();
    const moduleData = this.stateManager.getModule(currentState.module);
    if (!moduleData) return `<h3>Attributes</h3><p>Select a module first.</p>`;

    const attrConfig = moduleData.attributes;
    const bonuses = this.stateManager.getCombinedAttributeBonuses();
    let attributeList = '<li>No attributes configured.</li>';

    if (attrConfig && attrConfig.names) {
        attributeList = attrConfig.names.map(attrName => {
            const attrKey = attrName.toLowerCase();
            const assignedValue = currentState.attributes[attrKey];
            const bonusValue = bonuses[attrKey] || 0;
            
            if (assignedValue === undefined || assignedValue === null) {
                return `<li><strong>${attrName}</strong>: Unassigned</li>`;
            }
            
            const total = assignedValue + bonusValue;
            return `<li><strong>${attrName}</strong>: <strong>${total}</strong></li>`;

        }).join('');
    }
    
    return `<h3>${moduleData.name} Attributes</h3><ul>${attributeList}</ul>`;
  }


  isComplete(currentState) {
    if (!currentState.module) return false;
    const moduleDef = this.stateManager.getModule(currentState.module);
    const attrConfig = moduleDef?.attributes;
    if (!attrConfig || !attrConfig.names) return true;
    
    return attrConfig.names.every(attrName => {
        const assignedValue = currentState.attributes[attrName.toLowerCase()];
        return assignedValue !== undefined && assignedValue !== null;
    });
  }

  getCompletionError() {
    // This method remains the same and is still correct.
    const currentState = this.stateManager.getState();
    const moduleDef = this.stateManager.getModule(currentState.module);
    const attrConfig = moduleDef?.attributes;

    if (!attrConfig || !attrConfig.names) {
      return '';
    }

    const unassigned = attrConfig.names.filter(attrName => {
      const assignedValue = currentState.attributes[attrName.toLowerCase()];
      return assignedValue === undefined || assignedValue === null;
    });

    if (unassigned.length > 0) {
      const errorList = unassigned.map(name => `- ${name}`);
      return `Please assign a value to the following attributes:\n${errorList.join('\n')}`;
    }

    return 'An unknown validation error occurred on the Attributes page.';
  }
  
  /**
   * --- UPDATED: Removes the state change listener on cleanup. ---
   */
  cleanup() {
    document.removeEventListener('wizard:stateChange', this._boundStateChangeHandler);
  }
}

export { AttributesPageHandler };