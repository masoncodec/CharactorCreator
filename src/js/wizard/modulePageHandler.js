// modulePageHandler.js
// REFACTORED: This module handles the 'module' selection page.
// UPDATED: Now handles a "level-up mode" UI.

class ModulePageHandler {
  /**
   * REFACTORED: The constructor now accepts the `selectModuleCallback`
   * from the main CharacterWizard.
   * @param {object} stateManager - The wizard's state manager.
   * @param {function} selectModuleCallback - The function to call to load module data.
   */
  constructor(stateManager, selectModuleCallback) {
    this.stateManager = stateManager;
    this.selectModule = selectModuleCallback;
    this.selectorPanel = null;
    console.log('ModulePageHandler: Initialized (Refactored).');
  }

  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;

    // --- UPDATED: Find all level-related elements ---
    this.levelSelectionContainer = this.selectorPanel.querySelector('#levelSelectionContainer');
    this.levelSelector = this.selectorPanel.querySelector('#levelSelector');
    this.levelsToGainContainer = this.selectorPanel.querySelector('#levelsToGainContainer');
    this.levelsToGainSelector = this.selectorPanel.querySelector('#levelsToGainSelector');
    // --- END UPDATED ---

    this._attachEventListeners();
    this._restoreState();
  }

  _attachEventListeners() {
    this._boundModuleOptionClickHandler = this._handleModuleOptionClick.bind(this);
    this.selectorPanel.addEventListener('click', this._boundModuleOptionClickHandler);

    // --- UPDATED: Add event listeners for both level inputs ---
    this._boundLevelChangeHandler = this._handleLevelChange.bind(this);
    this.levelSelector.addEventListener('change', this._boundLevelChangeHandler);

    this._boundLevelsToGainHandler = this._handleLevelsToGainChange.bind(this);
    this.levelsToGainSelector.addEventListener('change', this._boundLevelsToGainHandler);
    // --- END UPDATED ---
  }
  
  _handleLevelChange(e) {
    const level = parseInt(e.target.value, 10);
    if (!isNaN(level) && level > 0) {
      this.stateManager.set('creationLevel', level);
      console.log(`ModulePageHandler: Creation level set to ${level}.`);
    }
  }

  /**
   * --- NEW: Handles changes to the "Levels to Gain" input. ---
   */
  _handleLevelsToGainChange(e) {
    const levelsToGain = parseInt(e.target.value, 10);
    if (isNaN(levelsToGain) || levelsToGain < 1) return;

    const originalLevel = this.stateManager.get('originalLevel');
    const newTargetLevel = originalLevel + levelsToGain;

    // We use the 'creationLevel' state property to store the character's target level.
    this.stateManager.set('creationLevel', newTargetLevel);
    console.log(`ModulePageHandler: Levels to gain set to ${levelsToGain}. Target level is now ${newTargetLevel}.`);
  }

  _handleModuleOptionClick(e) {
    const opt = e.target.closest('.module-option');
    if (!opt || opt.disabled) return; // Prevent clicks on disabled buttons

    this.selectorPanel.querySelectorAll('.module-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');

    const selectedModuleId = opt.dataset.value;
    
    if (this.selectModule) {
      this.selectModule(selectedModuleId);
      
      if (this.levelSelectionContainer && this.levelSelector) {
        this.levelSelectionContainer.classList.remove('is-hidden');
        this.levelSelector.disabled = false;
      }
    } else {
      console.error("ModulePageHandler: 'selectModule' callback is not defined.");
    }
  }

  /**
   * --- REPLACED: Now handles both creation and level-up modes. ---
   */
  _restoreState() {
    const isLevelUpMode = this.stateManager.get('isLevelUpMode');
    const currentModule = this.stateManager.get('module');

    if (currentModule) {
      const btn = this.selectorPanel.querySelector(`.module-option[data-value="${currentModule}"]`);
      btn?.classList.add('selected');

      if (isLevelUpMode) {
        // --- LEVEL-UP MODE UI ---
        // Disable module selection
        this.selectorPanel.querySelectorAll('.module-option').forEach(o => o.disabled = true);
        
        // Hide the "Starting Level" input
        this.levelSelectionContainer.classList.add('is-hidden');
        
        // Show and configure the "Levels to Gain" input
        this.levelsToGainContainer.classList.remove('is-hidden');
        // Set initial value
        const initialTargetLevel = this.stateManager.get('creationLevel');
        const initialOriginalLevel = this.stateManager.get('originalLevel');
        this.levelsToGainSelector.value = initialTargetLevel - initialOriginalLevel;
        
      } else {
        // --- CREATION MODE UI ---
        // Hide the "Levels to Gain" input
        this.levelsToGainContainer.classList.add('is-hidden');

        // Show and enable the "Starting Level" input
        this.levelSelectionContainer.classList.remove('is-hidden');
        this.levelSelector.disabled = false;
        this.levelSelector.value = this.stateManager.get('creationLevel');
      }
    }
  }
  
  getInformerContent() {
    return '<p>Select a module to see its description and begin your journey.</p>';
  }

  isComplete(currentState) {
    return !!currentState.module;
  }

  getCompletionError() {
    return 'Please select a module to continue.';
  }
  
  cleanup() {
    this.selectorPanel?.removeEventListener('click', this._boundModuleOptionClickHandler);
    this.levelSelector?.removeEventListener('change', this._boundLevelChangeHandler);
    this.levelsToGainSelector?.removeEventListener('change', this._boundLevelsToGainHandler); // NEW
  }
}

export { ModulePageHandler };