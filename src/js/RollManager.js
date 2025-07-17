// RollManager.js
// A self-contained, generalized module to create and manage a modal for complex dice rolls.
// It supports different "Roll Groups" like attribute checks and damage rolls within a single modal.

export class RollManager {
  /**
   * Constructs the RollManager.
   * @param {Array<object>} rollDefinitions - An array of objects, each defining a "Roll Group" to be displayed.
   */
  constructor(rollDefinitions) {
    this.rollDefinitions = rollDefinitions;
    this.modalElement = null;
    this.critOccurred = false; // State to track if a crit has happened for subsequent rolls.

    this._boundClose = this.close.bind(this);
    this._boundHandleClick = this._handleClick.bind(this);
  }

  /**
   * Creates the modal HTML, appends it to the body, and attaches event listeners.
   */
  show() {
    document.body.insertAdjacentHTML('beforeend', this._createModalHTML());
    this.modalElement = document.getElementById('roll-manager-modal');
    this._attachEventListeners();
  }

  /**
   * Removes the modal from the DOM and cleans up event listeners.
   */
  close() {
    if (this.modalElement) {
      this.modalElement.remove();
    }
    document.removeEventListener('keydown', this._boundCloseOnEscape);
  }

  /**
   * Attaches all necessary event listeners for the modal.
   */
  _attachEventListeners() {
    this.modalElement.addEventListener('click', this._boundHandleClick);
    this._boundCloseOnEscape = (e) => { if (e.key === "Escape") this._boundClose(); };
    document.addEventListener('keydown', this._boundCloseOnEscape);
  }

