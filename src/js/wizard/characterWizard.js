// characterWizard.js
// This is the main orchestrator for the character creation wizard.
// REFACTORED: Final version with corrected event handling for module selection.

// --- Core Modules ---
import { loadGameModules, loadDataForModule } from '../dataLoader.js';
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
import { PurposePageHandler } from './purposePageHandler.js';
import { NurturePageHandler } from './nurturePageHandler.js';
import { AttributesPageHandler } from './attributesPageHandler.js';
import { FlawsAndPerksPageHandler } from './flawsAndPerksPageHandler.js';
import { EquipmentAndLootPageHandler } from './equipmentAndLootPageHandler.js';
import { InfoPageHandler } from './infoPageHandler.js';

class CharacterWizard {
  constructor(moduleSystemData, db) {
    this.stateManager = new WizardStateManager(moduleSystemData);
    this.pages = ['module', 'frame', 'destiny', 'purpose', 'nurture', 'attributes', 'flaws-and-perks', 'equipment-and-loot', 'info'];
    
    this.pageHandlers = {
      module: new ModulePageHandler(this.stateManager, this.selectModule.bind(this)),
      frame: new FramePageHandler(this.stateManager),
      destiny: new DestinyPageHandler(this.stateManager),
      purpose: new PurposePageHandler(this.stateManager),
      nurture: new NurturePageHandler(this.stateManager),
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
    
    // This is the only global listener needed. It correctly updates the UI
    // whenever the state changes (e.g., module selected, item chosen, etc.).
    document.addEventListener('wizard:stateChange', () => {
        this.pageNavigator.updateNav();
        this.informerUpdater.update(this.activePageHandler);
    });
    
    // ** THE FIX **
    // The 'wizard:dataLoaded' event listener has been removed entirely.
    // It was causing the 'loadPage: undefined' error and was not needed.
    
    this.loadPage(this.pages[0]);
  }
  
  /**
   * Orchestrates the process of selecting a module, loading its data,
   * and updating the state.
   * @param {string} moduleId - The ID of the module to load.
   */
  async selectModule(moduleId) {
    if (!moduleId) return;
    
    console.log(`CharacterWizard: Module selection changed to '${moduleId}'.`);
    // You can add a loading spinner to the UI here

    try {
      // Set the module in the state. This will fire the 'wizard:stateChange'
      // event, which will immediately update the informer panel.
      this.stateManager.setState('module', moduleId);
      
      const moduleDef = this.stateManager.getModule(moduleId);
      const newModuleData = await loadDataForModule(moduleDef);
      
      // Load the new data. This does NOT fire an event anymore.
      this.stateManager.loadModuleData(newModuleData);

    } catch (error) {
      console.error(`CharacterWizard: Failed to load module '${moduleId}'.`, error);
      alerter.show(`Failed to load data for module: ${moduleId}.`, 'error');
      this.stateManager.setState('module', null); // Revert selection on failure
    } finally {
      // Once data is loaded, the 'stateChange' event will fire again (if needed)
      // or the user can just proceed. Let's explicitly update the nav to be sure.
      this.pageNavigator.updateNav();
      // You can remove the loading spinner from the UI here
      console.log(`CharacterWizard: Finished processing module selection.`);
    }
  }

  async loadPage(page) {
    this.pageNavigator.setCurrentPage(page);

    console.log(`CharacterWizard.loadPage: Loading page: ${page}`);
    const selectorPanel = document.getElementById('selectorPanel');
    const informerPanel = document.getElementById('informerPanel');

    try {
      if (page !== 'module' && page !== 'info' && !this.stateManager.get('module')) {
        selectorPanel.innerHTML = `<div class="wizard-panel-placeholder">Please select a game module to continue.</div>`;
        informerPanel.innerHTML = '';
        this.pageNavigator.updateNav();
        return;
      }
      
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
      this.informerUpdater.update(this.activePageHandler);
    }
  }

  validateLoadedData() { /* This validation would now need to run after a module is loaded */ }
}

// --- Application Entry Point ---
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof db === 'undefined') {
    console.error("CharacterWizard: Database module 'db' not found. Character saving will fail.");
    alerter.show("Database module not found.", 'error');
    return;
  }

  console.log('CharacterWizard: DOMContentLoaded event fired. Loading game modules...');
  try {
    const { moduleSystemData } = await loadGameModules();
    new CharacterWizard(moduleSystemData, db);
  } catch (error) {
    console.error('CharacterWizard: A critical error occurred during data loading:', error);
    alerter.show('Failed to load critical module data. The application cannot start.', 'error');
  }
});