// characterWizard.js
// This is the main orchestrator for the character creation wizard.
// This version is fully refactored to work with the new modular components.

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
  /**
   * REFACTORED: The constructor now accepts the separate data arguments
   * exactly as they are passed from the DOMContentLoaded event listener.
   */
  constructor(moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData, db) {
    // 1. Initialize the central state manager.
    // It is passed the separate data arguments and will unify them internally.
    this.stateManager = new WizardStateManager(moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData);

    // 2. Define the pages of the wizard in their correct order.
    this.pages = ['module', 'frame', 'destiny', 'attributes', 'flaws-and-perks', 'equipment-and-loot', 'info'];

    // 3. Initialize the navigation component.
    this.pageNavigator = new PageNavigator(this.pages, this.stateManager, {
      loadPage: this.loadPage.bind(this)
    });

    // 4. Initialize the informer panel updater.
    this.informerUpdater = new InformerUpdater(this.stateManager);

    // 5. Instantiate all page-specific handlers.
    this.pageHandlers = {
      module: new ModulePageHandler(this.stateManager, this.informerUpdater, this.pageNavigator),
      frame: new FramePageHandler(this.stateManager, this.informerUpdater),
      destiny: new DestinyPageHandler(this.stateManager, this.informerUpdater, this.pageNavigator),
      attributes: new AttributesPageHandler(this.stateManager, this.informerUpdater, this.pageNavigator, alerter),
      'flaws-and-perks': new FlawsAndPerksPageHandler(this.stateManager, this.informerUpdater, this.pageNavigator),
      'equipment-and-loot': new EquipmentAndLootPageHandler(this.stateManager, this.informerUpdater, this.pageNavigator, alerter),
      info: new InfoPageHandler(this.stateManager, this.informerUpdater, this.pageNavigator)
    };

    // 6. Initialize the character finishing component.
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
    this.loadPage(this.pages[0]);
    
    // IMPORTANT FIX: Validate data AFTER the initial components are set up.
    // This ensures the state manager is fully ready before we check its contents.
    this.validateLoadedData();
  }

  /**
   * Loads the content and sets up events for a given wizard page.
   */
  async loadPage(page) {
    const currentPageIndex = this.pages.indexOf(page);
    this.pageNavigator.setCurrentPage(currentPageIndex);

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
      this.pageNavigator.updateNav();
      this.informerUpdater.update(page);
    }
  }

  /**
   * REFACTORED: Validates the loaded game data using the new state manager methods.
   */
  validateLoadedData() {
    console.log('CharacterWizard.validateLoadedData: Running initial data validation.');
    
    // This now uses the single, unified item map from the state manager.
    const allItems = this.stateManager.getItemData();
    
    if (!allItems || Object.keys(allItems).length === 0) {
        console.error("Validation Error: No items were loaded into the state manager's item map.");
        return; // Stop validation if the map is empty.
    }

    // Check that all items referenced in destiny choice groups actually exist in the master item map.
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
    // dataLoader returns an object with all the data collections.
    const { moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData } = await loadGameData();
    
    // ENHANCED LOGGING: Let's see the data right after it's loaded.
    console.log("Data successfully loaded by dataLoader:", { moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData });
    
    // Pass the separate data collections to the CharacterWizard constructor.
    // The wizard will then pass these to the state manager, which will process them correctly.
    new CharacterWizard(moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData, db);
    
  } catch (error) {
    console.error('CharacterWizard: A critical error occurred during data loading:', error);
    alerter.show('Failed to load critical character data. The application cannot start.', 'error');
  }
});
