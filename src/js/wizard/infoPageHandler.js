// infoPageHandler.js
// REFACTORED: This module handles the 'info' page and its logic.

class InfoPageHandler {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.selectorPanel = null;
  }

  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;
    this._attachEventListeners();
    this._restoreState();
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

  // --- NEW: Methods for delegated logic ---

  getInformerContent() {
    const currentState = this.stateManager.getState();
    return `
      <h3>Character Summary</h3>
      <p><strong>Name:</strong> ${currentState.info.name || 'Not set'}</p>
      <p><strong>Bio:</strong> ${currentState.info.bio || 'Not set'}</p>`;
  }

  isComplete(currentState) {
    return !!currentState.info.name?.trim();
  }

  getCompletionError() {
    return "Please enter your character's name.";
  }

  cleanup() {
    this.selectorPanel.querySelector('#characterName')?.removeEventListener('input', this._boundNameInputHandler);
    this.selectorPanel.querySelector('#characterBio')?.removeEventListener('input', this._boundBioInputHandler);
  }
}

export { InfoPageHandler };
