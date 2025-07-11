// js/wizard/ChoicePageHandler.js
// FINAL VERSION: Correctly scopes completion validation to the specific page.

import { InformerContentBuilder } from './InformerContentBuilder.js';
import { PageContentRenderer } from './PageContentRenderer.js';
import { RuleEngine } from './RuleEngine.js';

class ChoicePageHandler {
  constructor(stateManager, config) {
    this.stateManager = stateManager;
    this.config = config;
    this.selectorPanel = null;
    this.contentRenderer = null;
    this.contentContainer = null;

    this._boundOptionClickHandler = this._handleOptionClick.bind(this);
    this._boundHandleStateChange = this._handleStateChange.bind(this);
  }

  setupPage(selectorPanel) {
    this.selectorPanel = selectorPanel;

    const contentContainerId = `${this.config.stateKey}-content-container`;
    let contentContainer = this.selectorPanel.querySelector(`#${contentContainerId}`);
    if (!contentContainer) {
      contentContainer = document.createElement('div');
      contentContainer.id = contentContainerId;
      this.selectorPanel.appendChild(contentContainer);
    }
    this.contentContainer = contentContainer;
    
    this.contentRenderer = new PageContentRenderer(
      this.contentContainer,
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
    const key = event.detail.key;
    const needsInformerUpdate = [
        'selections', 
        'creationLevel', 
        this.config.stateKey
    ].includes(key);

    if (needsInformerUpdate) {
        if (key === 'creationLevel') {
            this._autoSelectUnlocks();
            this._renderPageContent();
        } else if (key === 'selections') {
            this._renderPageContent();
        }
        
        document.dispatchEvent(new CustomEvent('wizard:informerUpdate', { detail: { handler: this } }));
    }
  }

  _handleOptionClick(e) {
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
      
      this._autoSelectUnlocks();
      this._renderPageContent();
    } else {
        if (this.contentContainer) {
          this.contentContainer.innerHTML = '';
        }
    }
  }

  _renderPageContent() {
    if (this.contentRenderer) {
      const mainDefinition = this.stateManager.getDefinitionForSource(this.config.stateKey);
      this.contentRenderer.render(this.config.stateKey, mainDefinition);
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
    
    if (this.stateManager.get('isLevelUpMode')) {
        const selectedId = this.stateManager.get(this.config.stateKey);
        if (selectedId) {
            const optionDef = this.stateManager[this.config.getDataMethodName](selectedId);
            if (optionDef) {
                container.innerHTML += `<div class="${this.config.optionClassName.substring(1)} selected" ${this.config.dataAttribute}="${selectedId}"><span class="${this.config.stateKey}-name">${optionDef.displayName}</span></div>`;
            }
        }
        return;
    }

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
    if (!currentId) {
      return false;
    }
    
    // --- FIX: Filter selections to only those relevant to THIS page ---
    const selectionsForThisPage = currentState.selections.filter(
      sel => sel.source === this.config.stateKey
    );
    
    const availableUnlocks = this._getUnlocksForCurrentState();

    const mainChoicesComplete = availableUnlocks.every(unlock => {
      if (unlock.type !== 'choice' || !unlock.maxChoices || unlock.maxChoices <= 0) {
        return true;
      }
      // Use the filtered selections array for this check
      const selectionsInGroup = selectionsForThisPage.filter(
        sel => sel.groupId === unlock.id
      );
      return selectionsInGroup.length === unlock.maxChoices;
    });

    if (!mainChoicesComplete) {
      return false;
    }

    // Use the filtered selections array for the nested options check as well
    if (!this.stateManager.itemManager.hasAllNestedOptionsSelected(selectionsForThisPage)) {
      return false;
    }

    return true;
  }
  
  getCompletionError(currentState) {
    const errors = [];
    
    // --- FIX: Filter selections to only those relevant to THIS page ---
    const selectionsForThisPage = currentState.selections.filter(
      sel => sel.source === this.config.stateKey
    );

    const availableUnlocks = this._getUnlocksForCurrentState();

    availableUnlocks.forEach(unlock => {
      if (unlock.type !== 'choice' || !unlock.maxChoices || unlock.maxChoices <= 0) {
        return;
      }
      // Use the filtered selections array for this check
      const selectionsInGroup = selectionsForThisPage.filter(
        sel => sel.groupId === unlock.id
      );
      const needed = unlock.maxChoices;
      const chosen = selectionsInGroup.length;

      if (chosen < needed) {
        const remaining = needed - chosen;
        const itemLabel = remaining === 1 ? 'choice' : 'choices';
        errors.push(`From "${unlock.name}", you must make ${remaining} more ${itemLabel}.`);
      }
    });
    
    // Use the filtered selections array for the nested options check
    const nestedOptionErrors = this.stateManager.itemManager.getNestedOptionsCompletionErrors(selectionsForThisPage);
    errors.push(...nestedOptionErrors);
    
    return errors.join('\n');
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