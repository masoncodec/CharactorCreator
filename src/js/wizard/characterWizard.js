// characterWizard.js
// This is the main orchestrator for the character creation wizard.
// It imports and initializes all modular components.

// Import shared modules (alerter, EffectHandler, db and dataLoader are external/global)
import { loadGameData } from '../dataLoader.js'; // Assuming dataLoader.js remains
import { alerter } from '../alerter.js';       // Assuming alerter.js remains
import { EffectHandler } from '../effectHandler.js'; // Assuming EffectHandler.js remains

// Import new modular components
import { WizardStateManager } from './wizardStateManager.js';
import { PageNavigator } from './pageNavigator.js';
import { InformerUpdater } from './informerUpdater.js';

// Import page-specific handlers
import { ModulePageHandler } from './modulePageHandler.js';
import { FramePageHandler } from './framePageHandler.js';
import { DestinyPageHandler } from './destinyPageHandler.js';
import { AttributesPageHandler } from './attributesPageHandler.js';
import { FlawsAndPerksPageHandler } from './flawsAndPerksPageHandler.js';
import { EquipmentAndLootPageHandler } from './equipmentAndLootPageHandler.js'; 
import { InfoPageHandler } from './infoPageHandler.js';
import { CharacterFinisher } from './characterFinisher.js';

class CharacterWizard {
  /**
   * @param {Object} moduleSystemData - Loaded data for modules.
   * @param {Object} flawData - Loaded data for flaws.
   * @param {Object} destinyData - Loaded data for destinies.
   * @param {Object} abilityData - Loaded data for abilities.
   * @param {Object} perkData - Loaded data for perks.
   * @param {Object} equipmentAndLootData - Loaded data for equipment and loot.
   * @param {Object} db - The database instance for saving characters.
   */
  constructor(moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData, db) {
    // Initialize the central state manager
    this.stateManager = new WizardStateManager(moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData);

    // Define the pages of the wizard in order
    this.pages = ['module', 'frame', 'destiny', 'attributes', 'flaws-and-perks', 'equipment-and-loot', 'info']; // UPDATED

    // Initialize the navigation component
    this.pageNavigator = new PageNavigator(this.pages, this.stateManager, {
      loadPage: this.loadPage.bind(this) // Pass a method for the navigator to trigger page loading
    });

    // Initialize the informer component
    this.informerUpdater = new InformerUpdater(this.stateManager);

    // Initialize page-specific handlers
    this.pageHandlers = {
      module: new ModulePageHandler(this.stateManager, this.informerUpdater, this.pageNavigator),
      frame: new FramePageHandler(this.stateManager, this.informerUpdater), // NEW
      destiny: new DestinyPageHandler(this.stateManager, this.informerUpdater, this.pageNavigator),
      attributes: new AttributesPageHandler(this.stateManager, this.informerUpdater, this.pageNavigator, alerter),
      'flaws-and-perks': new FlawsAndPerksPageHandler(this.stateManager, this.informerUpdater, this.pageNavigator, alerter),
      'equipment-and-loot': new EquipmentAndLootPageHandler(this.stateManager, this.informerUpdater, this.pageNavigator, alerter),
      info: new InfoPageHandler(this.stateManager, this.informerUpdater, this.pageNavigator)
    };

    // Initialize the character finishing component, now passing pageNavigator and pages
    this.characterFinisher = new CharacterFinisher(this.stateManager, db, alerter, EffectHandler, this.pageNavigator, this.pages);

    // Attach global database reference
    this.db = db;

    // Add a property to keep track of the currently active handler
    this.activePageHandler = null; 

    console.log('CharacterWizard: Initializing main wizard application.');
    this.init();

    // Perform initial data validation (as before)
    this.validateLoadedData();
  }

  init() {
    console.log('CharacterWizard.init: Setting up global event listeners and initial page.');
    // Initialize navigation listeners (prev/next buttons, nav items)
    this.pageNavigator.initNavListeners();
    // Load the first page
    this.loadPage(this.pages[0]);
    console.log(`CharacterWizard.init: Initial page loaded: ${this.pages[0]}`);
  }

