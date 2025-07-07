// characterWizard.js
// FINAL VERSION: Includes corrected dynamic page filtering for character creation mode.

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
    
    this.masterPageList = ['module', 'frame', 'destiny', 'purpose', 'nurture', 'attributes', 'flaws-and-perks', 'equipment-and-loot', 'info'];
    this.pages = [...this.masterPageList];
    
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
    
    const characterId = this.stateManager.get('levelUpCharacterId');
    this.informerUpdater = new InformerUpdater(this.stateManager);
    this.characterFinisher = new CharacterFinisher(this.stateManager, this.db, alerter, EffectHandler, this.pageNavigator, this.pages, characterId);
    this.activePageHandler = null;

    console.log('CharacterWizard: Initializing main wizard application.');
  }

  init() {
    console.log('CharacterWizard.init: Setting up global event listeners and initial page.');
    this.pageNavigator.initNavListeners();
    
    document.addEventListener('wizard:stateChange', (event) => {
      const key = event.detail.key;
      if (key === 'creationLevel' || key === 'module') {
        this._updateVisiblePages();
      }
      this.pageNavigator.updateNav();
    });
    
    this.loadPage(this.pages[0]);

    if (this.stateManager.get('isLevelUpMode')) {
      this.pageNavigator.setFinishButtonText('Complete Level Up');
    }
  }

  _updateVisiblePages() {
    let relevantPages = [];
    if (this.stateManager.get('isLevelUpMode')) {
      relevantPages = this._getRelevantLevelUpPages();
    } else {
      relevantPages = this._getRelevantCreationPages();
    }
    this.pages = relevantPages;
    this.pageNavigator.setPages(relevantPages);
  }

  /**
   * --- REWRITTEN: This method now contains the correct filtering logic for creation mode. ---
   */
  _getRelevantCreationPages() {
    const creationLevel = this.stateManager.get('creationLevel');
    // These pages are always visible in creation mode per your rules.
    const staticPages = ['module', 'frame', 'attributes', 'info'];
    // These pages will be checked for level-based content.
    const dynamicPages = ['destiny', 'purpose', 'nurture', 'flaws-and-perks', 'equipment-and-loot'];

    const relevantDynamicPages = dynamicPages.filter(pageKey => {
      let definitionsToCheck = [];

      // Collect the definitions that need to be checked for this page key.
      if (pageKey === 'flaws-and-perks') {
        definitionsToCheck.push(this.stateManager.data.flawsAndPerksDef);
      } else if (pageKey === 'equipment-and-loot') {
        definitionsToCheck.push(this.stateManager.data.equipmentAndLootDef);
      } else {
        // --- START OF FIX ---
        // This mapping corrects the 'destiny' vs 'destinies' typo and makes the code more robust.
        const pluralMap = {
          destiny: 'destinies',
          purpose: 'purposes',
          nurture: 'nurtures'
        };
        const dataKey = pluralMap[pageKey];
        const dataSet = this.stateManager.data[dataKey];
        // --- END OF FIX ---
        
        if (dataSet) {
          definitionsToCheck = Object.values(dataSet);
        }
      }
      
      if (definitionsToCheck.length === 0 || definitionsToCheck.every(d => d === undefined)) {
        return false;
      }

      // A page is relevant if ANY of its possible definitions meet the criteria.
      return definitionsToCheck.some(definition => {
        if (!definition || !definition.levels || definition.levels.length === 0) {
          return true; // Per your rule, show if no level data exists.
        }
        // A definition is relevant if it has any unlocks AT OR BELOW the current creationLevel.
        return definition.levels.some(levelData => 
          levelData.level <= creationLevel && 
          levelData.unlocks?.length > 0
        );
      });
    });

    const finalPages = [...staticPages, ...relevantDynamicPages];
    // Re-sort the final list to match the original intended order.
    finalPages.sort((a, b) => this.masterPageList.indexOf(a) - this.masterPageList.indexOf(b));

    return finalPages;
  }

  // --- No changes to the methods below this point ---

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

// Application Entry Point
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof db === 'undefined') {
    console.error("CharacterWizard: Database module 'db' not found.");
    alerter.show("Database module not found.", 'error');
    return;
  }
  
  const homeButton = document.querySelector('.nav-item--home');
  if (homeButton) {
      homeButton.addEventListener('click', () => {
          sessionStorage.removeItem('levelUpCharacterId');
      });
  }

  let characterToLoad = null;
  const characterIdToLoad = sessionStorage.getItem('levelUpCharacterId');

  try {
    const { moduleSystemData } = await loadGameModules();

    if (characterIdToLoad) {
      // LEVEL-UP MODE
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
          return selections;
      };
      characterToLoad.selections = reconstructSelections(characterToLoad);
      const moduleDef = moduleSystemData[characterToLoad.module];
      if (!moduleDef) throw new Error(`Module '${characterToLoad.module}' not found for loaded character.`);
      const moduleSpecificData = await loadDataForModule(moduleDef);
      const wizard = new CharacterWizard(moduleSystemData, db, characterToLoad);
      wizard.stateManager.loadModuleData(moduleSpecificData);
      wizard.init();
    } else {
      // CREATION MODE
      const wizard = new CharacterWizard(moduleSystemData, db);
      wizard.init();
    }
  } catch (error) {
    console.error('CharacterWizard: A critical error occurred during initialization:', error);
    alerter.show(`Failed to load critical data: ${error.message}. The application cannot start.`, 'error');
    sessionStorage.removeItem('levelUpCharacterId');
  }
});