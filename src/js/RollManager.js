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
      this._injectCSS();
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
  
    /**
     * REFACTORED: Handles dice rolling and adds logic for criticals and highlighting.
     * @private
     */
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
  
      // Update the UI for the base rolls first
      this.modalElement.querySelector('#hope-roll-result').textContent = highestHope;
      this.modalElement.querySelector('#hope-roll-details').textContent = `(Rolled: 1d12)`;
      this.modalElement.querySelector('#fear-roll-result').textContent = highestFear;
      this.modalElement.querySelector('#fear-roll-details').textContent = `(Rolled: 1d12)`;
      
      if (totalDiceNum !== 0) {
          this.modalElement.querySelector('#d6-roll-result').textContent = `${d6Modifier >= 0 ? '+' : ''}${d6Modifier}`;
          this.modalElement.querySelector('#d6-roll-details').textContent = `(Rolled: ${d6Rolls.join(', ')})`;
      }
  
      const totalResultEl = this.modalElement.querySelector('#total-roll-result');
      const totalBoxEl = totalResultEl.closest('.total-box');
      const hopeBoxEl = this.modalElement.querySelector('#hope-roll-result').closest('.result-box');
      const fearBoxEl = this.modalElement.querySelector('#fear-roll-result').closest('.result-box');
  
      // NEW: Critical Success and Highlighting Logic
      if (highestHope === highestFear) {
          // Critical Success
          totalResultEl.textContent = "CRITICAL SUCCESS!!";
          totalResultEl.classList.add('critical-text');
          totalBoxEl.classList.add('critical-success');
      } else {
          // Standard Roll
          const finalTotal = highestHope + highestFear + totalNumerical + this.baseValue + d6Modifier;
          totalResultEl.textContent = finalTotal;
  
          if (highestHope > highestFear) {
              hopeBoxEl.classList.add('hope-win');
          } else {
              fearBoxEl.classList.add('fear-win');
          }
      }
      
      this.modalElement.querySelector('.roll-modal-roll-btn').disabled = true;
    }
  
    _createModalHTML() {
      const { totalDiceNum } = this.modifierData;
      const modifierSourcesHTML = this.modifierData.sources.map(source =>
        `<li><strong>${source.itemName}:</strong> ${source.type === 'modifier' ? 'MOD' : 'DICE'} ${source.modifier > 0 ? '+' : ''}${source.modifier}</li>`
      ).join('');
      const baseValueHTML = `<li><strong>Base Value (${this.attributeName}):</strong> ${this.baseValue >= 0 ? '+' : ''}${this.baseValue}</li>`;
  
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
                <span>Attribute Base: <strong>${this.baseValue >= 0 ? '+' : ''}${this.baseValue}</strong></span>
                <span>Effect Mods: <strong>${this.modifierData.totalNumerical >= 0 ? '+' : ''}${this.modifierData.totalNumerical}</strong></span>
                <span>Dice Num: <strong>${this.modifierData.totalDiceNum >= 0 ? '+' : ''}${this.modifierData.totalDiceNum}d6</strong></span>
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
  
    /**
     * REFACTORED: Injects CSS for highlighting states.
     * @private
     */
    _injectCSS() {
      const styleId = 'roll-manager-styles';
      if (document.getElementById(styleId)) return;
  
      const css = `
        #roll-manager-modal {
          position: fixed; top: 0; left: 0;
          width: 100%; height: 100%;
          z-index: 1000; display: flex;
          align-items: center; justify-content: center;
        }
        .roll-modal-backdrop {
          position: absolute; width: 100%; height: 100%;
          background-color: rgba(0,0,0,0.6);
        }
        .roll-modal-content {
          position: relative; background: #2c2c2c; color: #fff;
          padding: 2rem; border-radius: 8px; width: 90%;
          max-width: 550px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);
          z-index: 1001;
        }
        .roll-modal-close {
          position: absolute; top: 10px; right: 15px;
          font-size: 2rem; color: #fff; background: none;
          border: none; cursor: pointer;
        }
        .roll-modal-header {
          text-align: center; margin-top: 0; margin-bottom: 1.5rem;
          font-size: 2.2rem;
        }
        .roll-modal-section { margin-bottom: 1.5rem; }
        .roll-modal-section h4 { 
          border-bottom: 1px solid #444; padding-bottom: 0.5rem;
          margin-bottom: 1rem;
        }
        .modifier-totals { display: flex; justify-content: space-around; font-size: 1.1rem; margin-bottom: 1rem; }
        .modifier-sources { list-style: none; padding: 0; font-size: 0.9rem; max-height: 80px; overflow-y: auto; background: #222; padding: 5px; border-radius: 3px; }
        .roll-button-section { text-align: center; }
        .roll-modal-roll-btn { 
          font-size: 1.5rem; padding: 10px 40px; border-radius: 5px; cursor: pointer;
          background-color: #007bff; color: white; border: 1px solid #007bff;
        }
        .roll-modal-roll-btn:disabled { background-color: #555; border-color: #555; cursor: not-allowed; }
        
        .results-grid { display: grid; gap: 1rem; }
        .results-grid.two-col { grid-template-columns: 1fr 1fr; }
        .results-grid.three-col { grid-template-columns: 1fr 1fr 1fr; }
  
        .result-box {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 1rem; background: #3a3a3a; border-radius: 5px; text-align: center;
          border: 2px solid transparent; /* Base border for smooth transition */
          transition: border-color 0.3s ease-in-out;
        }
        /* ADDED: Highlighting styles */
        .result-box.hope-win { border-color: #28a745; }
        .result-box.fear-win { border-color: #dc3545; }
        .result-box.d6-box { background: #33415c; }
        .result-box.total-box { 
          grid-column: 1 / -1; 
          background: #4a4a4a;
          margin-top: 1rem;
        }
        .total-box.critical-success { border-color: #ffc107; }
        .result-label { font-size: 1rem; font-weight: bold; margin-bottom: 0.5rem; }
        .result-value { font-size: 2.5rem; font-weight: bold; }
        .result-value.critical-text { font-size: 1.8rem; color: #ffc107; }
        .result-details { font-size: 0.8rem; color: #ccc; min-height: 1.2em; }
      `;
      const style = document.createElement('style');
      style.id = styleId;
      style.type = 'text/css';
      style.appendChild(document.createTextNode(css));
      document.head.appendChild(style);
    }
  }