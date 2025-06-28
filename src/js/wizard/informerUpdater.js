// informerUpdater.js
// REFACTORED: This module manages the content displayed in the informer panel.
// It is now a "dumb" component that simply displays the HTML it receives from
// the active page handler, making it closed for modification.

class InformerUpdater {
  /**
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   */
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.informerPanel = document.getElementById('informerPanel');

    if (!this.informerPanel) {
      console.warn('InformerUpdater: Informer panel not found. Display updates will not occur.');
    }
    
    // The global state change listener is removed from here. The CharacterWizard now
    // orchestrates the call to update() at the appropriate time (on page load).
    // Individual page handlers are responsible for triggering updates on state changes if needed.

    console.log('InformerUpdater: Initialized.');
  }

  /**
   * REFACTORED: Updates the informer panel content by calling a method on the active page handler.
   * This removes the need for a brittle, hardcoded switch statement.
   * @param {object|null} activePageHandler - The handler for the current page.
   */
  update(activePageHandler) {
    if (!this.informerPanel) return;

    let htmlContent = '<p>Information will appear here as you make selections.</p>';
    
    // If the active handler exists and has the getInformerContent method, call it.
    if (activePageHandler && typeof activePageHandler.getInformerContent === 'function') {
      htmlContent = activePageHandler.getInformerContent();
    }

    this.informerPanel.innerHTML = htmlContent;
  }
}

export { InformerUpdater };
