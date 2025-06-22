// js/wizard/framePageHandler.js
// Handles rendering the informational "Frame" page.

class FramePageHandler {
  /**
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   * @param {InformerUpdater} informerUpdater - The instance of the InformerUpdater.
   */
  constructor(stateManager, informerUpdater) {
    this.stateManager = stateManager;
    this.informerUpdater = informerUpdater;
    this.container = null;
    console.log('FramePageHandler: Initialized.');
  }

  /**
   * Sets up the page content based on the selected module.
   * @param {HTMLElement} selectorPanel - The main panel for content.
   * @param {HTMLElement} informerPanel - The side panel for extra info.
   */
  setupPage(selectorPanel, informerPanel) {
    this.container = selectorPanel.querySelector('#frame-details-content');
    if (!this.container) {
      console.error('FramePageHandler: Could not find container element #frame-details-content.');
      return;
    }
    this.renderFrameContent();
  }

  /**
   * Renders the frame content into the container.
   */
  renderFrameContent() {
    const currentState = this.stateManager.getState();
    const module = this.stateManager.getModule(currentState.module);

    if (!module || !module.frame) {
      this.container.innerHTML = `<p class="error-message">Could not load frame details. Please go back and select a module.</p>`;
      return;
    }

    const frameData = module.frame;

    const pitchHtml = frameData.pitch.map(p => `<p>${p}</p>`).join('');

    const html = `
      <div class="frame-container">
        <div class="frame-header">
          <h1>${frameData.name}</h1>
          <p class="frame-description">${frameData.description}</p>
        </div>

        <div class="frame-meta">
          <div class="frame-section">
            <strong>Author:</strong> ${frameData.author}
          </div>
          <div class="frame-section">
            <strong>Complexity:</strong>
            <div class="complexity-rating">
              ${this.renderComplexity(frameData.complexityRating)}
            </div>
          </div>
        </div>

        <div class="frame-pitch">
          <h2>Pitch</h2>
          ${pitchHtml}
        </div>

        <div class="frame-footer">
          <div class="frame-section">
            <strong>Tone:</strong> ${frameData.tone}
          </div>
          <div class="frame-section">
            <strong>Theme:</strong> ${frameData.theme}
          </div>
          <div class="frame-section">
            <strong>Inspiration:</strong> ${frameData.inspiration}
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
  }

  /**
   * Generates HTML for the complexity rating circles.
   * @param {number} rating - The complexity rating from 1 to 5.
   * @returns {string} HTML string of span elements for the dots.
   */
  renderComplexity(rating) {
    let dots = '';
    for (let i = 1; i <= 5; i++) {
      const filledClass = i <= rating ? 'filled' : '';
      dots += `<span class="dot ${filledClass}"></span>`;
    }
    return dots;
  }

  /**
   * Cleans up event listeners if any were added.
   * (Not needed for this handler, but good practice to include).
   */
  cleanup() {
    // No listeners to remove for this page.
    console.log('FramePageHandler: Cleanup called.');
  }
}

export { FramePageHandler };