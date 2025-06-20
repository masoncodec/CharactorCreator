// dataLoader.js
// This module centralizes all asynchronous data loading operations for the game,
// ensuring that abilities, flaws, modules, destinies, and now equipment and loot are loaded once and made available.

/**
 * Loads all necessary game data from JSON files.
 * @returns {Promise<{moduleSystemData: object, flawData: object, destinyData: object, abilityData: object, perkData: object, equipmentAndLootData: object}>}
 * A promise that resolves with an object containing all loaded data.
 */
export async function loadGameData() {
    console.log('dataLoader: Starting to load all game data...');

    const moduleSystemData = {};
    const destinyData = {};
    let flawData = null;
    let abilityData = null;
    let perkData = null;
    let equipmentAndLootData = null; // New variable for equipment and loot data
    let moduleList = null;

    try {
        // 1. Load abilities.json
        console.log('dataLoader: Fetching abilities.json...');
        const abilityResponse = await fetch('data/abilities.json');
        if (!abilityResponse.ok) throw new Error(`HTTP error! status: ${abilityResponse.status} for abilities.json`);
        abilityData = await abilityResponse.json();
        console.log('dataLoader: abilities.json loaded successfully.');

        // 2. Load flaws.json
        console.log('dataLoader: Fetching flaws.json...');
        const flawResponse = await fetch('data/flaws.json');
        if (!flawResponse.ok) throw new Error(`HTTP error! status: ${flawResponse.status} for flaws.json`);
        flawData = await flawResponse.json();
        console.log('dataLoader: flaws.json loaded successfully.');

        // 3. Load perks.json
        console.log('dataLoader: Fetching perks.json...');
        const perkResponse = await fetch('data/perks.json');
        if (!perkResponse.ok) throw new Error(`HTTP error! status: ${perkResponse.status} for perks.json`);
        perkData = await perkResponse.json();
        console.log('dataLoader: perks.json loaded successfully.');

        // 4. Load equipmentAndLoot.json (NEW)
        console.log('dataLoader: Fetching equipmentAndLoot.json...');
        const equipmentAndLootResponse = await fetch('data/equipmentAndLoot.json');
        if (!equipmentAndLootResponse.ok) throw new Error(`HTTP error! status: ${equipmentAndLootResponse.status} for equipmentAndLoot.json`);
        equipmentAndLootData = await equipmentAndLootResponse.json();
        console.log('dataLoader: equipmentAndLoot.json loaded successfully.');

        // 5. Load module_list.json
        console.log('dataLoader: Fetching data/module_list.json...');
        const moduleListResponse = await fetch('data/module_list.json');
        if (!moduleListResponse.ok) throw new Error(`HTTP error! status: ${moduleListResponse.status} for module_list.json`);
        moduleList = await moduleListResponse.json();
        console.log('dataLoader: module_list.json loaded successfully.');

        // 6. Discover and Load all Module and Destiny data dynamically
        console.log('dataLoader: Fetching all module and destiny data...');
        const allFetches = [];

        for (const moduleId of moduleList) {
            allFetches.push(
                (async () => {
                    // Fetch module.json
                    const moduleResponse = await fetch(`data/modules/${moduleId}/module.json`);
                    if (!moduleResponse.ok) throw new Error(`HTTP error! status: ${moduleResponse.status} for module ${moduleId}`);
                    const moduleJson = await moduleResponse.json();
                    moduleSystemData[moduleId] = moduleJson;
                    console.log(`dataLoader: Loaded module: ${moduleId}`);

                    // Fetch associated destinies based on the 'destinies' array in module.json
                    const destiniesInModule = moduleJson.destinies || [];
                    const destinyFetches = destiniesInModule.map(async destinyId => {
                        const destinyResponse = await fetch(`data/modules/${moduleId}/destinies/${destinyId}.json`);
                        if (!destinyResponse.ok) throw new Error(`HTTP error! status: ${destinyResponse.status} for destiny ${destinyId} in module ${moduleId}`);
                        const destinyJson = await destinyResponse.json();
                        destinyData[destinyId] = destinyJson;
                        console.log(`dataLoader: Loaded destiny: ${destinyId} for module ${moduleId}`);
                    });
                    await Promise.all(destinyFetches);
                })()
            );
        }
        await Promise.all(allFetches);
        console.log('dataLoader: All module and destiny data loaded successfully.');

        return { moduleSystemData, flawData, destinyData, abilityData, perkData, equipmentAndLootData };
    } catch (error) {
        console.error('dataLoader: Error loading data:', error);
        throw error; // Re-throw to allow calling code to handle
    }
}
