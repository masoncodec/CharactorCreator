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
   * REFACTORED: Updates the informer panel content for the current page using the new state model.
   * @param {string} page - The name of the current wizard page.
   */
  update(page) {
    if (!this.informerPanel) return;

    const currentState = this.stateManager.getState();
    const allItemDefs = this.stateManager.getItemData(); // Get all item definitions for easy lookup
    let htmlContent = '';

    switch (page) {
      case 'module':
        if (currentState.module) {
          const moduleData = this.stateManager.getModule(currentState.module);
          const destiniesForModule = (moduleData?.destinies || [])
            .map(d => this.stateManager.getDestiny(d)?.displayName || d)
            .join('</li><li>');

          htmlContent = `
            <h3>${moduleData.name}</h3>
            <p>${moduleData.descriptions.module}</p>
            <h4>Available Destinies:</h4><ul><li>${destiniesForModule}</li></ul>`;
        } else {
          htmlContent = '<p>Select a module to begin your journey</p>';
        }
        break;

      case 'frame':
        htmlContent = `<p>This page provides an overview of the campaign setting.</p>`;
        break;

      case 'destiny':
        if (!currentState.destiny) {
          htmlContent = '<p>Select your destiny</p>';
        } else {
          const destiny = this.stateManager.getDestiny(currentState.destiny);
          const destinySelections = currentState.selections.filter(sel => sel.source.startsWith('destiny-'));
          
          // Helper to generate HTML for a list of items based on type
          const renderItems = (itemType, title) => {
              const items = destinySelections.filter(sel => allItemDefs[sel.id]?.itemType === itemType);
              if (items.length === 0) return '';
              return `<h4>${title}</h4>` + items.map(sel => {
                  const itemDef = allItemDefs[sel.id];
                  return `<div class="selected-item-display-card"><h5>${itemDef.name}</h5><p>${itemDef.description}</p></div>`;
              }).join('');
          };

          htmlContent = `
            <h3>${destiny.displayName}</h3>
            <p>${destiny.description}</p>
            <div class="stats"><strong>Health:</strong> ${destiny.health.title} (${destiny.health.value})</div>
            <div class="selected-items-summary">
              ${renderItems('flaw', 'Chosen Flaws')}
              ${renderItems('perk', 'Chosen Perks')}
              ${renderItems('ability', 'Chosen Abilities')}
              ${renderItems('equipment', 'Chosen Equipment')}
            </div>`;
        }
        break;

      case 'attributes':
        if (currentState.module) {
          const moduleData = this.stateManager.getModule(currentState.module);
          const attributeList = (moduleData?.attributes || [])
            .map(attr => `<li><strong>${attr}</strong>: ${currentState.attributes[attr.toLowerCase()] || 'Unassigned'}</li>`)
            .join('');
          htmlContent = `<h3>${moduleData.name} Attributes</h3><ul>${attributeList}</ul>`;
        } else {
          htmlContent = `<h3>Attributes</h3><p>Select a module first to see attributes.</p>`;
        }
        break;

      case 'flaws-and-perks': {
        const independentSelections = currentState.selections.filter(sel => sel.source.startsWith('independent-'));
        
        const renderIndependentItems = (itemType, title) => {
            const items = independentSelections.filter(sel => allItemDefs[sel.id]?.itemType === itemType);
            if (items.length === 0) return `<p>No independent ${itemType}s selected yet.</p>`;
            return items.map(sel => {
                const itemDef = allItemDefs[sel.id];
                return `<div class="selected-item-display-card"><h5>${itemDef.name} (${itemDef.weight} pts)</h5></div>`;
            }).join('');
        };
        
        const totalFlawPoints = this.stateManager.getIndependentFlawTotalWeight();
        const totalPerkPoints = this.stateManager.getIndependentPerkTotalWeight();

        htmlContent = `
          <h3>Your Selections</h3>
          <div class="points-summary-container">
            <div><strong>Flaw Points: ${totalFlawPoints}</strong></div>
            <div><strong>Perk Points: ${totalPerkPoints} / ${totalFlawPoints}</strong></div>
          </div>
          <div class="selected-items-columns">
            <div class="selected-column">
              <h4>Selected Flaws</h4>
              ${renderIndependentItems('flaw', 'Selected Flaws')}
            </div>
            <div class="selected-column">
              <h4>Selected Perks</h4>
              ${renderIndependentItems('perk', 'Selected Perks')}
            </div>
          </div>`;
        break;
      }

      case 'equipment-and-loot': {
        const { spent, total } = this.stateManager.getEquipmentPointsSummary();
        const equipmentSelections = currentState.selections.filter(sel => sel.source === 'equipment-and-loot');

        let inventoryListHtml = '';
        if (equipmentSelections.length === 0) {
            inventoryListHtml = '<p>Your inventory is empty.</p>';
        } else {
            inventoryListHtml = '<ul>' + equipmentSelections.map(sel => {
                const itemDef = allItemDefs[sel.id];
                return `<li>${itemDef.name} (${itemDef.weight} pts)</li>`;
            }).join('') + '</ul>';
        }

        htmlContent = `
          <h3>Equipment & Loot</h3>
          <div class="points-summary-container">
            <strong>Equipment Points: ${spent} / ${total}</strong>
          </div>
          <div id="current-inventory-list">${inventoryListHtml}</div>`;
        break;
      }
        
      case 'info':
        htmlContent = `
          <h3>Character Summary</h3>
          <p><strong>Name:</strong> ${currentState.info.name || 'Not set'}</p>
          <p><strong>Bio:</strong> ${currentState.info.bio || 'Not set'}</p>`;
        break;

      default:
        htmlContent = '<p>Information will appear here as you make selections.</p>';
        break;
    }

    this.informerPanel.innerHTML = htmlContent;
  }
}

export { InformerUpdater };