// informerUpdater.js
// This module manages the content displayed in the informer panel,
// based on the current wizard page and the wizard's state.

class InformerUpdater {
  /**
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   */
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.informerPanel = document.getElementById('informerPanel');

    if (!this.informerPanel) {
      console.warn('InformerUpdater: Informer panel not found. Display updates will not occur.');
    }
    console.log('InformerUpdater: Initialized.');
  }

  /**
   * Updates the informer panel content for the current page.
   * @param {string} page - The name of the current wizard page.
   */
  update(page) {
    if (!this.informerPanel) {
      return; // Can't update if panel doesn't exist
    }

    const currentState = this.stateManager.getState();
    console.log(`InformerUpdater.update: Updating informer for page: ${page}. Current State:`, currentState);

    let htmlContent = '';

    switch (page) {
      case 'module':
        if (currentState.module) {
          const moduleData = this.stateManager.getModule(currentState.module);
          const destiniesForModule = (moduleData?.destinies || [])
            .map(d => this.stateManager.getDestiny(d)?.displayName || d)
            .join('</li><li>');

          htmlContent = `
            <div class="module-info">
              <h3>${moduleData.name}</h3>
              <p>${moduleData.descriptions.module}</p>
              <h4>Available Destinies:</h4>
              <ul>
                <li>${destiniesForModule}</li>
              </ul>
            </div>`;
        } else {
          htmlContent = '<div class="module-info"><p>Select a module to begin your journey</p></div>';
        }
        break;

      case 'frame': 
        htmlContent = `
          <div class="frame-informer">
            <p>This page provides an overview of the campaign setting. Additional details about specific terms may appear here in the future.</p>
          </div>
        `;
        break;

      case 'destiny':
        if (!currentState.destiny) {
          htmlContent = '<p>Select your destiny</p>';
        } else {
          const destiny = this.stateManager.getDestiny(currentState.destiny);
          
          // Render selected flaws (both destiny-sourced and independent)
          const allSelectedFlaws = currentState.flaws;
          const selectedFlawsHtml = allSelectedFlaws.length > 0
            ? allSelectedFlaws.map(flawState => {
                const flawDef = this.stateManager.getFlaw(flawState.id);
                if (!flawDef) return '';
                
                const nestedOptionsHtml = flawState.selections && flawState.selections.length > 0
                  ? `<ul>${flawState.selections.map(sel => {
                      const option = flawDef.options?.find(o => o.id === sel.id);
                      return option ? `<li>${option.name}</li>` : '';
                    }).join('')}</ul>`
                  : '';

                return `
                  <div class="selected-flaw-item">
                    <h4>Flaw: ${flawDef.name} (${flawState.source === 'destiny' ? 'Destiny' : 'Independent'})</h4>
                    <p>${flawDef.description}</p>
                    ${nestedOptionsHtml}
                  </div>`;
              }).join('')
            : '<p>No flaws selected yet.</p>';

          // Render selected perks
          const allSelectedPerks = currentState.perks;
          const selectedPerksHtml = allSelectedPerks.length > 0
            ? allSelectedPerks.map(perkState => {
                const perkDef = this.stateManager.getPerk(perkState.id);
                if (!perkDef) return '';
                
                const nestedOptionsHtml = perkState.selections && perkState.selections.length > 0
                  ? `<ul>${perkState.selections.map(sel => {
                      const option = perkDef.options?.find(o => o.id === sel.id);
                      return option ? `<li>${option.name}</li>` : '';
                    }).join('')}</ul>`
                  : '';

                return `
                  <div class="selected-perk-item">
                    <h4>Perk: ${perkDef.name} (${perkState.source === 'destiny' ? 'Destiny' : 'Independent'})</h4>
                    <p>${perkDef.description}</p>
                    ${nestedOptionsHtml}
                  </div>`;
              }).join('')
            : '<p>No perks selected yet.</p>';

          // Render selected abilities
          const selectedAbilitiesHtml = currentState.abilities.length > 0
            ? currentState.abilities.map(abilityState => {
                const abilityDef = this.stateManager.getAbilityOrFlawData(abilityState.id, abilityState.groupId);
                if (!abilityDef) return '';

                const nestedOptionsHtml = abilityState.selections && abilityState.selections.length > 0
                  ? `<ul>${abilityState.selections.map(sel => {
                      const option = abilityDef.options?.find(o => o.id === sel.id);
                      return option ? `<li>${option.name}</li>` : '';
                    }).join('')}</ul>`
                  : '';

                return `
                  <div class="selected-ability-item">
                    <h4>Ability: ${abilityDef.name}</h4>
                    <p>${abilityDef.description}</p>
                    ${nestedOptionsHtml}
                  </div>`;
              }).join('')
            : '<p>No abilities selected yet.</p>';

          htmlContent = `
            <div class="destiny-info">
              <h3>${destiny.displayName}</h3>
              <p>${destiny.description}</p>
              <div class="stats">
                <div><strong>Health:</strong> ${destiny.health.title} (${destiny.health.value})</div>
              </div>
              <div class="tags">${this._renderTags(destiny.tags)}</div>
              <div class="selected-items-summary">
                <h4>Selected Flaws</h4>
                ${selectedFlawsHtml}
                <h4>Selected Perks</h4>
                ${selectedPerksHtml}
                <h4>Selected Abilities</h4>
                ${selectedAbilitiesHtml}
              </div>
            </div>`;
        }
        break;

      case 'attributes':
        if (currentState.module) {
          const moduleData = this.stateManager.getModule(currentState.module);
          const attributeList = (moduleData?.attributes || [])
            .map(attr => `<li><strong>${attr}</strong>: ${currentState.attributes[attr.toLowerCase()] || 'Unassigned'}</li>`)
            .join('');

          htmlContent = `
            <div class="attributes-info">
              <h3>${moduleData.name} Attributes</h3>
              <p>Assign dice to your attributes:</p>
              <ul>${attributeList}</ul>
            </div>`;
        } else {
          htmlContent = `
            <div class="attributes-info">
              <h3>Attributes</h3>
              <p>Select a module first to see attributes.</p>
            </div>`;
        }
        break;

      case 'flaws-and-perks':
        const independentFlaws = currentState.flaws.filter(f => f.source === 'independent-flaw');
        const selectedIndependentFlawsHtml = independentFlaws.length > 0
          ? independentFlaws.map(flawState => {
              const flawDef = this.stateManager.getFlaw(flawState.id);
              if (!flawDef) return '';

              const nestedOptionsHtml = flawState.selections && flawState.selections.length > 0
                ? `<ul>${flawState.selections.map(sel => {
                    const option = flawDef.options?.find(o => o.id === sel.id);
                    return option ? `<li>${option.name}</li>` : '';
                  }).join('')}</ul>`
                : '';

              return `
                <div class="selected-item-display-card">
                  <h4>${flawDef.name}</h4>
                  <p>${flawDef.description}</p>
                  ${nestedOptionsHtml}
                </div>`;
            }).join('')
          : '<p>No independent flaws selected yet.</p>';

        const independentPerks = currentState.perks.filter(p => p.source === 'independent-perk');
        const selectedIndependentPerksHtml = independentPerks.length > 0
          ? independentPerks.map(perkState => {
              const perkDef = this.stateManager.getPerk(perkState.id);
              if (!perkDef) return '';

              const nestedOptionsHtml = perkState.selections && perkState.selections.length > 0
                ? `<ul>${perkState.selections.map(sel => {
                    const option = perkDef.options?.find(o => o.id === sel.id);
                    return option ? `<li>${option.name}</li>` : '';
                  }).join('')}</ul>`
                : '';

              return `
                <div class="selected-item-display-card">
                  <h4>${perkDef.name}</h4>
                  <p>${perkDef.description}</p>
                  ${nestedOptionsHtml}
                </div>`;
            }).join('')
          : '<p>No independent perks selected yet.</p>';

        const totalFlawPoints = this.stateManager.getIndependentFlawTotalWeight();
        const totalPerkPoints = this.stateManager.getIndependentPerkTotalWeight();

        htmlContent = `
          <div class="flaws-and-perks-info">
            <h3>Your Selections</h3>
            <div class="points-summary-container">
                <div class="flaw-points-summary">
                    <strong>Total Flaw Points: ${totalFlawPoints}</strong>
                </div>
                <div class="perk-points-summary">
                    <strong>Total Perk Points: ${totalPerkPoints} / ${totalFlawPoints}</strong>
                </div>
            </div>
            <div class="selected-items-columns">
                <div class="selected-column">
                    <h4>Selected Flaws</h4>
                    ${selectedIndependentFlawsHtml}
                </div>
                <div class="selected-column">
                    <h4>Selected Perks</h4>
                    ${selectedIndependentPerksHtml}
                </div>
            </div>
          </div>`;
        break;

      case 'equipment-and-loot':
        const inventory = currentState.inventory.filter(i => i.source === 'equipment-and-loot');
        const allItemDefinitions = this.stateManager.getEquipmentAndLootData();
        const { spent, total } = this.stateManager.getEquipmentPointsSummary();

        let inventoryListHtml = '';
        if (inventory.length === 0) {
          inventoryListHtml = '<p class="text-gray-400">Your inventory is empty.</p>';
        } else {
          inventoryListHtml = '<ul class="space-y-2">';
          inventory.forEach(itemState => {
            const itemDef = allItemDefinitions[itemState.id];
            if (itemDef) {
              const itemPointCost = (itemDef.weight || 0) * itemState.quantity;
              inventoryListHtml += `
                <li class="bg-gray-800 p-2 rounded flex justify-between items-center text-gray-200 text-sm">
                  <span>${itemDef.name} ${itemState.quantity > 1 ? `(x${itemState.quantity})` : ''}</span>
                  <div class="flex items-center">
                    ${itemState.equipped ? '<span class="text-green-400 text-xs font-bold">(Equipped)</span>' : ''}
                  </div>
                </li>
              `;
            }
          });
          inventoryListHtml += '</ul>';
        }

        htmlContent = `
          <h3 class="text-xl font-bold mb-4">Equipment & Loot</h3>
          <div class="points-summary-container mb-4">
            <div class="perk-points-summary">
                <strong>Equipment Points: ${spent} / ${total}</strong>
            </div>
          </div>
          <div id="current-inventory-list" class="bg-gray-700 p-4 rounded-lg shadow-inner max-h-96 overflow-y-auto">
            ${inventoryListHtml}
          </div>
        `;
        break;
        
      case 'info':
        htmlContent = `
          <div class="info-panel-content">
            <h3>Character Summary</h3>
            <p><strong>Name:</strong> ${currentState.info.name || 'Not set'}</p>
            <p><strong>Bio:</strong> ${currentState.info.bio || 'Not set'}</p>
          </div>`;
        break;

      default:
        htmlContent = '<p>Information will appear here as you make selections.</p>';
        break;
    }

    this.informerPanel.innerHTML = htmlContent;
    console.log(`InformerUpdater.update: Informer content updated for page: ${page}.`);
  }

  /**
   * Helper function to render tags.
   * @param {Array<Object>} tags - Array of tag objects {display, icon, color}.
   * @returns {string} HTML string for tags.
   * @private
   */
  _renderTags(tags) {
    if (!tags || tags.length === 0) return '';
    return tags.map(tag => `
      <span class="tag" style="background: ${tag.color}">
        ${tag.icon} ${tag.display}
      </span>
    `).join('');
  }
}

export { InformerUpdater };