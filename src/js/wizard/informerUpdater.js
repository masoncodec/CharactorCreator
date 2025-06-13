// informerUpdater.js
// This module manages the content displayed in the informer panel,
// based on the current wizard page and the wizard's state.

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
      console.log('InformerUpdater: Initialized.');
    }
  
    /**
     * Updates the informer panel content for the current page.
     * @param {string} page - The name of the current wizard page.
     */
    update(page) {
      if (!this.informerPanel) {
        return; // Can't update if panel doesn't exist
      }
  
      const currentState = this.stateManager.getState();
      console.log(`InformerUpdater.update: Updating informer for page: ${page}. Current State:`, currentState);
  
      let htmlContent = '';
  
      switch (page) {
        case 'module':
          if (currentState.module) {
            const moduleData = this.stateManager.getModule(currentState.module);
            const destiniesForModule = (moduleData?.destinies || [])
              .map(d => this.stateManager.getDestiny(d)?.displayName || d)
              .join('</li><li>');
  
            htmlContent = `
              <div class="module-info">
                <h3>${moduleData.name}</h3>
                <p>${moduleData.descriptions.module}</p>
                <h4>Available Destinies:</h4>
                <ul>
                  <li>${destiniesForModule}</li>
                </ul>
              </div>`;
          } else {
            htmlContent = '<div class="module-info"><p>Select a module to begin your journey</p></div>';
          }
          break;
  
        case 'destiny':
          if (!currentState.destiny) {
            htmlContent = '<p>Select your destiny</p>';
          } else {
            const destiny = this.stateManager.getDestiny(currentState.destiny);
            const selectedDestinyFlaw = currentState.flaws.find(f => f.destiny === true);
            const selectedFlawDetails = selectedDestinyFlaw ? this.stateManager.getFlaw(selectedDestinyFlaw.id) : null;
  
            htmlContent = `
              <div class="destiny-info">
                <h3>${destiny.displayName}</h3>
                <p>${destiny.description}</p>
                <div class="stats">
                  <div><strong>Health:</strong> ${destiny.health.title} (${destiny.health.value})</div>
                </div>
                <div class="tags">${this._renderTags(destiny.tags)}</div>
                ${selectedFlawDetails ? `
                  <div class="flaw-info">
                    <h4>Selected Flaw: ${selectedFlawDetails.name}</h4>
                    <p>${selectedFlawDetails.description}</p>
                    <p>Effect: ${selectedFlawDetails.effect}</p>
                  </div>
                ` : '<p>Select a flaw for your character from the options on the left.</p>'}
              </div>`;
          }
          break;
  
        case 'attributes':
          if (currentState.module) {
            const moduleData = this.stateManager.getModule(currentState.module);
            const attributeList = (moduleData?.attributes || [])
              .map(attr => `<li><strong>${attr}</strong>: ${currentState.attributes[attr.toLowerCase()] || 'Unassigned'}</li>`)
              .join('');
  
            htmlContent = `
              <div class="attributes-info">
                <h3>${moduleData.name} Attributes</h3>
                <p>Assign dice to your attributes:</p>
                <ul>${attributeList}</ul>
              </div>`;
          } else {
            htmlContent = `
              <div class="attributes-info">
                <h3>Attributes</h3>
                <p>Select a module first to see attributes.</p>
              </div>`;
          }
          break;
  
        case 'info':
          // The info informer is usually static HTML, but could be dynamic if needed
          htmlContent = `
            <div class="info-panel-content">
              <h3>Character Summary</h3>
              <p><strong>Name:</strong> ${currentState.info.name || 'Not set'}</p>
              <p><strong>Bio:</strong> ${currentState.info.bio || 'Not set'}</p>
              <!-- Add more character summary details here from state as needed -->
            </div>`;
          break;
  
        default:
          htmlContent = '<p>Information will appear here as you make selections.</p>';
          break;
      }
  
      this.informerPanel.innerHTML = htmlContent;
      console.log(`InformerUpdater.update: Informer content updated for page: ${page}.`);
    }
  
    /**
     * Helper function to render tags.
     * @param {Array<Object>} tags - Array of tag objects {display, icon, color}.
     * @returns {string} HTML string for tags.
     * @private
     */
    _renderTags(tags) {
      if (!tags || tags.length === 0) return '';
      return tags.map(tag => `
        <span class="tag" style="background: ${tag.color}">
          ${tag.icon} ${tag.display}
        </span>
      `).join('');
    }
  }
  
  export { InformerUpdater };
  