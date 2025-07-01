// characterWizard.js
// This is the main orchestrator for the character creation wizard.
// UPDATED: Now supports a "creation mode" and a "level-up mode".

// --- Core Modules ---
import { loadGameModules, loadDataForModule } from '../dataLoader.js';
import { alerter } from '../alerter.js';
import { EffectHandler } from '../effectHandler.js';

// --- Architectural Components ---
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
  /**
   * --- UPDATED: The constructor now accepts an optional character object to load. ---
   */
  constructor(moduleSystemData, db, characterToLoad = null) {
    this.db = db;
    this.stateManager = new WizardStateManager(moduleSystemData);
    this.pages = ['module', 'frame', 'destiny', 'purpose', 'nurture', 'attributes', 'flaws-and-perks', 'equipment-and-loot', 'info'];
    
    // If a character is passed in, populate the state immediately.
    if (characterToLoad) {
      this.stateManager.populateFromCharacter(characterToLoad, characterToLoad.id);
    }

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
    
    // Pass the character's ID to the finisher if in level-up mode.
    const characterId = this.stateManager.get('levelUpCharacterId');
    this.informerUpdater = new InformerUpdater(this.stateManager);
    this.characterFinisher = new CharacterFinisher(this.stateManager, this.db, alerter, EffectHandler, this.pageNavigator, this.pages, characterId);
    this.activePageHandler = null;

    console.log('CharacterWizard: Initializing main wizard application.');
  }

  /**
   * Sets up global event listeners and loads the initial page.
   */
  init() {
    console.log('CharacterWizard.init: Setting up global event listeners and initial page.');
    this.pageNavigator.initNavListeners();
    
    document.addEventListener('wizard:stateChange', () => {
        this.pageNavigator.updateNav();
        this.informerUpdater.update(this.activePageHandler);
    });
    
    this.loadPage(this.pages[0]);

    // If in level up mode, set the button text.
    if (this.stateManager.get('isLevelUpMode')) {
      this.pageNavigator.setFinishButtonText('Complete Level Up');
    }
  }
  
  async selectModule(moduleId) {
    // This logic doesn't need to change, but it will only be callable in creation mode.
    if (!moduleId || this.stateManager.get('isLevelUpMode')) return;
    
    console.log(`CharacterWizard: Module selection changed to '${moduleId}'.`);
    try {
      this.stateManager.setState('module', moduleId);
      
      const moduleDef = this.stateManager.getModule(moduleId);
      const newModuleData = await loadDataForModule(moduleDef);
      
      this.stateManager.loadModuleData(newModuleData);

    } catch (error) {
      console.error(`CharacterWizard: Failed to load module '${moduleId}'.`, error);
      alerter.show(`Failed to load data for module: ${moduleId}.`, 'error');
      this.stateManager.setState('module', null);
    } finally {
      this.pageNavigator.updateNav();
      console.log(`CharacterWizard: Finished processing module selection.`);
    }
  }

  async loadPage(page) {
    this.pageNavigator.setCurrentPage(page);

    console.log(`CharacterWizard.loadPage: Loading page: ${page}`);
    const selectorPanel = document.getElementById('selectorPanel');
    const informerPanel = document.getElementById('informerPanel');

    try {
      // In creation mode, if module isn't selected, show placeholder. This is now safe.
      if (!this.stateManager.get('isLevelUpMode') && page !== 'module' && page !== 'info' && !this.stateManager.get('module')) {
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
}

// --- RESTRUCTURED: Application Entry Point ---
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof db === 'undefined') {
    console.error("CharacterWizard: Database module 'db' not found.");
    alerter.show("Database module not found.", 'error');
    return;
  }
  
  // Add listener to home link to clean up session storage
  const homeLink = document.querySelector('.home-link'); // Assumes a .home-link exists on the wizard page
   if (homeLink) {
       homeLink.addEventListener('click', () => {
           sessionStorage.removeItem('levelUpCharacterId');
       });
   }

  console.log('CharacterWizard: DOMContentLoaded. Checking for mode...');
  
  let characterToLoad = null;
  const characterIdToLoad = sessionStorage.getItem('levelUpCharacterId');

  try {
    // Always load the base module definitions
    const { moduleSystemData } = await loadGameModules();

    if (characterIdToLoad) {
      // --- LEVEL-UP MODE ---
      console.log(`CharacterWizard: Level-Up Mode activated for character ID: ${characterIdToLoad}`);
      characterToLoad = await db.getCharacterById(parseInt(characterIdToLoad));
      
      if (!characterToLoad) throw new Error(`Character with ID ${characterIdToLoad} not found.`);
  
      // --- NEW: Reconstruct the selections array from categorized lists ---
      const reconstructSelections = (char) => {
          const selections = [];
          // These are the arrays on your saved character object that hold selection data
          const sources = ['abilities', 'perks', 'flaws', 'communities', 'relationships'];
          sources.forEach(sourceKey => {
              if (char[sourceKey] && Array.isArray(char[sourceKey])) {
                  selections.push(...char[sourceKey]);
              }
          });
          console.log(`Reconstructed ${selections.length} selections for level-up process.`);
          return selections;
      };
      characterToLoad.selections = reconstructSelections(characterToLoad);

      // For level-up, we must also load the specific module data associated with that character
      const moduleDef = moduleSystemData[characterToLoad.module];
      if (!moduleDef) throw new Error(`Module '${characterToLoad.module}' not found for loaded character.`);
      
      const moduleSpecificData = await loadDataForModule(moduleDef);
      
      // Manually attach the module-specific data to the state manager's data object before initializing
      // This is a bit of a workaround to ensure the data is there before the state manager is populated.
      const tempStateManager = new WizardStateManager(moduleSystemData);
      tempStateManager.loadModuleData(moduleSpecificData);
      
      // Now, initialize the wizard, passing in the loaded character and pre-loaded data
      const wizard = new CharacterWizard(moduleSystemData, db, characterToLoad);
      wizard.stateManager.data = tempStateManager.data; // Overwrite data with fully loaded set
      wizard.init();

    } else {
      // --- CREATION MODE ---
      console.log("CharacterWizard: Creation Mode activated.");
      const wizard = new CharacterWizard(moduleSystemData, db);
      wizard.init();
    }

  } catch (error) {
    console.error('CharacterWizard: A critical error occurred during initialization:', error);
    alerter.show(`Failed to load critical data: ${error.message}. The application cannot start.`, 'error');
    sessionStorage.removeItem('levelUpCharacterId'); // Clean up on failure
  }
});