  /**
   * Loads the content and sets up events for a given wizard page.
   * This method is called by the PageNavigator.
   * @param {string} page - The name of the page to load.
   */
  async loadPage(page) {
    const currentPageIndex = this.pages.indexOf(page);
    this.pageNavigator.setCurrentPage(currentPageIndex); // Update internal current page index

    console.log(`CharacterWizard.loadPage: Loading page: ${page} (Index: ${currentPageIndex})`);

    const selectorPanel = document.getElementById('selectorPanel');
    const informerPanel = document.getElementById('informerPanel');

    try {
      // Clean up the previous page's handler before loading new content
      if (this.activePageHandler && typeof this.activePageHandler.cleanup === 'function') {
        console.log(`CharacterWizard.loadPage: Cleaning up previous handler for page: ${this.activePageHandler.constructor.name}`);
        this.activePageHandler.cleanup();
      }

      // Fetch and set selector content
      const selectorHtml = await fetch(`partials/${page}-selector.html`).then(r => r.text());
      selectorPanel.innerHTML = selectorHtml;
      console.log(`CharacterWizard.loadPage: Selector panel for ${page} updated.`);

      // Fetch and set informer content
      const informerHtml = await fetch(`partials/${page}-informer.html`).then(r => r.text());
      informerPanel.innerHTML = informerHtml;
      console.log(`CharacterWizard.loadPage: Informer panel for ${page} updated.`);

      // Inform the page handler to set up its specific events and restore state
      const handler = this.pageHandlers[page];
      if (handler) {
        // Pass the container elements so handlers don't need to query them
        handler.setupPage(selectorPanel, informerPanel);
        this.activePageHandler = handler; // Set the new handler as active
      } else {
        console.warn(`CharacterWizard.loadPage: No handler found for page: ${page}`);
        this.activePageHandler = null; // No active handler if none found
      }

    } catch (error) {
      console.error(`CharacterWizard.loadPage: Error loading partials for ${page}:`, error);
      alerter.show(`Failed to load page content for ${page}. Please check the console for details.`, 'error');
    } finally {
      // Always update navigation and informer after page load attempt
      this.pageNavigator.updateNav();
      this.informerUpdater.update(page);
    }
  }

  /**
   * Delegates the final wizard completion to the CharacterFinisher.
   */
  finishWizard() {
    this.characterFinisher.finishWizard();
  }

  /**
   * Validates all loaded game data.
   * This method is crucial for catching missing data in your JSON files early.
   */
  validateLoadedData() {
    console.log('CharacterWizard.validateLoadedData: Running initial data validation.');
    const moduleSystem = this.stateManager.getModuleSystem();
    const destinyData = this.stateManager.getDestinyData();
    const flawData = this.stateManager.getFlawData();
    const abilityData = this.stateManager.getAbilityData();
    const perkData = this.stateManager.getPerkData();
    const equipmentAndLootData = this.stateManager.getEquipmentAndLootData();

    if (!equipmentAndLootData || Object.keys(equipmentAndLootData).length === 0) {
      console.warn('CharacterWizard.validateLoadedData: equipmentAndLootData is empty or missing. Ensure data/equipmentAndLoot.json is populated.');
    } else {
      console.log(`CharacterWizard.validateLoadedData: Loaded ${Object.keys(equipmentAndLootData).length} equipment/loot items.`);
    }

    Object.keys(moduleSystem).forEach(moduleId => {
      const destiniesForModule = moduleSystem[moduleId].destinies || [];
      destiniesForModule.forEach(destinyId => {
        if (!destinyData[destinyId]) {
          console.error(`Missing destiny data for: ${destinyId} (from module ${moduleId})`);
          return;
        }
        
        if (destinyData[destinyId].choiceGroups) {
          Object.entries(destinyData[destinyId].choiceGroups).forEach(([groupId, groupDef]) => {
            if (!groupDef.abilities || !Array.isArray(groupDef.abilities)) {
              console.error(`Choice group '${groupId}' in destiny '${destinyId}' has no 'abilities' array or it's invalid.`);
              return;
            }

            groupDef.abilities.forEach(itemId => {
              let found = false;
              let dataType = '';

              switch (groupId) {
                case 'flaws':
                  found = !!flawData[itemId];
                  dataType = 'flaw';
                  break;
                case 'perks':
                  found = !!perkData[itemId];
                  dataType = 'perk';
                  break;
                case 'equipment':
                  found = !!equipmentAndLootData[itemId];
                  dataType = 'equipment';
                  break;
                default: // This handles all other groups as abilities
                  found = !!abilityData[itemId];
                  dataType = 'ability';
                  break;
              }

              if (!found) {
                console.error(`Missing ${dataType} data: ${itemId} in group '${groupId}' for destiny ${destinyId}`);
              }
            });
          });
        } else {
          console.warn(`Destiny '${destinyId}' has no 'choiceGroups' defined. Ensure this is intentional.`);
        }
      });
    });
    console.log('CharacterWizard.validateLoadedData: Initial data validation complete.');
  }
}

// Initialize CharacterWizard on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  // Ensure db is globally available or passed via dependency injection if preferred
  if (typeof db === 'undefined') {
      console.error("CharacterWizard: Database module 'db' not loaded! Ensure db.js is included before characterWizard.js.");
      alerter.show("Database module not found. Character saving may not work.", 'error');
      // For this example, we'll proceed but character saving will fail.
      return;
  }

  console.log('CharacterWizard: DOMContentLoaded event fired. Loading game data...');

  try {
      const { moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData } = await loadGameData();
      console.log('CharacterWizard: All game data loaded. Initializing CharacterWizard.');
      
      new CharacterWizard(moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData, db);

  } catch (error) {
      console.error('CharacterWizard: Error loading game data:', error);
      alerter.show('Failed to load character data. Please check the console for details.', 'error');
  }
});