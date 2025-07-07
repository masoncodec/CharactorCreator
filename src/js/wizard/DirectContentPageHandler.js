// js/wizard/DirectContentPageHandler.js

import { PageContentRenderer } from './PageContentRenderer.js';
import { RuleEngine } from './RuleEngine.js';
import { InformerContentBuilder } from './InformerContentBuilder.js';

class DirectContentPageHandler {
  constructor(stateManager, config) {
    this.stateManager = stateManager;
    this.config = config;
    this.contentRenderer = null;
    this.pageDef = null;

    this._boundHandleStateChange = this._handleStateChange.bind(this);
  }

  setupPage(selectorPanel) {
    this.pageDef = this.stateManager.data[this.config.definitionKey];
    if (!this.pageDef) {
        selectorPanel.innerHTML = `<p>Error: ${this.config.pageName} definition not found.</p>`;
        return;
    }
    
    this.contentRenderer = new PageContentRenderer(
      selectorPanel, this.stateManager, new RuleEngine(this.stateManager)
    );
    this.render();

    document.addEventListener('wizard:stateChange', this._boundHandleStateChange);
  }
  
  _handleStateChange(event) {
      if (event.detail.key === 'selections' || event.detail.key === 'creationLevel') {
          this.render();
          document.dispatchEvent(new CustomEvent('wizard:informerUpdate', { detail: { handler: this } }));
      }
  }
  
  render() {
    if (!this.contentRenderer) return;
    this.contentRenderer.render(this.config.sourceId, this.pageDef);
  }

  getInformerContent() {
    if (!this.pageDef) return '';
    const definitionForBuilder = {
      ...this.pageDef,
      displayName: this.config.pageName
    };
    const builder = new InformerContentBuilder(this.stateManager, this.config.sourceId, definitionForBuilder);
    return builder.build();
  }

  isComplete() {
    const allSelections = this.stateManager.get('selections');
    const availableUnlocks = this._getUnlocksForCurrentState();
    const selectionsForThisPage = allSelections.filter(sel =>
      sel.source.startsWith(this.config.sourceId)
    );

    const mainChoicesComplete = availableUnlocks.every(unlock => {
      if (unlock.type !== 'choice' || !unlock.maxChoices || unlock.maxChoices <= 0) {
        return true;
      }
      const selectionsInGroup = selectionsForThisPage.filter(
        sel => sel.groupId === unlock.id
      );
      return selectionsInGroup.length === unlock.maxChoices;
    });

    if (!mainChoicesComplete) {
      return false;
    }

    const pointBuyUnlock = availableUnlocks.find(u => u.type === 'pointBuy');
    if (pointBuyUnlock) {
      const pointSummary = this.stateManager.getPointPoolSummary(pointBuyUnlock);
      if (pointSummary.current < 0) {
        return false;
      }
    }

    if (!this.stateManager.itemManager.hasAllNestedOptionsSelected(selectionsForThisPage)) {
      return false;
    }

    return true;
  }

  getCompletionError() {
    const errorMessages = [];
    const allSelections = this.stateManager.get('selections');
    const availableUnlocks = this._getUnlocksForCurrentState();
    const selectionsForThisPage = allSelections.filter(sel =>
      sel.source.startsWith(this.config.sourceId)
    );

    availableUnlocks.forEach(unlock => {
      if (unlock.type !== 'choice' || !unlock.maxChoices || unlock.maxChoices <= 0) {
        return;
      }
      const selectionsInGroup = selectionsForThisPage.filter(
        sel => sel.groupId === unlock.id
      );
      const needed = unlock.maxChoices;
      const chosen = selectionsInGroup.length;

      if (chosen < needed) {
        const remaining = needed - chosen;
        const itemLabel = remaining === 1 ? 'choice' : 'choices';
        errorMessages.push(`From "${unlock.name}", you must make ${remaining} more ${itemLabel}.`);
      }
    });

    const pointBuyUnlock = availableUnlocks.find(u => u.type === 'pointBuy');
    if (pointBuyUnlock) {
      const pointSummary = this.stateManager.getPointPoolSummary(pointBuyUnlock);
      if (pointSummary.current < 0) {
        errorMessages.push(`You have overspent by ${Math.abs(pointSummary.current)} point(s).`);
      }
    }

    const nestedOptionErrors = this.stateManager.itemManager.getNestedOptionsCompletionErrors(selectionsForThisPage);
    
    return errorMessages.concat(nestedOptionErrors).join('\n');
  }

  _getUnlocksForCurrentState() {
    const targetLevel = this.stateManager.get('creationLevel');
    let availableUnlocks = [];
    if (this.pageDef && Array.isArray(this.pageDef.levels)) {
        this.pageDef.levels.forEach(levelData => {
            if (levelData.level <= targetLevel && levelData.unlocks) {
                availableUnlocks.push(...levelData.unlocks);
            }
        });
    }
    return availableUnlocks;
  }

  cleanup() {
    this.contentRenderer?.cleanup();
    document.removeEventListener('wizard:stateChange', this._boundHandleStateChange);
  }
}

export { DirectContentPageHandler };