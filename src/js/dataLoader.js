// dataLoader.js
// This module centralizes all asynchronous data loading operations for the game.
// REFACTORED: To intuit data file paths based on the module's ID.

/**
 * Loads the initial list of all available game modules.
 * This runs once when the application first starts.
 * @returns {Promise<Object>} A promise that resolves with the module system data.
 */
export async function loadGameModules() {
  console.log('dataLoader: Starting to load all game modules...');
  try {
    const moduleList = await fetch('data/module_list.json').then(res => res.json());
    const moduleSystemData = {};

    const moduleFetchPromises = moduleList.map(async (moduleId) => {
      const moduleJson = await fetch(`data/modules/${moduleId}/module.json`).then(r => r.json());
      moduleSystemData[moduleId] = moduleJson;
    });

    await Promise.all(moduleFetchPromises);
    console.log('dataLoader: All module definitions loaded successfully.');
    return { moduleSystemData };

  } catch (error) {
    console.error('dataLoader: A critical error occurred while loading module definitions:', error);
    throw error;
  }
}

/**
 * Loads all data files associated with a single, specific module.
 * This is called on-demand when a user selects a module in the wizard.
 * This function now dynamically constructs file paths.
 * @param {Object} moduleDef - The module's definition object from module.json.
 * @returns {Promise<Object>} A promise that resolves with all data for that module.
 */
export async function loadDataForModule(moduleDef) {
  console.log(`dataLoader: Loading all data for module '${moduleDef.id}'...`);
  if (!moduleDef || !moduleDef.id || !moduleDef.dataFiles) {
    throw new Error(`Module definition for '${moduleDef.id}' is missing 'id' or 'dataFiles' properties.`);
  }

  try {
    const dataFileMap = moduleDef.dataFiles;
    const moduleId = moduleDef.id;
    // --- UPDATED: Add new definition types to the array ---
    const dataTypes = [
        "abilities", "flaws", "perks", "equipmentAndLoot", "communities", "relationships",
        "flawsAndPerksDef", "equipmentAndLootDef" // NEW
    ];
    const fetchPromises = {};

    dataTypes.forEach(type => {
      if (dataFileMap[type]) {
        const path = `data/modules/${moduleId}/${dataFileMap[type]}`;
        fetchPromises[type] = fetch(path).then(res => res.json());
      } else {
        fetchPromises[type] = Promise.resolve({});
      }
    });

    const destinyPromises = (moduleDef.destinies || []).map(destinyId =>
      fetch(`data/modules/${moduleId}/destinies/${destinyId}.json`).then(r => r.json())
    );
    const purposePromises = (moduleDef.purposes || []).map(purposeId =>
      fetch(`data/modules/${moduleId}/purposes/${purposeId}.json`).then(r => r.json())
    );
    const nurturePromises = (moduleDef.nurtures || []).map(nurtureId =>
      fetch(`data/modules/${moduleId}/nurtures/${nurtureId}.json`).then(r => r.json())
    );

    // --- UPDATED: Await the new data promises ---
    const [
      abilityData, flawData, perkData, equipmentAndLootData, communityData, relationshipData,
      flawsAndPerksDef, equipmentAndLootDef, // NEW
      destinyResults, purposeResults, nurtureResults
    ] = await Promise.all([
      fetchPromises.abilities, fetchPromises.flaws, fetchPromises.perks, fetchPromises.equipmentAndLoot,
      fetchPromises.communities, fetchPromises.relationships,
      fetchPromises.flawsAndPerksDef, fetchPromises.equipmentAndLootDef, // NEW
      Promise.all(destinyPromises),
      Promise.all(purposePromises),
      Promise.all(nurturePromises)
    ]);

    const destinyData = destinyResults.reduce((acc, destiny) => {
      if (destiny && destiny.id) acc[destiny.id] = destiny;
      return acc;
    }, {});
    const purposeData = purposeResults.reduce((acc, purpose) => {
      if (purpose && purpose.id) acc[purpose.id] = purpose;
      return acc;
    }, {});
    const nurtureData = nurtureResults.reduce((acc, nurture) => {
      if (nurture && nurture.id) acc[nurture.id] = nurture;
      return acc;
    }, {});

    console.log(`dataLoader: All data for module '${moduleId}' loaded successfully.`);

    // --- UPDATED: Return the new data definitions ---
    return {
      abilityData, flawData, perkData, equipmentAndLootData, communityData, relationshipData,
      flawsAndPerksDef, equipmentAndLootDef, // NEW
      destinyData, purposeData, nurtureData
    };

  } catch (error) {
    console.error(`dataLoader: A critical error occurred while loading data for module '${moduleDef.id}':`, error);
    throw error;
  }
}
