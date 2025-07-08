// js/abilityAggregator.js
// This module provides a centralized function to aggregate abilities from a character and their equipment.

/**
 * Creates a master list of all available abilities from a character and their equipped items.
 * It generates a unique "instancedId" and a top-level "itemType" for each ability.
 * @param {object} character - The character object, which must have `abilities` and `inventory` arrays.
 * @param {object} abilityData - A map of all base ability definitions.
 * @param {object} equipmentData - A map of all equipment definitions.
 * @returns {Array<object>} A combined list of all available abilities.
 */
export function aggregateAllAbilities(character, abilityData, equipmentData) {
    const combinedAbilities = [];

    // Process character's base abilities
    if (character && character.abilities) {
        character.abilities.forEach(abilityState => {
            const definition = abilityData[abilityState.id];
            if (definition) {
                combinedAbilities.push({
                    instancedId: `character:${abilityState.id}`,
                    sourceType: 'character',
                    sourceName: 'Innate',
                    itemType: definition.type || 'passive', // Add top-level type from definition
                    definition: definition
                });
            }
        });
    }

    // Process abilities from equipped items
    if (character && character.inventory && equipmentData) {
        character.inventory.forEach(itemState => {
            if (itemState.equipped) {
                const itemDef = equipmentData[itemState.id];
                if (itemDef && itemDef.abilities) {
                    const allItemAbilities = [
                        ...(itemDef.abilities.passive || []),
                        ...(itemDef.abilities.active || [])
                    ];
                    allItemAbilities.forEach(abilityDef => {
                        const itemType = itemDef.abilities.active?.some(a => {
                            // --- ADD THIS LINE FOR DEBUGGING ---
                            console.log(`Comparing item ability ID: '${a.id}' with master list ability ID: '${abilityDef.id}'`);
                            // ------------------------------------
                            return a.id === abilityDef.id;
                        }) ? 'active' : 'passive';
                    
                        // --- AND ADD THIS LINE ---
                        console.log(`Resulting itemType for ${abilityDef.name}: ${itemType}`);
                        
                        combinedAbilities.push({
                            instancedId: `equipment:${itemState.id}:${abilityDef.id}`,
                            sourceType: 'equipment',
                            sourceName: itemDef.name,
                            itemType: itemType, // Add the new top-level property
                            definition: abilityDef // The definition is now the original, unmodified object
                        });
                    });
                }
            }
        });
    }

    return combinedAbilities;
}