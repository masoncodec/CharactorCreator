// modulePageHandler.js
// UPDATED: Manages a single, dynamic UI element for level configuration.

class ModulePageHandler {
  constructor(stateManager, selectModuleCallback) {
    this.stateManager = stateManager;
    this.selectModule = selectModuleCallback;
    this.selectorPanel = null;
    console.log('ModulePageHandler: Initialized (Refactored).');
  }

  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;

    // --- UPDATED: Find the single, merged UI elements ---
    this.levelConfigContainer = this.selectorPanel.querySelector('#levelConfigContainer');
    this.levelConfigLabel = this.selectorPanel.querySelector('#levelConfigLabel');
    this.levelConfigInput = this.selectorPanel.querySelector('#levelConfigInput');
    // --- END UPDATED ---

    this._attachEventListeners();
    this._restoreState();
  }

  _attachEventListeners() {
    this._boundModuleOptionClickHandler = this._handleModuleOptionClick.bind(this);
    this.selectorPanel.addEventListener('click', this._boundModuleOptionClickHandler);

    // --- UPDATED: Use a single event handler for the merged input ---
    this._boundLevelConfigChangeHandler = this._handleLevelConfigChange.bind(this);
    this.levelConfigInput.addEventListener('change', this._boundLevelConfigChangeHandler);
    // --- END UPDATED ---
  }
  
  /**
   * --- NEW: A single handler that works for both modes. ---
   */
  _handleLevelConfigChange(e) {
    const value = parseInt(e.target.value, 10);
    if (isNaN(value) || value < 1) return;

    const isLevelUpMode = this.stateManager.get('isLevelUpMode');

    if (isLevelUpMode) {
      // In level-up mode, the value represents "Levels to Gain"
      const originalLevel = this.stateManager.get('originalLevel');
      const newTargetLevel = originalLevel + value;
      this.stateManager.set('creationLevel', newTargetLevel);
      console.log(`ModulePageHandler: Levels to gain set to ${value}. Target level is now ${newTargetLevel}.`);
    } else {
      // In creation mode, the value is the "Starting Level"
      this.stateManager.set('creationLevel', value);
      console.log(`ModulePageHandler: Creation level set to ${value}.`);
    }
  }

  _handleModuleOptionClick(e) {
    const opt = e.target.closest('.module-option');
    if (!opt || opt.disabled) return;

    // This logic only runs in creation mode because buttons are disabled in level-up mode
    this.selectorPanel.querySelectorAll('.module-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');

    const selectedModuleId = opt.dataset.value;
    
    if (this.selectModule) {
      this.selectModule(selectedModuleId);
      
      // Show and enable the level config container
      if (this.levelConfigContainer && this.levelConfigInput) {
        this.levelConfigContainer.classList.remove('is-hidden');
        this.levelConfigInput.disabled = false;
      }
    } else {
      console.error("ModulePageHandler: 'selectModule' callback is not defined.");
    }
  }

  /**
   * --- REPLACED: Now dynamically configures the single UI element based on mode. ---
   */
  _restoreState() {
    const isLevelUpMode = this.stateManager.get('isLevelUpMode');
    const currentModule = this.stateManager.get('module');

    if (currentModule) {
      // Select the correct module button
      const btn = this.selectorPanel.querySelector(`.module-option[data-value="${currentModule}"]`);
      btn?.classList.add('selected');

      // Make the level configuration UI visible
      this.levelConfigContainer.classList.remove('is-hidden');
      this.levelConfigInput.disabled = false;

      if (isLevelUpMode) {
        // --- CONFIGURE FOR LEVEL-UP MODE ---
        this.selectorPanel.querySelectorAll('.module-option').forEach(o => o.disabled = true);
        
        this.levelConfigLabel.textContent = 'Levels to Gain:';
        this.levelConfigInput.value = 1; // Default to gaining 1 level
        this.levelConfigInput.min = 1;
        
        // Trigger initial calculation
        this._handleLevelConfigChange({ target: this.levelConfigInput });

      } else {
        // --- CONFIGURE FOR CREATION MODE ---
        this.levelConfigLabel.textContent = 'Starting Level:';
        this.levelConfigInput.value = this.stateManager.get('creationLevel');
        this.levelConfigInput.min = 1;
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
    this.levelConfigInput?.removeEventListener('change', this._boundLevelConfigChangeHandler);
  }
}

export { ModulePageHandler };