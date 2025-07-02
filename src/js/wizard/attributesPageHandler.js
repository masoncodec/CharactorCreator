// attributesPageHandler.js
// This module handles the UI for the 'attributes' assignment page.
// UPDATED: Now displays a read-only view when in level-up mode.

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
    this._boundStateChangeHandler = this._updateTotals.bind(this);
    console.log('AttributesPageHandler: Initialized (Refactored).');
  }

  /**
   * --- UPDATED: Now has a conditional path for level-up mode. ---
   */
  setupPage(selectorPanel, informerPanel, pageNavigator, informerUpdater) {
    this.selectorPanel = selectorPanel;
    const isLevelUpMode = this.stateManager.get('isLevelUpMode');

    if (isLevelUpMode) {
      // --- LEVEL-UP MODE: Render a read-only view and do nothing else. ---
      this._renderReadOnlyAttributeView();
    } else {
      // --- CREATION MODE: Render the interactive table as before. ---
      this._renderAttributeTable();
      this._initAssignmentManager();
      document.addEventListener('wizard:stateChange', this._boundStateChangeHandler);
      this._updateTotals(); // Initial call to set totals
    }
  }

  /**
   * --- NEW: Renders a non-interactive summary of attributes for level-up mode. ---
   */
  _renderReadOnlyAttributeView() {
    this.selectorPanel.innerHTML = '';
    const currentState = this.stateManager.getState();
    const moduleData = this.stateManager.getModule(currentState.module);
    const attrConfig = moduleData?.attributes;
    const bonuses = this.stateManager.getCombinedAttributeBonuses();
    const originalAttributes = currentState.attributes;

    let content = '<h3>Attribute Summary</h3>';
    content += '<p>This page is read-only. Attribute bonuses from leveling up have been applied.</p>';
    
    if (attrConfig && attrConfig.names) {
        let attributeList = attrConfig.names.map(attrName => {
            const attrKey = attrName.toLowerCase();
            const baseValue = originalAttributes[attrKey] || 0;
            const bonusValue = bonuses[attrKey] || 0;
            const total = baseValue + bonusValue;
            return `<li><strong>${attrName}</strong>: ${baseValue} + ${bonusValue} (Bonus) = <strong>${total}</strong></li>`;
        }).join('');
        content += `<ul class="attribute-summary-list">${attributeList}</ul>`;
    } else {
        content += '<p>No attributes configured for this module.</p>';
    }

    this.selectorPanel.innerHTML = content;
  }

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

    const bonuses = this.stateManager.getCombinedAttributeBonuses();

    const table = document.createElement('table');
    table.className = 'dice-assignment-table';
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    headerRow.innerHTML = `<th>Attribute</th><th>Bonus</th><th colspan="${attrConfig.values.length}">Assign Value</th><th>Total</th>`;

    const tbody = table.createTBody();
    attrConfig.names.forEach(attrName => {
        const attrKey = attrName.toLowerCase();
        const bonusValue = bonuses[attrKey] || 0;
        const row = tbody.insertRow();
        row.dataset.attribute = attrKey;
        
        row.insertCell().textContent = attrName;
        
        const bonusCell = row.insertCell();
        bonusCell.textContent = `+${bonusValue}`;
        bonusCell.className = 'bonus-cell';

        attrConfig.values.forEach((value, index) => {
            const btnCell = row.insertCell();
            btnCell.innerHTML = `<button type="button" data-value="${value}" data-index="${index}">${value.toString().toUpperCase()}</button>`;
        });

        const totalCell = row.insertCell();
        totalCell.id = `${attrKey}-total`;
        totalCell.className = 'total-cell';
        totalCell.textContent = '...';
    });
    this.selectorPanel.appendChild(table);
  }

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
            return `<li><strong>${attrName}</strong>: ${assignedValue} + ${bonusValue} (Bonus) = <strong>${total}</strong></li>`;
        }).join('');
    }
    
    return `<h3>${moduleData.name} Attributes</h3><ul>${attributeList}</ul>`;
  }

  /**
   * --- UPDATED: Is always complete in level-up mode. ---
   */
  isComplete(currentState) {
    if (currentState.isLevelUpMode) {
      return true; // No action is required from the user on this page in level-up mode.
    }
    
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
    const currentState = this.stateManager.getState();
    if (currentState.isLevelUpMode) {
      return ''; // No errors possible in read-only mode.
    }

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

  cleanup() {
    // Only remove the listener if it was added (i.e., not in level-up mode)
    if (!this.stateManager.get('isLevelUpMode')) {
      document.removeEventListener('wizard:stateChange', this._boundStateChangeHandler);
    }
  }
}

export { AttributesPageHandler };