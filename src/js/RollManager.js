// RollManager.js
// A self-contained module to create and manage a modal for "Hope/Fear" attribute rolls.

export class RollManager {
  /**
   * @param {string} attributeName - The name of the attribute being rolled (e.g., "Whimsy").
   * @param {object} modifierData - An object containing processed modifier information.
   * @param {number} baseValue - The character's base value for the attribute.
   */
  constructor(attributeName, modifierData, baseValue) {
    this.attributeName = attributeName;
    this.modifierData = modifierData;
    this.baseValue = baseValue;
    this.modalElement = null;
    this._boundClose = this.close.bind(this);
    this._boundHandleRoll = this._handleRoll.bind(this);
  }

  show() {
    document.body.insertAdjacentHTML('beforeend', this._createModalHTML());
    this.modalElement = document.getElementById('roll-manager-modal');
    this._attachEventListeners();
  }

  close() {
    if (this.modalElement) {
      this.modalElement.remove();
    }
    document.removeEventListener('keydown', this._boundCloseOnEscape);
  }

  _attachEventListeners() {
    this.modalElement.querySelector('.roll-modal-close').addEventListener('click', this._boundClose);
    this.modalElement.querySelector('.roll-modal-backdrop').addEventListener('click', this._boundClose);
    this._boundCloseOnEscape = (e) => { if (e.key === "Escape") this._boundClose(); };
    document.addEventListener('keydown', this._boundCloseOnEscape);
    this.modalElement.querySelector('.roll-modal-roll-btn').addEventListener('click', this._boundHandleRoll);
  }

  _handleRoll() {
    const { totalNumerical, totalDiceNum } = this.modifierData;

    const highestHope = Math.floor(Math.random() * 12) + 1;
    const highestFear = Math.floor(Math.random() * 12) + 1;

    let d6Modifier = 0;
    const d6Rolls = [];
    if (totalDiceNum !== 0) {
      const numD6ToRoll = Math.abs(totalDiceNum);
      for (let i = 0; i < numD6ToRoll; i++) {
        d6Rolls.push(Math.floor(Math.random() * 6) + 1);
      }
      const d6Sum = d6Rolls.reduce((sum, roll) => sum + roll, 0);
      d6Modifier = totalDiceNum > 0 ? d6Sum : -d6Sum;
    }

    // Clear previous highlights and text styles before applying new ones
    const totalResultEl = this.modalElement.querySelector('#total-roll-result');
    const totalBoxEl = totalResultEl.closest('.total-box');
    const hopeBoxEl = this.modalElement.querySelector('#hope-roll-result').closest('.result-box');
    const fearBoxEl = this.modalElement.querySelector('#fear-roll-result').closest('.result-box');
    
    totalResultEl.classList.remove('critical-text');
    totalBoxEl.classList.remove('critical-success');
    hopeBoxEl.classList.remove('hope-win');
    fearBoxEl.classList.remove('fear-win');

    // Update the UI for the base rolls
    this.modalElement.querySelector('#hope-roll-result').textContent = highestHope;
    this.modalElement.querySelector('#hope-roll-details').textContent = `(Rolled: 1d12)`;
    this.modalElement.querySelector('#fear-roll-result').textContent = highestFear;
    this.modalElement.querySelector('#fear-roll-details').textContent = `(Rolled: 1d12)`;
    
    if (totalDiceNum !== 0) {
        this.modalElement.querySelector('#d6-roll-result').textContent = `${d6Modifier >= 0 ? '+' : ''}${d6Modifier}`;
        this.modalElement.querySelector('#d6-roll-details').textContent = `(Rolled: ${d6Rolls.join(', ')})`;
    }

    if (highestHope === highestFear) {
        totalResultEl.textContent = "CRITICAL SUCCESS!!";
        totalResultEl.classList.add('critical-text');
        totalBoxEl.classList.add('critical-success');
    } else {
        const finalTotal = highestHope + highestFear + totalNumerical + this.baseValue + d6Modifier;
        totalResultEl.textContent = finalTotal;

        if (highestHope > highestFear) {
            hopeBoxEl.classList.add('hope-win');
        } else {
            fearBoxEl.classList.add('fear-win');
        }
    }
    
    // The line to disable the roll button is gone, allowing re-rolls.
  }

  /**
   * Combines Base and Effect modifiers in the total display.
   * @returns {string} The HTML string for the modal.
   * @private
   */
  _createModalHTML() {
    const { totalNumerical, totalDiceNum } = this.modifierData;
    const modifierSourcesHTML = this.modifierData.sources.map(source =>
      `<li><strong>${source.itemName}:</strong> ${source.type === 'modifier' ? 'MOD' : 'DICE'} ${source.modifier > 0 ? '+' : ''}${source.modifier}</li>`
    ).join('');
    
    // The Base Value is still listed as a source, as requested.
    const baseValueHTML = `<li><strong>Base Value (${this.attributeName}):</strong> ${this.baseValue >= 0 ? '+' : ''}${this.baseValue}</li>`;

    // Calculate the combined numerical modifier for the total display.
    const combinedNumericalMod = this.baseValue + totalNumerical;

    let d6BoxHTML = '';
    let gridClass = 'two-col';
    if (totalDiceNum !== 0) {
      gridClass = 'three-col';
      d6BoxHTML = `
        <div class="result-box d6-box">
          <span class="result-label">Dice Roll</span>
          <span class="result-value" id="d6-roll-result">--</span>
          <span class="result-details" id="d6-roll-details"></span>
        </div>
      `;
    }

    return `
      <div id="roll-manager-modal">
        <div class="roll-modal-backdrop"></div>
        <div class="roll-modal-content">
          <button class="roll-modal-close">&times;</button>
          <h2 class="roll-modal-header">${this.attributeName}</h2>
          
          <div class="roll-modal-section modifiers-section">
            <h4>Modifiers Breakdown</h4>
            <div class="modifier-totals">
              <span>Total Numerical Mod: <strong>${combinedNumericalMod >= 0 ? '+' : ''}${combinedNumericalMod}</strong></span>
              <span>Dice Num: <strong>${totalDiceNum >= 0 ? '+' : ''}${totalDiceNum}d6</strong></span>
            </div>
            <ul class="modifier-sources">
              ${baseValueHTML}
              ${modifierSourcesHTML || ''}
            </ul>
          </div>

          <div class="roll-modal-section roll-button-section">
            <button class="roll-modal-roll-btn">Roll</button>
          </div>
          
          <div class="roll-modal-section results-section">
            <h4>Results</h4>
            <div class="results-grid ${gridClass}">
              <div class="result-box">
                <span class="result-label">Hope</span>
                <span class="result-value" id="hope-roll-result">--</span>
                <span class="result-details" id="hope-roll-details"></span>
              </div>
              <div class="result-box">
                <span class="result-label">Fear</span>
                <span class="result-value" id="fear-roll-result">--</span>
                <span class="result-details" id="fear-roll-details"></span>
              </div>
              ${d6BoxHTML}
              <div class="result-box total-box">
                <span class="result-label">Total</span>
                <span class="result-value" id="total-roll-result">--</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}