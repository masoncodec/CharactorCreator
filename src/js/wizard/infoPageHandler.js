// infoPageHandler.js
// REFACTORED: This module handles the 'info' page and its logic.

class InfoPageHandler {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.selectorPanel = null;

    // --- NEW: Bind the new state change handler ---
    this._boundStateChangeHandler = this._handleStateChange.bind(this);
  }

  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;
    this._attachEventListeners();
    this._restoreState();

    // --- NEW: Add the event listener ---
    document.addEventListener('wizard:stateChange', this._boundStateChangeHandler);
  }
  
  // --- NEW: Add this entire method ---
  /**
   * Listens for changes to the 'info' state and tells the informer to update.
   * @param {CustomEvent} event The state change event.
   */
  _handleStateChange(event) {
    if (event.detail.key === 'info') {
      document.dispatchEvent(new CustomEvent('wizard:informerUpdate', { detail: { handler: this } }));
    }
  }

  _attachEventListeners() {
    this._boundNameInputHandler = this._handleNameInput.bind(this);
    this._boundBioInputHandler = this._handleBioInput.bind(this);
    this.selectorPanel.querySelector('#characterName')?.addEventListener('input', this._boundNameInputHandler);
    this.selectorPanel.querySelector('#characterBio')?.addEventListener('input', this._boundBioInputHandler);
  }

  _handleNameInput(e) {
    const currentInfo = this.stateManager.get('info');
    this.stateManager.set('info', { ...currentInfo, name: e.target.value });
  }

  _handleBioInput(e) {
    const currentInfo = this.stateManager.get('info');
    this.stateManager.set('info', { ...currentInfo, bio: e.target.value });
  }

  _restoreState() {
    const infoState = this.stateManager.get('info');
    const charNameInput = this.selectorPanel.querySelector('#characterName');
    const charBioInput = this.selectorPanel.querySelector('#characterBio');
    if (charNameInput) charNameInput.value = infoState.name || '';
    if (charBioInput) charBioInput.value = infoState.bio || '';
  }

  getInformerContent() {
    const currentState = this.stateManager.getState();
    return `
      <h3>Character Summary</h3>
      <p><strong>Name:</strong> ${currentState.info.name || 'Not set'}</p>
      <p><strong>Bio:</strong> ${currentState.info.bio || 'Not set'}</p>`;
  }

  isComplete(currentState) {
    // We now receive currentState from the PageNavigator, so we should use it.
    const info = currentState.info || {};
    return !!info.name?.trim();
  }

  getCompletionError() {
    return "Please enter your character's name.";
  }

  cleanup() {
    this.selectorPanel.querySelector('#characterName')?.removeEventListener('input', this._boundNameInputHandler);
    this.selectorPanel.querySelector('#characterBio')?.removeEventListener('input', this._boundBioInputHandler);
    
    // --- NEW: Remove the state change listener ---
    document.removeEventListener('wizard:stateChange', this._boundStateChangeHandler);
  }
}

export { InfoPageHandler };