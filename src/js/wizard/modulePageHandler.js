// modulePageHandler.js
// REFACTORED: This module handles the 'module' selection page.
// It now triggers the on-demand loading of module data and manages level selection.

class ModulePageHandler {
  /**
   * REFACTORED: The constructor now accepts the `selectModuleCallback`
   * from the main CharacterWizard.
   * @param {object} stateManager - The wizard's state manager.
   * @param {function} selectModuleCallback - The function to call to load module data.
   */
  constructor(stateManager, selectModuleCallback) {
    this.stateManager = stateManager;
    this.selectModule = selectModuleCallback;
    this.selectorPanel = null;
    console.log('ModulePageHandler: Initialized (Refactored).');
  }

  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;

    // --- NEW: Find level selection elements ---
    this.levelSelectionContainer = this.selectorPanel.querySelector('#levelSelectionContainer'); //
    this.levelSelector = this.selectorPanel.querySelector('#levelSelector'); //
    // --- END NEW ---

    this._attachEventListeners();
    this._restoreState();
  }

  _attachEventListeners() {
    this._boundModuleOptionClickHandler = this._handleModuleOptionClick.bind(this);
    this.selectorPanel.addEventListener('click', this._boundModuleOptionClickHandler);

    // --- NEW: Add event listener for level input ---
    this._boundLevelChangeHandler = this._handleLevelChange.bind(this);
    this.levelSelector.addEventListener('change', this._boundLevelChangeHandler);
    // --- END NEW ---
  }
  
  /**
   * --- NEW: Handles changes to the level selector input. ---
   */
  _handleLevelChange(e) {
    const level = parseInt(e.target.value, 10);
    if (!isNaN(level) && level > 0) {
      this.stateManager.set('creationLevel', level);
      console.log(`ModulePageHandler: Creation level set to ${level}.`);
    }
  }

  /**
   * REFACTORED: This handler now calls the `selectModule` callback
   * and enables the level selector upon module selection.
   */
  _handleModuleOptionClick(e) {
    const opt = e.target.closest('.module-option'); //
    if (!opt) return;

    this.selectorPanel.querySelectorAll('.module-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');

    const selectedModuleId = opt.dataset.value;
    
    if (this.selectModule) {
      this.selectModule(selectedModuleId);
      
      // --- NEW: Show and enable the level selector ---
      if (this.levelSelectionContainer && this.levelSelector) {
        this.levelSelectionContainer.classList.remove('is-hidden'); //
        this.levelSelector.disabled = false; //
      }
      // --- END NEW ---

    } else {
      console.error("ModulePageHandler: 'selectModule' callback is not defined.");
    }
  }

  /**
   * --- UPDATED: Now also restores the state of the level selector. ---
   */
  _restoreState() {
    const currentModule = this.stateManager.get('module');
    if (currentModule) {
      const btn = this.selectorPanel.querySelector(`.module-option[data-value="${currentModule}"]`); //
      btn?.classList.add('selected');

      // --- NEW: Restore level selector state ---
      if (this.levelSelectionContainer && this.levelSelector) {
        this.levelSelectionContainer.classList.remove('is-hidden'); //
        this.levelSelector.disabled = false; //
        this.levelSelector.value = this.stateManager.get('creationLevel');
      }
      // --- END NEW ---
    }
  }
  
  getInformerContent() {
    return '<p>Select a module to see its description and begin your journey.</p>';
  }

  isComplete(currentState) {
    return !!currentState.module;
  }

  getCompletionError() {
    return 'Please select a module to continue.';
  }
  
  /**
   * --- UPDATED: Now also cleans up the level selector's event listener. ---
   */
  cleanup() {
    this.selectorPanel?.removeEventListener('click', this._boundModuleOptionClickHandler);
    
    // --- NEW: Cleanup level change listener ---
    this.levelSelector?.removeEventListener('change', this._boundLevelChangeHandler);
    // --- END NEW ---
  }
}

export { ModulePageHandler };