  /**
   * Central click handler for the entire modal.
   * @param {Event} e - The click event.
   */
  _handleClick(e) {
    const target = e.target;
    // Handle close actions
    if (target.closest('.roll-modal-close') || target.classList.contains('roll-modal-backdrop')) {
      this.close();
      return;
    }

    // Handle roll button clicks
    const rollButton = target.closest('.roll-group-btn');
    if (rollButton) {
      const groupId = parseInt(rollButton.dataset.groupId, 10);
      this._executeRoll(groupId);
      return;
    }

    // --- NEW: Handle navigation link clicks ---
    const navLink = target.closest('.roll-modal-nav-link');
    if (navLink) {
      e.preventDefault(); // Prevent default anchor tag behavior
      const targetId = navLink.getAttribute('href').substring(1); // Get the ID from the href
      const targetElement = this.modalElement.querySelector(`#${targetId}`);
      if (targetElement) {
        // Smoothly scroll the target group into view
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
  }

  /**
   * Executes a roll for a specific group based on its type.
   * @param {number} groupId - The index of the roll group in the definitions array.
   */
  _executeRoll(groupId) {
    const groupDef = this.rollDefinitions[groupId];
    const groupEl = this.modalElement.querySelector(`.roll-group[data-group-id="${groupId}"]`);
    if (!groupDef || !groupEl) return;

    switch (groupDef.groupType) {
      case 'hope_fear':
        this._executeHopeFearRoll(groupDef, groupEl);
        break;
      case 'damage':
        this._executeDamageRoll(groupDef, groupEl);
        break;
    }
  }

  /**
   * Handles the logic for a Hope/Fear (2d12) roll.
   * @param {object} groupDef - The definition object for this roll group.
   * @param {HTMLElement} groupEl - The container element for this group in the modal.
   */
  _executeHopeFearRoll(groupDef, groupEl) {
    // This function's internal logic is unchanged.
    const { combinedValue, totalDiceNum } = groupDef.modifierData;
    const highestHope = Math.floor(Math.random() * 12) + 1;
    const highestFear = Math.floor(Math.random() * 12) + 1;
    let d6Modifier = 0;
    if (totalDiceNum !== 0) {
      const numD6ToRoll = Math.abs(totalDiceNum);
      const d6Rolls = [];
      for (let i = 0; i < numD6ToRoll; i++) {
        d6Rolls.push(Math.floor(Math.random() * 6) + 1);
      }
      const d6Sum = d6Rolls.reduce((sum, roll) => sum + roll, 0);
      d6Modifier = totalDiceNum > 0 ? d6Sum : -d6Sum;
      groupEl.querySelector('.d6-roll-result').textContent = `${d6Modifier >= 0 ? '+' : ''}${d6Modifier}`;
      groupEl.querySelector('.d6-roll-details').textContent = `(Rolled: ${d6Rolls.join(', ')})`;
    }
    groupEl.querySelector('.hope-roll-result').textContent = highestHope;
    groupEl.querySelector('.fear-roll-result').textContent = highestFear;
    const hopeBoxEl = groupEl.querySelector('.hope-box');
    const fearBoxEl = groupEl.querySelector('.fear-box');
    hopeBoxEl.classList.remove('hope-win');
    fearBoxEl.classList.remove('fear-win');
    const totalResultEl = groupEl.querySelector('.total-roll-result');
    totalResultEl.classList.remove('critical-text');
    totalResultEl.parentElement.classList.remove('critical-success');
    if (highestHope === highestFear) {
      this.critOccurred = true;
      totalResultEl.textContent = "CRITICAL SUCCESS!!";
      totalResultEl.classList.add('critical-text');
      totalResultEl.parentElement.classList.add('critical-success');
    } else {
      const finalTotal = highestHope + highestFear + combinedValue + d6Modifier;
      totalResultEl.textContent = finalTotal;
      if (highestHope > highestFear) {
        hopeBoxEl.classList.add('hope-win');
      } else {
        fearBoxEl.classList.add('fear-win');
      }
    }
  }

  /**
   * Handles the logic for a damage roll group.
   * @param {object} groupDef - The definition object for this roll group.
   * @param {HTMLElement} groupEl - The container element for this group in the modal.
   */
  _executeDamageRoll(groupDef, groupEl) {
    // This function's internal logic is unchanged.
    let totalDamage = 0;
    groupDef.rolls.forEach((rollDef, index) => {
      let numDice = parseInt(rollDef.dice.split('d')[0], 10);
      const dieType = parseInt(rollDef.dice.split('d')[1], 10);
      const baseValue = rollDef.baseValue || 0;
      if (this.critOccurred) {
        numDice *= 2;
      }
      let rollSum = 0;
      const individualRolls = [];
      for (let i = 0; i < numDice; i++) {
        const roll = Math.floor(Math.random() * dieType) + 1;
        rollSum += roll;
        individualRolls.push(roll);
      }
      const finalValue = rollSum + baseValue;
      totalDamage += finalValue;
      const valueEl = groupEl.querySelector(`#damage-value-${index}`);
      const detailsEl = groupEl.querySelector(`#damage-details-${index}`);
      if (valueEl) valueEl.textContent = finalValue;
      if (detailsEl) detailsEl.textContent = `(Rolled ${numDice}d${dieType} [${individualRolls.join(', ')}] + ${baseValue})`;
    });
    const totalValueEl = groupEl.querySelector('.damage-total-value');
    if (totalValueEl) totalValueEl.textContent = totalDamage;
  }


  /**
   * Generates the entire modal's HTML structure from the roll definitions.
   * @returns {string} The HTML string for the modal.
   */
  _createModalHTML() {
    // --- NEW: Generate the navigation section if there is more than one roll group ---
    let navHTML = '';
    if (this.rollDefinitions.length > 1) {
      const navLinks = this.rollDefinitions.map((groupDef, index) => {
        // Extract a short name for the tab, e.g., "Attack Roll" from "Claw - Attack Roll"
        const shortLabel = groupDef.label.split(' - ')[1] || groupDef.label;
        return `<a href="#roll-group-${index}" class="roll-modal-nav-link">${shortLabel}</a>`;
      }).join('');
      navHTML = `<div class="roll-modal-nav">${navLinks}</div>`;
    }

    // Generate the HTML for each main roll group
    const groupHTML = this.rollDefinitions.map((groupDef, index) => {
      switch (groupDef.groupType) {
        case 'hope_fear':
          // Pass the navHTML to the first group so it can be rendered at the top.
          return this._createHopeFearGroupHTML(groupDef, index, index === 0 ? navHTML : '');
        case 'damage':
          return this._createDamageGroupHTML(groupDef, index);
        default:
          return '';
      }
    }).join('');

    return `
      <div id="roll-manager-modal">
        <div class="roll-modal-backdrop"></div>
        <div class="roll-modal-content">
          <button class="roll-modal-close">&times;</button>
          ${groupHTML}
        </div>
      </div>
    `;
  }

  /**
   * Creates the HTML for a Hope/Fear roll group.
   * @param {object} groupDef - The definition for this group.
   * @param {number} groupId - The index of this group.
   * @param {string} navHTML - The HTML for the navigation tabs (only passed for the first group).
   * @returns {string} The HTML for this group.
   */
  _createHopeFearGroupHTML(groupDef, groupId, navHTML = '') {
    const { baseValue, modifierData } = groupDef;
    const { combinedValue, totalDiceNum, sources } = modifierData;
    const modifierSourcesHTML = sources.map(source =>
      `<li><strong>${source.itemName}:</strong> ${source.type === 'modifier' ? 'MOD' : 'DICE'} ${source.modifier > 0 ? '+' : ''}${source.modifier}</li>`
    ).join('');
    const baseValueHTML = `<li><strong>Base Value:</strong> ${baseValue >= 0 ? '+' : ''}${baseValue}</li>`;
    
    let d6BoxHTML = '';
    if (totalDiceNum !== 0) {
      d6BoxHTML = `
        <div class="result-box d6-box">
          <span class="result-label">Dice Roll</span>
          <span class="result-value d6-roll-result">--</span>
          <span class="result-details d6-roll-details"></span>
        </div>
      `;
    }

    return `
      <div class="roll-group" id="roll-group-${groupId}" data-group-id="${groupId}">
        <h2 class="roll-modal-header">${groupDef.label}</h2>
        ${navHTML}
        <div class="roll-modal-section modifiers-section">
          <h4>Modifiers Breakdown</h4>
          <div class="modifier-totals">
            <span>Total Numerical Mod: <strong>${combinedValue >= 0 ? '+' : ''}${combinedValue}</strong></span>
            <span>Dice Num: <strong>${totalDiceNum >= 0 ? '+' : ''}${totalDiceNum}d6</strong></span>
          </div>
          <ul class="modifier-sources">
            ${baseValueHTML}
            ${modifierSourcesHTML || ''}
          </ul>
        </div>
        <div class="roll-modal-section roll-button-section">
          <button class="roll-modal-roll-btn roll-group-btn" data-group-id="${groupId}">Roll Attack</button>
        </div>
        <div class="roll-modal-section results-section">
          <h4>Results</h4>
          <div class="results-grid ${totalDiceNum !== 0 ? 'three-col' : 'two-col'}">
            <div class="result-box hope-box">
              <span class="result-label">Hope</span>
              <span class="result-value hope-roll-result">--</span>
            </div>
            <div class="result-box fear-box">
              <span class="result-label">Fear</span>
              <span class="result-value fear-roll-result">--</span>
            </div>
            ${d6BoxHTML}
            <div class="result-box total-box">
              <span class="result-label">Total</span>
              <span class="result-value total-roll-result">--</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Creates the HTML for a damage roll group.
   * @param {object} groupDef - The definition for this group.
   * @param {number} groupId - The index of this group.
   * @returns {string} The HTML for this group.
   */
  _createDamageGroupHTML(groupDef, groupId) {
    const damageBoxesHTML = groupDef.rolls.map((rollDef, index) => {
      const label = rollDef.label.charAt(0).toUpperCase() + rollDef.label.slice(1);
      return `
        <div class="result-box">
          <span class="result-label">${label}</span>
          <span class="result-value" id="damage-value-${index}">--</span>
          <span class="result-details" id="damage-details-${index}"></span>
        </div>
      `;
    }).join('');

    const numDamageTypes = groupDef.rolls.length;
    let gridClass = 'two-col';
    if (numDamageTypes === 1) gridClass = '';
    if (numDamageTypes === 3) gridClass = 'three-col';
    if (numDamageTypes >= 4) gridClass = 'four-col';

    return `
      <div class="roll-group" id="roll-group-${groupId}" data-group-id="${groupId}">
        <h2 class="roll-modal-header">${groupDef.label}</h2>
        <div class="roll-modal-section roll-button-section">
          <button class="roll-modal-roll-btn roll-group-btn" data-group-id="${groupId}">Roll Damage</button>
        </div>
        <div class="roll-modal-section results-section">
          <h4>Results</h4>
          <div class="results-grid ${gridClass}">
            ${damageBoxesHTML}
            <div class="result-box total-box">
              <span class="result-label">Total Damage</span>
              <span class="result-value damage-total-value">--</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
