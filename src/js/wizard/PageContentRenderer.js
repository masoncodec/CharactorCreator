// js/wizard/PageContentRenderer.js
// REFACTORED: Now groups content by level.

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
   * REFACTORED: This method now drives the rendering process by looping through levels.
   * @param {string} sourceId - The source key for this page (e.g., 'destiny').
   * @param {Object} mainPageDefinition - The full definition object for the page.
   */
  render(sourceId, mainPageDefinition) {
    this.cleanup();
    this.container.innerHTML = '';
    const allItemDefs = this.stateManager.getItemData();

    if (!mainPageDefinition || !mainPageDefinition.levels) return;

    const isLevelUpMode = this.stateManager.get('isLevelUpMode');
    const originalLevel = this.stateManager.get('originalLevel');
    const targetLevel = this.stateManager.get('creationLevel');

    // 1. Loop through each level defined in the page data.
    mainPageDefinition.levels.forEach(levelData => {
      // Rule Checks
      if (levelData.level > targetLevel) return;
      if (isLevelUpMode && levelData.level <= originalLevel) return;
      if (!levelData.unlocks || levelData.unlocks.length === 0) return;

      // 2. Create the container and header for this level group.
      const levelContainer = document.createElement('div');
      levelContainer.className = 'level-container';
      levelContainer.innerHTML = `<h4 class="level-header">Level ${levelData.level}</h4>`;
      
      const contentGrid = document.createElement('div');
      contentGrid.className = 'level-content-grid';
      levelContainer.appendChild(contentGrid);

      // 3. Loop through the unlocks FOR THIS LEVEL and render them into the container.
      levelData.unlocks.forEach(unlock => {
        const context = {
          getDefinition: () => mainPageDefinition,
          unlock: unlock,
          pageType: unlock.type
        };

        switch (unlock.type) {
          case 'reward':
            this.renderRewardUnlock(unlock, contentGrid);
            break;
          case 'choice':
            this.renderChoiceUnlock(unlock, sourceId, allItemDefs, context, contentGrid);
            break;
          case 'pointBuy':
            this.renderPointBuyUnlock(unlock, sourceId, context, contentGrid);
            break;
          default:
            console.warn(`Unknown unlock type: ${unlock.type}`);
        }
      });
      
      // 4. Append the completed level container to the main panel.
      this.container.appendChild(levelContainer);
    });
  }

  renderRewardUnlock(unlock, parentContainer) {
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
    parentContainer.appendChild(rewardEl);
  }

  renderChoiceUnlock(unlock, sourceId, allItemDefs, context, parentContainer) {
    const groupContainer = document.createElement('div');
    groupContainer.className = 'ability-group-container';
    const maxChoicesText = unlock.maxChoices === 1 ? 'Choose 1' : unlock.maxChoices === -1 ? 'Choose any' : `Choose up to ${unlock.maxChoices}`;
    groupContainer.innerHTML = `<h5 class="group-header">${unlock.name} (${maxChoicesText})</h5>`;
    
    const componentContainer = document.createElement('div');
    componentContainer.className = 'abilities-grid-container';
    groupContainer.appendChild(componentContainer);
    parentContainer.appendChild(groupContainer);

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

  renderPointBuyUnlock(unlock, sourceId, context, parentContainer) {
    const pointBuyContainer = document.createElement('div');
    pointBuyContainer.className = 'embedded-point-buy-system';
    parentContainer.appendChild(pointBuyContainer);
    
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