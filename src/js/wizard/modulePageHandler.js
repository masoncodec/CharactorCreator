// modulePageHandler.js
// REFACTORED: This module handles the 'module' selection page.
// It now triggers the on-demand loading of module data.

class ModulePageHandler {
  /**
   * REFACTORED: The constructor now accepts the `selectModuleCallback`
   * from the main CharacterWizard.
   * @param {object} stateManager - The wizard's state manager.
   * @param {function} selectModuleCallback - The function to call to load module data.
   */
  constructor(stateManager, selectModuleCallback) {
    this.stateManager = stateManager;
    this.selectModule = selectModuleCallback; // Store the callback function
    this.selectorPanel = null;
    console.log('ModulePageHandler: Initialized (Refactored).');
  }

  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;
    this._attachEventListeners();
    this._restoreState();
  }

  _attachEventListeners() {
    this._boundModuleOptionClickHandler = this._handleModuleOptionClick.bind(this);
    this.selectorPanel.addEventListener('click', this._boundModuleOptionClickHandler);
  }

  /**
   * REFACTORED: This handler now calls the `selectModule` callback
   * instead of setting the state directly. This is the key to triggering
   * the data loading process.
   */
  _handleModuleOptionClick(e) {
    const opt = e.target.closest('.module-option');
    if (!opt) return;

    // Visually select the option
    this.selectorPanel.querySelectorAll('.module-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');

    const selectedModuleId = opt.dataset.value;
    
    // ** THE FIX **
    // Call the main wizard's method to handle the entire data loading flow.
    // This will set the state AND fetch all the necessary data.
    if (this.selectModule) {
      this.selectModule(selectedModuleId);
    } else {
      console.error("ModulePageHandler: 'selectModule' callback is not defined.");
    }
  }

  _restoreState() {
    const currentModule = this.stateManager.get('module');
    if (currentModule) {
      const btn = this.selectorPanel.querySelector(`.module-option[data-value="${currentModule}"]`);
      btn?.classList.add('selected');
    }
  }
  
  // This method is no longer used here, as the informerUpdater handles it centrally.
  getInformerContent() {
    return '<p>Select a module to see its description and begin your journey.</p>';
  }

  isComplete(currentState) {
    return !!currentState.module;
  }

  getCompletionError() {
    return 'Please select a module to continue.';
  }
  
  cleanup() {
    this.selectorPanel?.removeEventListener('click', this._boundModuleOptionClickHandler);
  }
}

export { ModulePageHandler };