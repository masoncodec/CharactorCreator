// js/wizard/PageContentRenderer.js
// FINAL CORRECTED VERSION: Creates a standardized context for all sub-components.

import { ItemSelectorComponent } from './ItemSelectorComponent.js';
import { EquipmentSelectorComponent } from './EquipmentSelectorComponent.js';
import { PointBuyComponent } from './PointBuyComponent.js';

class PageContentRenderer {
  constructor(container, stateManager, ruleEngine) {
    this.container = container;
    this.stateManager = stateManager;
    this.ruleEngine = ruleEngine;
    this.activeComponents = [];
  }

  /**
   * @param {Array} unlocks - The list of unlock objects to render.
   * @param {string} sourceId - The source key for this page (e.g., 'destiny').
   * @param {Object} mainPageDefinition - The full definition object for the page.
   */
  render(unlocks, sourceId, mainPageDefinition) {
    this.cleanup();
    this.container.innerHTML = '';
    const allItemDefs = this.stateManager.getItemData();

    if (!unlocks || unlocks.length === 0) return;

    unlocks.forEach(unlock => {
      // --- FIX: This context object is now created correctly and consistently. ---
      const context = {
        getDefinition: () => mainPageDefinition,
        unlock: unlock,
        pageType: unlock.type // Pass the unlock type for the RuleEngine
      };

      switch (unlock.type) {
        case 'reward':
          this.renderRewardUnlock(unlock);
          break;
        case 'choice':
          this.renderChoiceUnlock(unlock, sourceId, allItemDefs, context);
          break;
        case 'pointBuy':
          this.renderPointBuyUnlock(unlock, sourceId, context);
          break;
        default:
          console.warn(`Unknown unlock type: ${unlock.type}`);
      }
    });
  }

  renderRewardUnlock(unlock) {
    const rewardEl = document.createElement('div');
    rewardEl.className = 'reward-unlock-container';
    let content = `<h5 class="group-header">${unlock.name || 'Automatic Reward'}</h5>`;
    if (unlock.rewards?.health) {
      content += `<p class="reward-text">+${unlock.rewards.health} Max Health</p>`;
    }
    if (unlock.rewards?.attributes) {
      for (const [attr, value] of Object.entries(unlock.rewards.attributes)) {
        content += `<p class="reward-text">+${value} ${attr.charAt(0).toUpperCase() + attr.slice(1)}</p>`;
      }
    }
    rewardEl.innerHTML = content;
    this.container.appendChild(rewardEl);
  }

  renderChoiceUnlock(unlock, sourceId, allItemDefs, context) {
    const groupContainer = document.createElement('div');
    groupContainer.className = 'ability-group-container';
    const maxChoicesText = unlock.maxChoices === 1 ? 'Choose 1' : unlock.maxChoices === -1 ? 'Choose any' : `Choose up to ${unlock.maxChoices}`;
    groupContainer.innerHTML = `<h5 class="group-header">${unlock.name} (${maxChoicesText})</h5>`;
    
    const componentContainer = document.createElement('div');
    componentContainer.className = 'abilities-grid-container';
    groupContainer.appendChild(componentContainer);
    this.container.appendChild(groupContainer);

    const itemsForGroup = (unlock.items || []).reduce((acc, itemId) => {
        const itemData = allItemDefs[itemId];
        if (itemData) acc[itemId] = { ...itemData, groupId: unlock.id };
        return acc;
    }, {});

    const SelectorComponent = (unlock.itemType === 'equipment' || unlock.itemType === 'loot')
      ? EquipmentSelectorComponent
      : ItemSelectorComponent;
    
    const selector = new SelectorComponent(
      componentContainer, itemsForGroup, sourceId, 
      this.stateManager, this.ruleEngine, context
    );
    this.activeComponents.push(selector);
    selector.render();
  }

  renderPointBuyUnlock(unlock, sourceId, context) {
    const pointBuyContainer = document.createElement('div');
    pointBuyContainer.className = 'embedded-point-buy-system';
    this.container.appendChild(pointBuyContainer);
    
    const componentSourceId = `${sourceId}-${unlock.id}`;
    
    const component = new PointBuyComponent(pointBuyContainer, unlock, componentSourceId, this.stateManager, this.ruleEngine, context);
    this.activeComponents.push(component);
    component.render();
  }

  cleanup() {
    this.activeComponents.forEach(c => c.cleanup());
    this.activeComponents = [];
  }
}

export { PageContentRenderer };