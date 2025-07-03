// js/wizard/InformerUpdater.js
// FINAL VERSION: Now self-contained and listens for a specific update event.

class InformerUpdater {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.informerPanel = document.getElementById('informerPanel');
    this.activePageHandler = null;

    // Listen for the specific event to trigger an update.
    this._boundUpdateListener = this.update.bind(this);
    document.addEventListener('wizard:informerUpdate', this._boundUpdateListener);
    
    console.log('InformerUpdater: Initialized and listening.');
  }

  /**
   * Main update function, now called by the event listener.
   * @param {CustomEvent} event - The event object, which may contain the active handler.
   */
  update(event) {
    // The event listener will be called without an event object on the first page load.
    // In that case, the event is the page handler itself.
    if (event && event.detail && event.detail.handler) {
      this.activePageHandler = event.detail.handler;
    } else if (event && !event.detail) {
      this.activePageHandler = event;
    }
    
    if (!this.informerPanel || !this.activePageHandler) {
      // console.warn('InformerUpdater: Panel or active handler not found.');
      return;
    }

    if (typeof this.activePageHandler.getInformerContent === 'function') {
      const content = this.activePageHandler.getInformerContent();
      this.informerPanel.innerHTML = content;
    } else {
      this.informerPanel.innerHTML = '';
    }
  }

  cleanup() {
    document.removeEventListener('wizard:informerUpdate', this._boundUpdateListener);
  }
}

export { InformerUpdater };