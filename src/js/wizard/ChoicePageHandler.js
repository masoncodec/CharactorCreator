// js/wizard/ChoicePageHandler.js
// FINAL VERSION: Correctly passes data to the PageContentRenderer.

import { InformerContentBuilder } from './InformerContentBuilder.js';
import { PageContentRenderer } from './PageContentRenderer.js';
import { RuleEngine } from './RuleEngine.js';

class ChoicePageHandler {
  constructor(stateManager, config) {
    this.stateManager = stateManager;
    this.config = config;
    this.selectorPanel = null;
    this.contentRenderer = null;

    this._boundOptionClickHandler = this._handleOptionClick.bind(this);
    this._boundHandleStateChange = this._handleStateChange.bind(this);
  }

  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;
    this.contentRenderer = new PageContentRenderer(
      this.selectorPanel.querySelector(this.config.contentScrollAreaClass),
      this.stateManager,
      new RuleEngine(this.stateManager)
    );

    this._attachEventListeners();
    this._renderOptions();
    this._restoreState();
  }
  
  _attachEventListeners() {
    this.selectorPanel.querySelector(this.config.optionsContainerId)?.addEventListener('click', this._boundOptionClickHandler);
    document.addEventListener('wizard:stateChange', this._boundHandleStateChange);
  }

  _handleStateChange(event) {
    // --- REPLACED: This logic is now more comprehensive ---
    const key = event.detail.key;

    // Define which state changes should trigger an informer update for this page
    const needsInformerUpdate = [
        'selections', 
        'creationLevel', 
        this.config.stateKey // This now correctly listens for 'destiny', 'purpose', etc.
    ].includes(key);

    if (needsInformerUpdate) {
        // Only re-render the main content panel if selections or level change,
        // as changing the main choice (e.g. Destiny) handles its own re-render.
        if (key === 'selections' || key === 'creationLevel') {
            this._renderPageContent();
        }
        
        // Always dispatch the informer update if a relevant key changed.
        document.dispatchEvent(new CustomEvent('wizard:informerUpdate', { detail: { handler: this } }));
    }
  }

  _handleOptionClick(e) {
    if (this.stateManager.get('isLevelUpMode')) return;
    
    const optionDiv = e.target.closest(this.config.optionClassName);
    if (!optionDiv) return;

    const selectedId = optionDiv.getAttribute(this.config.dataAttribute);
    if (this.stateManager.get(this.config.stateKey) === selectedId) return;

    this.selectorPanel.querySelectorAll(this.config.optionClassName).forEach(opt => opt.classList.remove('selected'));
    optionDiv.classList.add('selected');
    this.stateManager.setState(this.config.stateKey, selectedId);
    
    this._autoSelectUnlocks();
    this._renderPageContent();
  }

  _restoreState() {
    const currentId = this.stateManager.get(this.config.stateKey);
    if (currentId) {
      this._renderOptions();
      const optionDiv = this.selectorPanel.querySelector(`${this.config.optionClassName}[${this.config.dataAttribute}="${currentId}"]`);
      optionDiv?.classList.add('selected');
      this._renderPageContent();
    }
  }

  /**
   * --- UPDATED: Passes the correct data to the PageContentRenderer. ---
   */
  _renderPageContent() {
    if (this.contentRenderer) {
      const allUnlocks = this._getUnlocksForCurrentState();
      // Get the entire definition object for the current page (e.g., the full Destiny object)
      const mainDefinition = this.stateManager.getDefinitionForSource(this.config.stateKey);
      // Pass the unlocks, the source key, and the full definition to the renderer
      this.contentRenderer.render(allUnlocks, this.config.stateKey, mainDefinition);
    }
  }

  _getUnlocksForCurrentState() {
    const isLevelUpMode = this.stateManager.get('isLevelUpMode');
    const originalLevel = this.stateManager.get('originalLevel');
    const targetLevel = this.stateManager.get('creationLevel');
    const mainDefinition = this.stateManager.getDefinitionForSource(this.config.stateKey);
    if (!mainDefinition || !Array.isArray(mainDefinition.levels)) return [];

    let availableUnlocks = [];
    mainDefinition.levels.forEach(levelData => {
      if (levelData.level > targetLevel) return;
      if (isLevelUpMode && levelData.level <= originalLevel) return;
      if (levelData.unlocks) {
        availableUnlocks.push(...levelData.unlocks);
      }
    });
    return availableUnlocks;
  }

  _autoSelectUnlocks() {
    const allUnlocks = this._getUnlocksForCurrentState();
    const allItemDefs = this.stateManager.getItemData();

    allUnlocks.forEach(unlock => {
        if (unlock.type === 'choice' && unlock.items && unlock.items.length === unlock.maxChoices) {
            unlock.items.forEach(itemId => {
                const itemDef = allItemDefs[itemId];
                const groupId = unlock.id;
                if (itemDef && !this.stateManager.itemManager.isItemSelected(itemId)) {
                    const payload = itemDef.itemType === 'inventory' ? { quantity: 1 } : {};
                    this.stateManager.itemManager.selectItem(itemDef, this.config.stateKey, groupId, payload);
                }
            });
        }
    });
  }

  _renderOptions() {
    const container = this.selectorPanel.querySelector(this.config.optionsContainerId);
    if (!container) return;
    container.innerHTML = '';
    const isLevelUpMode = this.stateManager.get('isLevelUpMode');
    if (isLevelUpMode) {
        const selectedId = this.stateManager.get(this.config.stateKey);
        if (selectedId) {
            const optionDef = this.stateManager[this.config.getDataMethodName](selectedId);
            if (optionDef) {
                container.innerHTML += `<div class="${this.config.optionClassName.substring(1)} selected disabled" ${this.config.dataAttribute}="${selectedId}"><span class="${this.config.stateKey}-name">${optionDef.displayName}</span></div>`;
            }
        }
    } else {
        const moduleData = this.stateManager.getModule(this.stateManager.get('module'));
        const options = moduleData ? moduleData[this.config.getOptionsKey] : [];
        if (!options || options.length === 0) {
            container.innerHTML = `<p>No ${this.config.pageName}s available for this module.</p>`;
            return;
        }
        options.forEach(optionId => {
            const optionDef = this.stateManager[this.config.getDataMethodName](optionId);
            if (optionDef) {
                container.innerHTML += `<div class="${this.config.optionClassName.substring(1)}" ${this.config.dataAttribute}="${optionId}"><span class="${this.config.stateKey}-name">${optionDef.displayName}</span></div>`;
            }
        });
    }
  }
  
  /**
   * --- REPLACED ---
   * This method now delegates the complex HTML generation to the InformerContentBuilder.
   */
  getInformerContent() {
    const currentId = this.stateManager.get(this.config.stateKey);
    if (!currentId) return `<p class="informer-placeholder">Select your ${this.config.pageName}.</p>`;

    const mainDefinition = this.stateManager.getDefinitionForSource(this.config.stateKey);
    if (!mainDefinition) return '';

    const builder = new InformerContentBuilder(this.stateManager, this.config.stateKey, mainDefinition);
    return builder.build();
  }
  
  isComplete(currentState) {
    const currentId = currentState[this.config.stateKey];
    if (!currentId) return false;

    const availableUnlocks = this._getUnlocksForCurrentState();
    if (availableUnlocks.length === 0) return true;

    // Check every 'choice' unlock to see if it's satisfied
    return availableUnlocks.every(unlock => {
        if (unlock.type !== 'choice') return true; // Ignore non-choice unlocks

        const selectionsInGroup = currentState.selections.filter(
            sel => sel.groupId === unlock.id && sel.source === this.config.stateKey
        );
        return selectionsInGroup.length === unlock.maxChoices;
    });
  }
  
  getCompletionError() {
    const currentState = this.stateManager.getState();
    const errors = [];
    const availableUnlocks = this._getUnlocksForCurrentState();

    availableUnlocks.forEach(unlock => {
        if (unlock.type !== 'choice') return;

        const selectionsInGroup = currentState.selections.filter(
            sel => sel.groupId === unlock.id && sel.source === this.config.stateKey
        );
        
        const needed = unlock.maxChoices;
        const chosen = selectionsInGroup.length;

        if (chosen < needed) {
            const remaining = needed - chosen;
            const itemLabel = remaining === 1 ? 'choice' : 'choices';
            errors.push(`From "${unlock.name}", you must make ${remaining} more ${itemLabel}.`);
        }
    });
    
    return errors.length > 0 ? errors.join('\n') : `Please complete all required choices.`;
  }

  cleanup() {
    this.contentRenderer?.cleanup();
    const optionsContainer = this.selectorPanel.querySelector(this.config.optionsContainerId);
    if (optionsContainer) {
      optionsContainer.removeEventListener('click', this._boundOptionClickHandler);
    }
    document.removeEventListener('wizard:stateChange', this._boundHandleStateChange);
  }
}

export { ChoicePageHandler };