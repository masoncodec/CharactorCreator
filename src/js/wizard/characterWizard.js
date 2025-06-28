// characterWizard.js
// This is the main orchestrator for the character creation wizard.
// REFACTORED: This version implements a more modular architecture and re-establishes
// the central state change listener for dynamic UI updates.

// --- Core Modules ---
import { loadGameData } from '../dataLoader.js';
import { alerter } from '../alerter.js';
import { EffectHandler } from '../effectHandler.js';

// --- New/Refactored Architectural Components ---
import { WizardStateManager } from './wizardStateManager.js';
import { PageNavigator } from './pageNavigator.js';
import { InformerUpdater } from './informerUpdater.js';
import { CharacterFinisher } from './characterFinisher.js';

// --- Page-Specific Handlers ---
import { ModulePageHandler } from './modulePageHandler.js';
import { FramePageHandler } from './framePageHandler.js';
import { DestinyPageHandler } from './destinyPageHandler.js';
import { AttributesPageHandler } from './attributesPageHandler.js';
import { FlawsAndPerksPageHandler } from './flawsAndPerksPageHandler.js';
import { EquipmentAndLootPageHandler } from './equipmentAndLootPageHandler.js';
import { InfoPageHandler } from './infoPageHandler.js';

class CharacterWizard {
  constructor(moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData, db) {
    this.stateManager = new WizardStateManager(moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData);
    this.pages = ['module', 'frame', 'destiny', 'attributes', 'flaws-and-perks', 'equipment-and-loot', 'info'];
    
    this.pageHandlers = {
      module: new ModulePageHandler(this.stateManager),
      frame: new FramePageHandler(this.stateManager),
      destiny: new DestinyPageHandler(this.stateManager),
      attributes: new AttributesPageHandler(this.stateManager, alerter),
      'flaws-and-perks': new FlawsAndPerksPageHandler(this.stateManager),
      'equipment-and-loot': new EquipmentAndLootPageHandler(this.stateManager),
      info: new InfoPageHandler(this.stateManager)
    };

    this.pageNavigator = new PageNavigator(this.pages, this.stateManager, this.pageHandlers, {
      loadPage: this.loadPage.bind(this)
    });

    this.informerUpdater = new InformerUpdater(this.stateManager);
    this.characterFinisher = new CharacterFinisher(this.stateManager, db, alerter, EffectHandler, this.pageNavigator, this.pages);
    this.activePageHandler = null;

    console.log('CharacterWizard: Initializing main wizard application.');
    this.init();
  }

  /**
   * Sets up global event listeners and loads the initial page.
   */
  init() {
    console.log('CharacterWizard.init: Setting up global event listeners and initial page.');
    this.pageNavigator.initNavListeners();
    
    // --- FIX: Centralized State Change Listener ---
    // This single listener ensures that both the navigation and informer panel
    // react to any state change in the application, restoring dynamic updates.
    document.addEventListener('wizard:stateChange', () => {
        this.pageNavigator.updateNav();
        this.informerUpdater.update(this.activePageHandler);
    });
    
    this.loadPage(this.pages[0]);
    this.validateLoadedData();
  }

  /**
   * Loads the content and sets up events for a given wizard page.
   */
  async loadPage(page) {
    this.pageNavigator.setCurrentPage(page);

    console.log(`CharacterWizard.loadPage: Loading page: ${page}`);
    const selectorPanel = document.getElementById('selectorPanel');
    const informerPanel = document.getElementById('informerPanel');

    try {
      if (this.activePageHandler && typeof this.activePageHandler.cleanup === 'function') {
        this.activePageHandler.cleanup();
      }

      const selectorHtml = await fetch(`partials/${page}-selector.html`).then(r => r.text());
      selectorPanel.innerHTML = selectorHtml;
      const informerHtml = await fetch(`partials/${page}-informer.html`).then(r => r.text());
      informerPanel.innerHTML = informerHtml;

      const handler = this.pageHandlers[page];
      if (handler) {
        handler.setupPage(selectorPanel, informerPanel);
        this.activePageHandler = handler;
      } else {
        console.warn(`CharacterWizard.loadPage: No handler found for page: ${page}`);
        this.activePageHandler = null;
      }
    } catch (error) {
      console.error(`CharacterWizard.loadPage: Error loading partials for ${page}:`, error);
      alerter.show(`Failed to load page content for ${page}.`, 'error');
    } finally {
      // Manually trigger an update after a page load to ensure the UI is in sync.
      this.pageNavigator.updateNav();
      this.informerUpdater.update(this.activePageHandler);
    }
  }

  /**
   * Validates the loaded game data using the state manager methods.
   */
  validateLoadedData() {
    console.log('CharacterWizard.validateLoadedData: Running initial data validation.');
    const allItems = this.stateManager.getItemData();
    if (!allItems || Object.keys(allItems).length === 0) {
        console.error("Validation Error: No items were loaded into the state manager's item map.");
        return;
    }

    const destinyData = this.stateManager.data.destinies;
    Object.values(destinyData).forEach(destiny => {
      if (destiny.choiceGroups) {
        Object.entries(destiny.choiceGroups).forEach(([groupId, groupDef]) => {
          if (!groupDef.abilities || !Array.isArray(groupDef.abilities)) {
            console.error(`Validation Error: Choice group '${groupId}' in destiny '${destiny.displayName}' is missing a valid 'abilities' array.`);
            return;
          }
          groupDef.abilities.forEach(itemId => {
            if (!allItems[itemId]) {
              console.error(`Validation Error: Missing item definition for ID '${itemId}' (referenced in destiny '${destiny.displayName}', group '${groupId}').`);
            }
          });
        });
      }
    });
    console.log('CharacterWizard.validateLoadedData: Initial data validation complete.');
  }
}

// --- Application Entry Point ---
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof db === 'undefined') {
    console.error("CharacterWizard: Database module 'db' not found. Character saving will fail.");
    alerter.show("Database module not found.", 'error');
    return;
  }

  console.log('CharacterWizard: DOMContentLoaded event fired. Loading game data...');
  try {
    const { moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData } = await loadGameData();
    new CharacterWizard(moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData, db);
  } catch (error) {
    console.error('CharacterWizard: A critical error occurred during data loading:', error);
    alerter.show('Failed to load critical character data. The application cannot start.', 'error');
  }
});
