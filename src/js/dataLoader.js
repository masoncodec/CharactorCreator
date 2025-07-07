// dataLoader.js
// UPDATED: Now loads the new definition files for refactored pages.

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

export async function loadDataForModule(moduleDef) {
  console.log(`dataLoader: Loading all data for module '${moduleDef.id}'...`);
  if (!moduleDef || !moduleDef.id || !moduleDef.dataFiles) {
    throw new Error(`Module definition for '${moduleDef.id}' is missing 'id' or 'dataFiles' properties.`);
  }

  try {
    const dataFileMap = moduleDef.dataFiles;
    const moduleId = moduleDef.id;
    const dataTypes = [
        "abilities", "flaws", "perks", "equipmentAndLoot", "communities", "relationships",
        "flawsAndPerksDef", "equipmentAndLootDef" // ADDED
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

    const [
      abilityData, flawData, perkData, equipmentAndLootData, communityData, relationshipData,
      flawsAndPerksDef, equipmentAndLootDef, // ADDED
      destinyResults, purposeResults, nurtureResults
    ] = await Promise.all([
      fetchPromises.abilities, fetchPromises.flaws, fetchPromises.perks, fetchPromises.equipmentAndLoot,
      fetchPromises.communities, fetchPromises.relationships,
      fetchPromises.flawsAndPerksDef, fetchPromises.equipmentAndLootDef, // ADDED
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

    return {
      abilityData, flawData, perkData, equipmentAndLootData, communityData, relationshipData,
      flawsAndPerksDef, equipmentAndLootDef, // ADDED
      destinyData, purposeData, nurtureData
    };

  } catch (error) {
    console.error(`dataLoader: A critical error occurred while loading data for module '${moduleDef.id}':`, error);
    throw error;
  }
}