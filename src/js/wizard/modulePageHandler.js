// modulePageHandler.js
// REFACTORED: This module handles the 'module' selection page.
// It now provides its own informer content and completion logic.

class ModulePageHandler {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.selectorPanel = null;
    this.pageNavigator = null;
    this.informerUpdater = null;
    console.log('ModulePageHandler: Initialized (Refactored).');
  }

  setupPage(selectorPanel, informerPanel, pageNavigator, informerUpdater) {
    this.selectorPanel = selectorPanel;
    this.pageNavigator = pageNavigator;
    this.informerUpdater = informerUpdater;
    
    this._attachEventListeners();
    this._restoreState();
  }

  _attachEventListeners() {
    this._boundModuleOptionClickHandler = this._handleModuleOptionClick.bind(this);
    this.selectorPanel.addEventListener('click', this._boundModuleOptionClickHandler);
  }

  _handleModuleOptionClick(e) {
    const opt = e.target.closest('.module-option');
    if (!opt) return;

    this.selectorPanel.querySelectorAll('.module-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');

    const selectedModuleId = opt.dataset.value;
    this.stateManager.setState('module', selectedModuleId);
  }

  _restoreState() {
    const currentModule = this.stateManager.get('module');
    if (currentModule) {
      const btn = this.selectorPanel.querySelector(`.module-option[data-value="${currentModule}"]`);
      btn?.classList.add('selected');
    }
  }

  // --- NEW: Methods for delegated logic ---

  /**
   * Provides the HTML content for the informer panel for this specific page.
   * @returns {string} HTML content.
   */
  getInformerContent() {
    const currentState = this.stateManager.getState();
    if (currentState.module) {
      const moduleData = this.stateManager.getModule(currentState.module);
      const destiniesForModule = (moduleData?.destinies || [])
        .map(d => this.stateManager.getDestiny(d)?.displayName || d)
        .join('</li><li>');
      return `
        <h3>${moduleData.name}</h3>
        <p>${moduleData.descriptions.module}</p>
        <h4>Available Destinies:</h4><ul><li>${destiniesForModule}</li></ul>`;
    }
    return '<p>Select a module to begin your journey</p>';
  }

  /**
   * Checks if the page is complete.
   * @param {Object} currentState - The current wizard state.
   * @returns {boolean} True if a module is selected.
   */
  isComplete(currentState) {
    return !!currentState.module;
  }

  /**
   * Returns a user-friendly error message if the page is not complete.
   * @returns {string} The error message.
   */
  getCompletionError() {
    return 'Please select a module to continue.';
  }

  /**
   * Cleans up event listeners.
   */
  cleanup() {
    this.selectorPanel?.removeEventListener('click', this._boundModuleOptionClickHandler);
  }
}

export { ModulePageHandler };
