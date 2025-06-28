// dataLoader.js
// This module centralizes all asynchronous data loading operations for the game.
// It has been refactored to support on-demand loading of module-specific data.

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
 * @param {Object} moduleDef - The module's definition object from module.json.
 * @returns {Promise<Object>} A promise that resolves with all data for that module.
 */
export async function loadDataForModule(moduleDef) {
  console.log(`dataLoader: Loading all data for module '${moduleDef.id}'...`);
  if (!moduleDef || !moduleDef.dataFiles) {
    throw new Error(`Module definition for '${moduleDef.id}' is missing the 'dataFiles' property.`);
  }

  try {
    const dataFilePaths = moduleDef.dataFiles;
    const fetchPromises = {};

    // Create fetch promises for abilities, flaws, perks, and equipment
    for (const key in dataFilePaths) {
      fetchPromises[key] = fetch(dataFilePaths[key]).then(res => res.json());
    }

    // Create fetch promises for all destinies within the module
    const destinyPromises = (moduleDef.destinies || []).map(destinyId =>
      fetch(`data/modules/${moduleDef.id}/destinies/${destinyId}.json`).then(r => r.json())
    );

    // Run all fetches concurrently
    const [
      abilityData,
      flawData,
      perkData,
      equipmentAndLootData,
      destinyResults
    ] = await Promise.all([
      fetchPromises.abilities,
      fetchPromises.flaws,
      fetchPromises.perks,
      fetchPromises.equipmentAndLoot,
      Promise.all(destinyPromises) // Wait for all destinies to load
    ]);

    // Consolidate destiny data into a single object, keyed by destiny ID
    const destinyData = destinyResults.reduce((acc, destiny) => {
      acc[destiny.id] = destiny;
      return acc;
    }, {});

    console.log(`dataLoader: All data for module '${moduleDef.id}' loaded successfully.`);

    // Return a single, structured object
    return {
      abilityData,
      flawData,
      perkData,
      equipmentAndLootData,
      destinyData
    };

  } catch (error) {
    console.error(`dataLoader: A critical error occurred while loading data for module '${moduleDef.id}':`, error);
    throw error;
  }
}