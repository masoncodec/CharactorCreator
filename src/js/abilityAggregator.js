// js/abilityAggregator.js
// This module provides a centralized function to aggregate abilities from a character and their equipment.

/**
 * Creates a master list of all available abilities from a character and their equipped items.
 * It generates a unique "instancedId" and a top-level "itemType" for each ability.
 * @param {object} character - The character object.
 * @param {object} abilityData - A map of all base ability definitions.
 * @param {object} equipmentData - A map of all equipment definitions.
 * @returns {Array<object>} A combined list of all available abilities.
 */
export function aggregateAllAbilities(character, abilityData, equipmentData) {
    const combinedAbilities = [];

    // Process character's base abilities (no change here)
    if (character && character.abilities) {
        character.abilities.forEach(abilityState => {
            const definition = abilityData[abilityState.id];
            if (definition) {
                combinedAbilities.push({
                    instancedId: `character:${abilityState.id}`,
                    sourceType: 'character',
                    sourceName: 'Innate',
                    itemType: definition.type || 'passive',
                    definition: definition
                });
            }
        });
    }

    // --- NEW, CORRECTED LOGIC FOR EQUIPPED ITEMS ---
    if (character && character.equipmentSlots && equipmentData) {
        const processedMultiSlotInstances = new Set(); // Tracks multi-slot instances we've already handled.

        // Iterate over the equipment slots directly, as this is the source of truth.
        for (const slotId in character.equipmentSlots) {
            const slotValue = character.equipmentSlots[slotId];
            if (!slotValue) continue; // Skip empty slots.

            if (typeof slotValue === 'object' && slotValue.instanceId) {
                // --- It's a multi-slot item ---
                const instanceId = slotValue.instanceId;
                if (processedMultiSlotInstances.has(instanceId)) {
                    // We've already processed this instance (e.g., we saw its main-hand part), so skip.
                    continue; 
                }

                const itemId = slotValue.itemId;
                const itemDef = equipmentData[itemId];
                
                if (itemDef && itemDef.abilities) {
                    // Add abilities for this unique instance.
                    addAbilitiesFromItem(combinedAbilities, itemDef, `equipment:${itemId}:${instanceId}`);
                }
                processedMultiSlotInstances.add(instanceId); // Mark this instance as done.

            } else if (typeof slotValue === 'string') {
                // --- It's a single-slot item ---
                const itemId = slotValue;
                const itemDef = equipmentData[itemId];

                if (itemDef && itemDef.abilities) {
                    // Create a unique ID for this ability instance using the slot it's in.
                    addAbilitiesFromItem(combinedAbilities, itemDef, `equipment:${itemId}:${slotId}`);
                }
            }
        }
    }
    // --- END OF NEW LOGIC ---

    return combinedAbilities;
}

/**
 * A helper function to add all abilities from a given item to the main list.
 * @param {Array} abilityList - The master list of abilities to add to.
 * @param {object} itemDef - The definition of the item providing the abilities.
 * @param {string} uniqueSourceId - A unique identifier for the item instance (e.g., equipment:longsword:instance_123).
 */
function addAbilitiesFromItem(abilityList, itemDef, uniqueSourceId) {
    if (!itemDef.abilities) return;

    const allItemAbilities = [
        ...(itemDef.abilities.passive || []),
        ...(itemDef.abilities.active || [])
    ];

    allItemAbilities.forEach(abilityDef => {
        // Determine if the ability is active or passive from its original definition.
        const itemType = itemDef.abilities.active?.some(a => a.id === abilityDef.id) ? 'active' : 'passive';
        
        abilityList.push({
            instancedId: `${uniqueSourceId}:${abilityDef.id}`,
            sourceType: 'equipment',
            sourceName: itemDef.name,
            itemType: itemType,
            definition: abilityDef
        });
    });
}