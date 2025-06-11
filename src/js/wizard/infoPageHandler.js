// infoPageHandler.js
// This module handles the UI rendering and event handling for the 'info' page,
// where the user enters character name and bio.

class InfoPageHandler {
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
  
      console.log('InfoPageHandler: Initialized.');
    }
  
    /**
     * Sets up the info page by attaching event listeners and restoring state.
     * This method is called by the main CharacterWizard when the 'info' page is loaded.
     * @param {HTMLElement} selectorPanel - The DOM element for the selector panel.
     * @param {HTMLElement} informerPanel - The DOM element for the informer panel (not directly used here).
     */
    setupPage(selectorPanel, informerPanel) {
      this.selectorPanel = selectorPanel;
      console.log('InfoPageHandler.setupPage: Setting up info page events and restoring state.');
  
      this._attachEventListeners();
      this._restoreState();
  
      this.informerUpdater.update('info'); // Update informer with current info state
      this.pageNavigator.updateNav();      // Update navigation based on completion
    }
  
    /**
     * Attaches event listeners for name and bio input fields.
     * @private
     */
    _attachEventListeners() {
      const characterNameInput = this.selectorPanel.querySelector('#characterName');
      const characterBioInput = this.selectorPanel.querySelector('#characterBio');
  
      // Remove previous listeners to prevent duplicates
      if (this._boundNameInputHandler) {
          characterNameInput?.removeEventListener('input', this._boundNameInputHandler);
      }
      if (this._boundBioInputHandler) {
          characterBioInput?.removeEventListener('input', this._boundBioInputHandler);
      }
  
      this._boundNameInputHandler = this._handleNameInput.bind(this);
      this._boundBioInputHandler = this._handleBioInput.bind(this);
  
      characterNameInput?.addEventListener('input', this._boundNameInputHandler);
      characterBioInput?.addEventListener('input', this._boundBioInputHandler);
  
      console.log('InfoPageHandler._attachEventListeners: Input listeners attached for name and bio.');
    }
  
    /**
     * Handles input changes for the character name field.
     * @param {Event} e - The input event.
     * @private
     */
    _handleNameInput(e) {
      const currentInfo = this.stateManager.get('info');
      this.stateManager.set('info', { ...currentInfo, name: e.target.value });
      console.log(`InfoPageHandler._handleNameInput: Character name updated: "${this.stateManager.get('info').name}"`);
  
      this.informerUpdater.update('info'); // Update informer with new name
      this.pageNavigator.updateNav();      // Update navigation based on completion (name is required for completion)
    }
  
    /**
     * Handles input changes for the character bio field.
     * @param {Event} e - The input event.
     * @private
     */
    _handleBioInput(e) {
      const currentInfo = this.stateManager.get('info');
      this.stateManager.set('info', { ...currentInfo, bio: e.target.value });
      console.log(`InfoPageHandler._handleBioInput: Character bio updated: "${this.stateManager.get('info').bio}"`);
  
      this.informerUpdater.update('info'); // Update informer with new bio
      // Bio is not typically a requirement for page completion, so no navigation update needed here
    }
  
    /**
     * Restores the character name and bio from the current state.
     * @private
     */
    _restoreState() {
      const infoState = this.stateManager.get('info');
      const charNameInput = this.selectorPanel.querySelector('#characterName');
      const charBioInput = this.selectorPanel.querySelector('#characterBio');
  
      if (charNameInput) {
        charNameInput.value = infoState.name || '';
        console.log(`InfoPageHandler._restoreState: Character name input set to "${infoState.name}".`);
      }
      if (charBioInput) {
        charBioInput.value = infoState.bio || '';
        console.log(`InfoPageHandler._restoreState: Character bio input set to "${infoState.bio}".`);
      }
    }
  
    /**
     * Cleans up event listeners when the page is unloaded (optional, for robustness).
     */
    cleanup() {
      console.log('InfoPageHandler.cleanup: Cleaning up info page resources.');
      const characterNameInput = this.selectorPanel.querySelector('#characterName');
      const characterBioInput = this.selectorPanel.querySelector('#characterBio');
  
      characterNameInput?.removeEventListener('input', this._boundNameInputHandler);
      characterBioInput?.removeEventListener('input', this._boundBioInputHandler);
    }
  }
  
  export { InfoPageHandler };
  