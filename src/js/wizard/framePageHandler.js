// framePageHandler.js
// REFACTORED: Handles the informational "Frame" page.
// This page is simple and doesn't require complex validation or informer logic.

class FramePageHandler {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.container = null;
    console.log('FramePageHandler: Initialized (Refactored).');
  }

  setupPage(selectorPanel, informerPanel, pageNavigator, informerUpdater) {
    this.container = selectorPanel.querySelector('#frame-details-content');
    if (!this.container) {
      console.error('FramePageHandler: Could not find container element #frame-details-content.');
      return;
    }
    this.renderFrameContent();
  }

  renderFrameContent() {
    const currentState = this.stateManager.getState();
    const module = this.stateManager.getModule(currentState.module);

    if (!module || !module.frame) {
      this.container.innerHTML = `<p class="error-message">Could not load frame details. Please go back and select a module.</p>`;
      return;
    }

    const frameData = module.frame;
    const pitchHtml = frameData.pitch.map(p => `<p>${p}</p>`).join('');

    this.container.innerHTML = `
      <div class="frame-container">
        <div class="frame-header">
          <h1>${frameData.name}</h1>
          <p class="frame-description">${frameData.description}</p>
        </div>
        <div class="frame-meta">
          <div class="frame-section"><strong>Author:</strong> ${frameData.author}</div>
          <div class="frame-section">
            <strong>Complexity:</strong>
            <div class="complexity-rating">${this.renderComplexity(frameData.complexityRating)}</div>
          </div>
        </div>
        <div class="frame-pitch"><h2>Pitch</h2>${pitchHtml}</div>
        <div class="frame-footer">
          <div class="frame-section"><strong>Tone:</strong> ${frameData.tone}</div>
          <div class="frame-section"><strong>Theme:</strong> ${frameData.theme}</div>
          <div class="frame-section"><strong>Inspiration:</strong> ${frameData.inspiration}</div>
        </div>
      </div>`;
  }

  renderComplexity(rating) {
    let dots = '';
    for (let i = 1; i <= 5; i++) {
      dots += `<span class="dot ${i <= rating ? 'filled' : ''}"></span>`;
    }
    return dots;
  }

  // --- NEW: Methods for delegated logic ---

  getInformerContent() {
    return `<p>This page provides an overview of the campaign setting.</p>`;
  }

  isComplete(currentState) {
    return true; // Frame page is always complete.
  }

  getCompletionError() {
    return ''; // No error.
  }

  cleanup() {
    // No listeners to remove.
  }
}

export { FramePageHandler };
