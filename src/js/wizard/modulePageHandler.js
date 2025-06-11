// modulePageHandler.js
// This module handles the UI rendering and event handling for the 'module' selection page.

class ModulePageHandler {
    /**
     * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
     * @param {InformerUpdater} informerUpdater - The instance of the InformerUpdater.
     * @param {PageNavigator} pageNavigator - The instance of the PageNavigator.
     */
    constructor(stateManager, informerUpdater, pageNavigator) {
      this.stateManager = stateManager;
      this.informerUpdater = informerUpdater;
      this.pageNavigator = pageNavigator;
      this.selectorPanel = null; // Will be set when setupPage is called
  
      console.log('ModulePageHandler: Initialized.');
    }
  
    /**
     * Sets up the module page by rendering options and attaching event listeners.
     * This method is called by the main CharacterWizard when the 'module' page is loaded.
     * @param {HTMLElement} selectorPanel - The DOM element for the selector panel.
     * @param {HTMLElement} informerPanel - The DOM element for the informer panel (not directly used here, but passed for consistency).
     */
    setupPage(selectorPanel, informerPanel) {
      this.selectorPanel = selectorPanel;
      console.log('ModulePageHandler.setupPage: Setting up module page events and restoring state.');
  
      this._renderModuleOptions(); // Ensure options are rendered if not already by partial HTML
  
      this._attachEventListeners();
      this._restoreState();
  
      this.informerUpdater.update('module'); // Update informer with current module state
      this.pageNavigator.updateNav(); // Update navigation buttons and sidebar
    }
  
    /**
     * Renders the module options dynamically if needed.
     * Assumes partials/module-selector.html might already contain basic structure.
     * @private
     */
    _renderModuleOptions() {
        // In this modular setup, module-selector.html is expected to pre-populate the module options.
        // However, if the partial HTML was only a container, this method would dynamically create the options.
        // For now, we rely on the partial HTML to have the basic structure and data-attributes.
        // This method can be expanded if module options need to be dynamically generated entirely in JS.
        console.log('ModulePageHandler._renderModuleOptions: Assuming module options are pre-rendered by partial HTML.');
    }
  
    /**
     * Attaches event listeners for module selection.
     * @private
     */
    _attachEventListeners() {
      // Remove existing listeners to prevent duplicates if the partial is reloaded
      // (though in this modular design, it's less likely to cause issues as handlers are re-initialized).
      // A robust way would be to use event delegation on a parent element, or remove specific listeners.
      // For simplicity, we'll re-attach here, assuming old ones are GC'd or not harmful.
  
      // Using event delegation on the selector panel for all module-option clicks
      this.selectorPanel.removeEventListener('click', this._boundModuleOptionClickHandler); // Remove old listener
      this._boundModuleOptionClickHandler = this._handleModuleOptionClick.bind(this);
      this.selectorPanel.addEventListener('click', this._boundModuleOptionClickHandler);
  
      console.log('ModulePageHandler._attachEventListeners: Module option click listener attached.');
    }
  
    /**
     * Handles click events on module options.
     * @param {Event} e - The click event.
     * @private
     */
    _handleModuleOptionClick(e) {
      const opt = e.target.closest('.module-option');
      if (!opt) return; // Not a module option click
  
      // Remove 'selected' class from all other module options
      this.selectorPanel.querySelectorAll('.module-option').forEach(o =>
        o.classList.remove('selected'));
  
      // Add 'selected' class to the clicked option
      opt.classList.add('selected');
  
      const selectedModuleId = opt.dataset.value;
      console.log(`ModulePageHandler._handleModuleOptionClick: Module selected: ${selectedModuleId}`);
  
      // Update the state manager
      this.stateManager.setState('module', selectedModuleId);
  
      // After state update, refresh informer and navigation
      this.informerUpdater.update('module');
      this.pageNavigator.updateNav();
    }
  
    /**
     * Restores the selection of the module based on the current state.
     * @private
     */
    _restoreState() {
      const currentModule = this.stateManager.get('module');
      if (currentModule) {
        const btn = this.selectorPanel.querySelector(`.module-option[data-value="${currentModule}"]`);
        if (btn) {
          btn.classList.add('selected');
          console.log(`ModulePageHandler._restoreState: Module option "${currentModule}" re-selected.`);
        }
      }
    }
  }
  
  export { ModulePageHandler };
  