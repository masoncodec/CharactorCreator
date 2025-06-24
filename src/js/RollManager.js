// RollManager.js
// A self-contained module to create and manage a modal for "Hope/Fear" attribute rolls.

export class RollManager {
  /**
   * @param {string} attributeName - The name of the attribute being rolled (e.g., "Whimsy").
   * @param {object} modifierData - An object containing processed modifier information.
   * @param {number} modifierData.totalNumerical - The sum of all numerical modifiers.
   * @param {number} modifierData.totalDiceNum - The sum of all die_num modifiers.
   * @param {Array<object>} modifierData.sources - An array of all raw effects contributing to the totals.
   */
  constructor(attributeName, modifierData) {
    this.attributeName = attributeName;
    this.modifierData = modifierData;
    this.modalElement = null;
    this._boundClose = this.close.bind(this);
    this._boundHandleRoll = this._handleRoll.bind(this);
  }

  /**
   * Creates and displays the modal popup on the screen.
   */
  show() {
    this._injectCSS();
    document.body.insertAdjacentHTML('beforeend', this._createModalHTML());
    this.modalElement = document.getElementById('roll-manager-modal');
    this._attachEventListeners();
  }

  /**
   * Closes and removes the modal from the DOM.
   */
  close() {
    if (this.modalElement) {
      this.modalElement.remove();
    }
    document.removeEventListener('keydown', this._boundCloseOnEscape);
  }

  /**
   * Attaches event listeners for the modal (close, roll).
   * @private
   */
  _attachEventListeners() {
    // Close listeners
    this.modalElement.querySelector('.roll-modal-close').addEventListener('click', this._boundClose);
    this.modalElement.querySelector('.roll-modal-backdrop').addEventListener('click', this._boundClose);
    this._boundCloseOnEscape = (e) => {
      if (e.key === "Escape") this._boundClose();
    };
    document.addEventListener('keydown', this._boundCloseOnEscape);

    // Roll listener
    this.modalElement.querySelector('.roll-modal-roll-btn').addEventListener('click', this._boundHandleRoll);
  }

  /**
   * Handles the dice rolling logic when the "Roll" button is clicked.
   * @private
   */
  _handleRoll() {
    const { totalNumerical, totalDiceNum } = this.modifierData;

    let hopeDiceCount = 1;
    let fearDiceCount = 1;

    if (totalDiceNum > 0) {
      hopeDiceCount += totalDiceNum;
    } else if (totalDiceNum < 0) {
      fearDiceCount += Math.abs(totalDiceNum);
    }

    const rollDice = (count) => Array.from({ length: count }, () => Math.floor(Math.random() * 12) + 1);

    const hopeRolls = rollDice(hopeDiceCount);
    const fearRolls = rollDice(fearDiceCount);

    const highestHope = Math.max(...hopeRolls);
    const highestFear = Math.max(...fearRolls);

    const finalTotal = highestHope + highestFear + totalNumerical;

    // Update the UI with the results
    this.modalElement.querySelector('#hope-roll-result').textContent = highestHope;
    this.modalElement.querySelector('#hope-roll-details').textContent = `(Rolled: ${hopeRolls.join(', ')})`;
    this.modalElement.querySelector('#fear-roll-result').textContent = highestFear;
    this.modalElement.querySelector('#fear-roll-details').textContent = `(Rolled: ${fearRolls.join(', ')})`;
    this.modalElement.querySelector('#total-roll-result').textContent = finalTotal;
    
    // Disable the roll button to prevent re-rolls
    this.modalElement.querySelector('.roll-modal-roll-btn').disabled = true;
  }

  /**
   * Generates the complete HTML for the modal.
   * @returns {string} The HTML string for the modal.
   * @private
   */
  _createModalHTML() {
    const modifierSourcesHTML = this.modifierData.sources.map(source =>
      `<li><strong>${source.itemName}:</strong> ${source.type === 'modifier' ? 'MOD' : 'DICE'} ${source.modifier > 0 ? '+' : ''}${source.modifier}</li>`
    ).join('');

    return `
      <div id="roll-manager-modal">
        <div class="roll-modal-backdrop"></div>
        <div class="roll-modal-content">
          <button class="roll-modal-close">&times;</button>
          <h2 class="roll-modal-header">${this.attributeName}</h2>
          
          <div class="roll-modal-section modifiers-section">
            <h4>Modifiers</h4>
            <div class="modifier-totals">
              <span>Numerical: <strong>${this.modifierData.totalNumerical > 0 ? '+' : ''}${this.modifierData.totalNumerical}</strong></span>
              <span>Dice Num: <strong>${this.modifierData.totalDiceNum > 0 ? '+' : ''}${this.modifierData.totalDiceNum}</strong></span>
            </div>
            <ul class="modifier-sources">
              ${modifierSourcesHTML || '<li>No modifiers active</li>'}
            </ul>
          </div>

          <div class="roll-modal-section roll-button-section">
            <button class="roll-modal-roll-btn">Roll</button>
          </div>
          
          <div class="roll-modal-section results-section">
            <h4>Results</h4>
            <div class="results-grid">
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

  /**
   * Injects the necessary CSS for the modal into the document's head.
   * @private
   */
  _injectCSS() {
    const styleId = 'roll-manager-styles';
    if (document.getElementById(styleId)) return;

    const css = `
      #roll-manager-modal {
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .roll-modal-backdrop {
        position: absolute;
        width: 100%; height: 100%;
        background-color: rgba(0,0,0,0.6);
      }
      .roll-modal-content {
        position: relative;
        background: #2c2c2c;
        color: #fff;
        padding: 2rem;
        border-radius: 8px;
        width: 90%;
        max-width: 500px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        z-index: 1001;
      }
      .roll-modal-close {
        position: absolute;
        top: 10px; right: 15px;
        font-size: 2rem;
        color: #fff;
        background: none;
        border: none;
        cursor: pointer;
      }
      .roll-modal-header {
        text-align: center;
        margin-top: 0;
        margin-bottom: 1.5rem;
        font-size: 2.2rem;
      }
      .roll-modal-section { margin-bottom: 1.5rem; }
      .roll-modal-section h4 { 
        border-bottom: 1px solid #444;
        padding-bottom: 0.5rem;
        margin-bottom: 1rem;
      }
      .modifier-totals { display: flex; justify-content: space-around; font-size: 1.2rem; margin-bottom: 1rem; }
      .modifier-sources { list-style: none; padding: 0; font-size: 0.9rem; max-height: 80px; overflow-y: auto; }
      .roll-button-section { text-align: center; }
      .roll-modal-roll-btn { 
        font-size: 1.5rem;
        padding: 10px 40px;
        border-radius: 5px;
        cursor: pointer;
        background-color: #007bff;
        color: white;
        border: 1px solid #007bff;
      }
      .roll-modal-roll-btn:disabled { background-color: #555; border-color: #555; cursor: not-allowed; }
      .results-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: stretch; }
      .result-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: #3a3a3a;
        border-radius: 5px;
        text-align: center;
      }
      .result-box.total-box { grid-column: 1 / -1; background: #4a4a4a; }
      .result-label { font-size: 1rem; font-weight: bold; margin-bottom: 0.5rem; }
      .result-value { font-size: 2.5rem; font-weight: bold; }
      .result-details { font-size: 0.8rem; color: #ccc; min-height: 1.2em; }
    `;
    const style = document.createElement('style');
    style.id = styleId;
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }
}