// dataLoader.js
// This module centralizes all asynchronous data loading operations for the game.
// It has been refactored to load all data sources concurrently and return them
// in a single, structured object for the WizardStateManager.

/**
 * Loads all necessary game data from their respective JSON files.
 * @returns {Promise<Object>} A promise that resolves with a single 'gameData' object.
 */
export async function loadGameData() {
  console.log('dataLoader: Starting to load all game data...');

  try {
    // 1. Concurrently fetch all primary data files.
    // This is more efficient than fetching them one by one.
    const [
      abilityData,
      flawData,
      perkData,
      equipmentAndLootData,
      moduleList
    ] = await Promise.all([
      fetch('data/abilities.json').then(res => res.json()),
      fetch('data/flaws.json').then(res => res.json()),
      fetch('data/perks.json').then(res => res.json()),
      fetch('data/equipmentAndLoot.json').then(res => res.json()),
      fetch('data/module_list.json').then(res => res.json())
    ]);

    console.log('dataLoader: Core data files (abilities, flaws, perks, etc.) loaded successfully.');

    // 2. Dynamically discover and load all module and destiny data.
    const moduleSystemData = {};
    const destinyData = {};

    const moduleFetchPromises = moduleList.map(async (moduleId) => {
      // Fetch the main module definition file.
      const moduleJson = await fetch(`data/modules/${moduleId}/module.json`).then(r => r.json());
      moduleSystemData[moduleId] = moduleJson;

      // Based on the module definition, fetch all of its associated destinies.
      const destinyFetchPromises = (moduleJson.destinies || []).map(async (destinyId) => {
        const destinyJson = await fetch(`data/modules/${moduleId}/destinies/${destinyId}.json`).then(r => r.json());
        destinyData[destinyId] = destinyJson;
      });

      // Wait for all destinies within this module to load.
      await Promise.all(destinyFetchPromises);
    });

    // Wait for all modules and their respective destinies to finish loading.
    await Promise.all(moduleFetchPromises);
    console.log('dataLoader: All module and destiny data loaded successfully.');

    // 3. Return a single, structured object containing all loaded data.
    // This is the format that the new WizardStateManager and CharacterWizard expect.
    return {
      moduleSystemData,
      destinyData,
      abilityData,
      flawData,
      perkData,
      equipmentAndLootData
    };

  } catch (error) {
    console.error('dataLoader: A critical error occurred while loading game data:', error);
    // Re-throw the error so the main CharacterWizard can catch it and display an alert.
    throw error;
  }
}
