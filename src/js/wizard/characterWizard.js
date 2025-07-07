// characterWizard.js
// This is the main orchestrator for the character creation wizard.
// FINAL CORRECTED VERSION: Includes level-up mode and all state cleanup logic.

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
  constructor(moduleSystemData, db, characterToLoad = null) {
    this.db = db;
    this.stateManager = new WizardStateManager(moduleSystemData);
    
    // --- FIX 1: Always initialize with the full list of pages. ---
    // The filtering logic has been moved out of the constructor.
    this.pages = ['module', 'frame', 'destiny', 'purpose', 'nurture', 'attributes', 'flaws-and-perks', 'equipment-and-loot', 'info'];
    
    // If in level-up mode, just populate the state for now.
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

    // Initialize PageNavigator with the FULL list of pages for now.
    this.pageNavigator = new PageNavigator(this.pages, this.stateManager, this.pageHandlers, {
      loadPage: this.loadPage.bind(this)
    });
    
    const characterId = this.stateManager.get('levelUpCharacterId');
    this.informerUpdater = new InformerUpdater(this.stateManager);
    this.characterFinisher = new CharacterFinisher(this.stateManager, this.db, alerter, EffectHandler, this.pageNavigator, this.pages, characterId);
    this.activePageHandler = null;

    console.log('CharacterWizard: Initializing main wizard application.');
  }

  init() {
    console.log('CharacterWizard.init: Setting up global event listeners and initial page.');
    this.pageNavigator.initNavListeners();
    
    // This listener handles general UI updates for the navigator.
    document.addEventListener('wizard:stateChange', () => {
        this.pageNavigator.updateNav();
    });

    // --- FIX 2: A new, specific listener to filter pages ONLY when the level changes. ---
    document.addEventListener('wizard:stateChange', (event) => {
      // We only run this logic in level-up mode, and only when 'creationLevel' is the key that changed.
      if (this.stateManager.get('isLevelUpMode') && event.detail.key === 'creationLevel') {
        console.log('Creation level changed, re-calculating relevant pages...');
        const relevantPages = this._getRelevantLevelUpPages();
        this.pages = relevantPages;
        this.pageNavigator.setPages(relevantPages);
      }
    });
    
    this.loadPage(this.pages[0]);

    if (this.stateManager.get('isLevelUpMode')) {
      this.pageNavigator.setFinishButtonText('Complete Level Up');
    }
  }
  
  async selectModule(moduleId) {
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

  /**
   * --- NO CHANGE HERE ---
   * This method's logic is correct, it was just being called at the wrong time.
   */
  _getRelevantLevelUpPages() {
    const originalLevel = this.stateManager.get('originalLevel');
    const targetLevel = this.stateManager.get('creationLevel');
    const potentialPages = ['destiny', 'purpose', 'nurture', 'flaws-and-perks', 'equipment-and-loot'];
    
    const relevantPages = potentialPages.filter(pageKey => {
      let mainDefinition;
      if (pageKey === 'flaws-and-perks') {
        mainDefinition = this.stateManager.data.flawsAndPerksDef;
      } else if (pageKey === 'equipment-and-loot') {
        mainDefinition = this.stateManager.data.equipmentAndLootDef;
      } else {
        mainDefinition = this.stateManager.getDefinitionForSource(pageKey);
      }
      
      if (!mainDefinition || !mainDefinition.levels) {
        return false;
      }
      
      return mainDefinition.levels.some(levelData => 
        levelData.level > originalLevel && 
        levelData.level <= targetLevel && 
        levelData.unlocks?.length > 0
      );
    });

    return ['module', ...relevantPages];
  }
}

// --- Application Entry Point ---
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof db === 'undefined') {
    console.error("CharacterWizard: Database module 'db' not found.");
    alerter.show("Database module not found.", 'error');
    return;
  }
  
  const homeButton = document.querySelector('.nav-item--home');
  if (homeButton) {
      homeButton.addEventListener('click', () => {
          console.log('Home button clicked, clearing level-up state.');
          sessionStorage.removeItem('levelUpCharacterId');
      });
  }

  console.log('CharacterWizard: DOMContentLoaded. Checking for mode...');
  
  let characterToLoad = null;
  const characterIdToLoad = sessionStorage.getItem('levelUpCharacterId');

  try {
    const { moduleSystemData } = await loadGameModules();

    if (characterIdToLoad) {
      // --- LEVEL-UP MODE ---
      console.log(`CharacterWizard: Level-Up Mode activated for character ID: ${characterIdToLoad}`);
      characterToLoad = await db.getCharacterById(parseInt(characterIdToLoad));
      
      if (!characterToLoad) throw new Error(`Character with ID ${characterIdToLoad} not found.`);

      const reconstructSelections = (char) => {
          const selections = [];
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

      const moduleDef = moduleSystemData[characterToLoad.module];
      if (!moduleDef) throw new Error(`Module '${characterToLoad.module}' not found for loaded character.`);
      
      const moduleSpecificData = await loadDataForModule(moduleDef);
      
      const wizard = new CharacterWizard(moduleSystemData, db, characterToLoad);
      
      // Load the data into the state manager first.
      wizard.stateManager.loadModuleData(moduleSpecificData);
      
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
    sessionStorage.removeItem('levelUpCharacterId');
  }
});