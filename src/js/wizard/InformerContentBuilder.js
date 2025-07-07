// js/wizard/InformerContentBuilder.js
// NEW FILE: A centralized module to build the HTML for the informer panel.

/**
 * A utility class to build the HTML content for the informer panel.
 */
class InformerContentBuilder {
    constructor(stateManager, pageSourceId, mainDefinition) {
        this.stateManager = stateManager;
        this.pageSourceId = pageSourceId;
        this.mainDefinition = mainDefinition;
        this.currentState = stateManager.getState();
        this.allItemDefs = stateManager.getItemData();
    }

    /**
     * The main public method to generate the complete informer HTML.
     */
    build() {
        if (!this.mainDefinition) return '';

        let content = `<h3>${this.mainDefinition.displayName}</h3>`;
        if (this.mainDefinition.description) {
            content += `<p class="informer-description">${this.mainDefinition.description}</p>`;
        }
        
        const allUnlocks = this._getUnlocksForPage();

        allUnlocks.forEach(unlock => {
            switch (unlock.type) {
                case 'reward':
                    content += this._buildRewardSection(unlock);
                    break;
                case 'choice':
                    content += this._buildChoiceSection(unlock);
                    break;
                case 'pointBuy':
                    content += this._buildPointBuySection(unlock);
                    break;
            }
        });

        return content;
    }

    /**
     * Gathers all relevant unlocks for the current page and level.
     */
    _getUnlocksForPage() {
        const targetLevel = this.currentState.creationLevel;
        let availableUnlocks = [];
        if (this.mainDefinition && Array.isArray(this.mainDefinition.levels)) {
            this.mainDefinition.levels.forEach(levelData => {
                if (levelData.level <= targetLevel && levelData.unlocks) {
                    availableUnlocks.push(...levelData.unlocks);
                }
            });
        }
        return availableUnlocks;
    }
    
    /**
     * Builds HTML for 'reward' unlocks.
     */
    _buildRewardSection(unlock) {
        let rewardContent = '';
        if (unlock.rewards?.health) {
            rewardContent += `<li class="informer-item--reward">+${unlock.rewards.health} Max Health</li>`;
        }
        if (unlock.rewards?.attributes) {
            for (const [attr, value] of Object.entries(unlock.rewards.attributes)) {
                rewardContent += `<li class="informer-item--reward">+${value} ${attr.charAt(0).toUpperCase() + attr.slice(1)}</li>`;
            }
        }
        if (!rewardContent) return '';
        return `
            <div class="informer-group">
                <h5 class="informer-group-title">${unlock.name || 'Automatic Reward'}</h5>
                <ul class="informer-item-list">${rewardContent}</ul>
            </div>
        `;
    }

    /**
     * Builds HTML for 'choice' unlocks, listing selected items.
     */
    _buildChoiceSection(unlock) {
        const selectionsInGroup = this.currentState.selections.filter(
            sel => sel.groupId === unlock.id && (sel.source === this.pageSourceId || sel.source.startsWith(this.pageSourceId))
        );

        if (selectionsInGroup.length === 0) return '';
        
        const itemsHtml = selectionsInGroup.map(sel => {
            const itemDef = this.allItemDefs[sel.id];
            return itemDef ? `<li class="informer-item--choice">${itemDef.name}</li>` : '';
        }).join('');

        return `
            <div class="informer-group">
                <h5 class="informer-group-title">${unlock.name}</h5>
                <ul class="informer-item-list">${itemsHtml}</ul>
            </div>
        `;
    }
    
    /**
     * Builds HTML for 'pointBuy' unlocks, showing the summary and listing items.
     */
    _buildPointBuySection(unlock) {
        const pointSummary = this.stateManager.getPointPoolSummary(unlock);
        let content = `
            <div class="informer-group">
                <div class="points-summary-container">
                    <strong>${pointSummary.name}:</strong> 
                    <span class="points-current">${pointSummary.current}</span>
                    ${pointSummary.total > 0 ? ` / <span class="points-total">${pointSummary.total}</span>` : ''}
                </div>
            </div>`;

        // Also list items selected within this point-buy system
        Object.keys(unlock.groups || {}).forEach(groupId => {
            const groupUnlock = { id: groupId, name: unlock.groups[groupId].name };
            // Use the choice section builder to render the items for this subgroup
            content += this._buildChoiceSection(groupUnlock); 
        });

        return content;
    }
}

export { InformerContentBuilder };