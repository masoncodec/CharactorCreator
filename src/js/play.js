// play.js (Corrected and Final)
import { EffectHandler } from './effectHandler.js';
import { loadGameModules, loadDataForModule } from './dataLoader.js';
import { alerter } from './alerter.js';
import { RollManager } from './RollManager.js';
import { renderTopNav, renderMainTab, renderAbilitiesTab, renderProfileTab, renderInventoryTab, renderEquipmentTab, renderSummonsPanel, EQUIPMENT_SLOT_CONFIG, getEquippedCount, findTargetSlots } from './play-ui.js';
import { aggregateAllAbilities } from './abilityAggregator.js';

// --- Global variables ---
let moduleDefinitions = {}, abilityData = {}, flawData = {}, perkData = {};
let equipmentData = {}, activeAbilityStates = new Set(), activeCharacter = null;
let bestiaryData = {}, activeLayout = {};
let mainEffectHandler;


/**
 * Main function to process a character's data and render the entire layout.
 */
async function processAndRenderAll(character) {
    if (!character) {
        document.querySelector('.play-content-scrollable').innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
        return;
    }

    // --- LOGIC ORDER ---
    
    // 1. Instantiate handler and process all active effects from abilities, perks, etc.
    mainEffectHandler = new EffectHandler();
    const allAbilities = aggregateAllAbilities(character, abilityData, equipmentData);
    mainEffectHandler.processActiveAbilities(allAbilities, character, flawData, perkData, activeAbilityStates, 'play');
    
    // 2. Reconcile summons based on active effects (removes summons whose source is gone).
    const validSummonSourceIds = new Set(
        mainEffectHandler.activeEffects.filter(e => e.type === 'summon_creature').map(e => e.itemId)
    );
    if (character.summonedCreatures && character.summonedCreatures.length > 0) {
        character.summonedCreatures = character.summonedCreatures.filter(summon =>
            validSummonSourceIds.has(summon.source.id)
        );
    }

    // 3. Generate dynamic equipment layout based on effects.
    const layoutEffects = mainEffectHandler.processLayoutEffects(mainEffectHandler.activeEffects);
    const { layoutConfig, slotMap } = generateCharacterLayout(character, layoutEffects);

    // 4. Reconcile equipped items against the new layout. This returns the most up-to-date character object.
    const reconciledCharacter = await reconcileEquipmentSlots(character, slotMap);

    // 5. DYNAMIC HEALTH LOGIC NOW RUNS *AFTER* RECONCILIATION
    const previousMaxHealthBonus = reconciledCharacter.lastMaxHealthBonus ?? 0;
    const newMaxHealthBonus = mainEffectHandler.activeEffects
        .filter(effect => {
            if (effect.type !== 'max_health_mod') return false;
            const isPassiveEffect = effect.itemType === 'passive';
            if (effect.itemType === 'active' || (isPassiveEffect && (effect.sourceType === 'equipment' || effect.sourceType === 'perk' || effect.sourceType === 'flaw'))) {
                return true;
            }
            return false;
        })
        .reduce((sum, effect) => sum + effect.value, 0);
    
    const bonusChange = newMaxHealthBonus - previousMaxHealthBonus;

    if (bonusChange !== 0) {
        const newCurrentHealth = (reconciledCharacter.health.current ?? 0) + bonusChange;
        reconciledCharacter.health.current = Math.max(0, newCurrentHealth);
        console.log(`Max health bonus changed by ${bonusChange}. New current health: ${reconciledCharacter.health.current}`);
    }
    reconciledCharacter.lastMaxHealthBonus = newMaxHealthBonus;

    // 6. Apply all other effects (stat mods, etc.) to the reconciled character.
    const effectedCharacter = mainEffectHandler.applyEffectsToCharacter(reconciledCharacter, 'play', activeAbilityStates, bestiaryData);

    // 7. Store the generated layout globally so event handlers can access it.
    activeLayout = { layoutConfig, slotMap };

    // --- FINAL STATE UPDATE ---
    // This copies all dynamically calculated properties from the final `effectedCharacter`
    // back to the main `character` object, ensuring the state is consistent for the next interaction.
    character.health.current = effectedCharacter.health.current;
    character.lastMaxHealthBonus = effectedCharacter.lastMaxHealthBonus;
    character.calculatedHealth = effectedCharacter.calculatedHealth;
    character.languages = effectedCharacter.languages;
    character.activeRollEffects = effectedCharacter.activeRollEffects;
    character.temporaryBuffs = effectedCharacter.temporaryBuffs;
    character.summonedCreatures = effectedCharacter.summonedCreatures;
    character.statuses = effectedCharacter.statuses;
    character.resources = effectedCharacter.resources;
    character.resistances = effectedCharacter.resistances;
    character.movement = effectedCharacter.movement;

    const equipmentItems = effectedCharacter.inventory
        .map(item => {
            const definition = equipmentData[item.id];
            if (!definition || definition.type !== 'equipment') return null;
            const fullItemData = { ...item, definition };
            if (item.quantity > 1) {
                fullItemData.equippedCount = getEquippedCount(item.id, effectedCharacter, equipmentData, layoutConfig);
            }
            return fullItemData;
        })
        .filter(Boolean);
        
    // --- RENDER EVERYTHING ---
    renderTopNav(effectedCharacter, moduleDefinitions);
    renderMainTab(effectedCharacter, moduleDefinitions, mainEffectHandler);
    renderAbilitiesTab(allAbilities, effectedCharacter);
    renderProfileTab(effectedCharacter, flawData, perkData);
    renderInventoryTab(effectedCharacter, equipmentData, layoutConfig, slotMap);
    renderEquipmentTab(equipmentItems, effectedCharacter.equipmentSlots, equipmentData, effectedCharacter, layoutConfig, slotMap);
    renderSummonsPanel(effectedCharacter.summonedCreatures, bestiaryData);
}

/**
 * Creates a map of slot types to their unique instance IDs based on a layout config.
 */
function generateSlotMap(config) {
    const slotMap = {};
    for (const categoryName in config.categories) {
        const slotTypes = config.categories[categoryName];
        slotTypes.forEach(slotType => {
            if (!slotMap[slotType]) {
                slotMap[slotType] = [];
            }
            const instanceNumber = slotMap[slotType].length + 1;
            slotMap[slotType].push(`${slotType}_${instanceNumber}`);
        });
    }
    return slotMap;
}

/**
 * Generates the final equipment slot configuration and map for a character by applying layout effects.
 * UPDATED: Now receives the layout summary as a parameter instead of calculating it internally.
 * @param {object} character - The character object.
 * @param {object} layoutSummary - The pre-processed summary of layout changes from the EffectHandler.
 * @returns {object} An object containing the final layoutConfig and slotMap.
 */
function generateCharacterLayout(character, layoutSummary) {
    // 1. The summary is now passed in directly.
    
    // 2. Start with a deep copy of the base configuration.
    const finalConfig = JSON.parse(JSON.stringify(EQUIPMENT_SLOT_CONFIG));

    // 3. Apply the summary to the config copy (logic is unchanged).
    for (const key in layoutSummary.categoriesToAdd) {
        if (!finalConfig.categories[key]) {
            finalConfig.categories[key] = [];
        }
        finalConfig.categories[key].push(...layoutSummary.categoriesToAdd[key].slots);
    }
    for (const key in layoutSummary.slotMods) {
        const [categoryKey, slotKey] = key.split('_');
        const value = layoutSummary.slotMods[key];
        if (value > 0 && finalConfig.categories[categoryKey]) {
            for (let i = 0; i < value; i++) {
                finalConfig.categories[categoryKey].push(slotKey);
            }
        }
    }
    layoutSummary.categoriesToRemove.forEach(categoryKey => {
        delete finalConfig.categories[categoryKey];
    });
    for (const key in layoutSummary.slotMods) {
        const [categoryKey, slotKey] = key.split('_');
        const value = layoutSummary.slotMods[key];
        if (value < 0 && finalConfig.categories[categoryKey]) {
            for (let i = 0; i < Math.abs(value); i++) {
                const indexToRemove = finalConfig.categories[categoryKey].indexOf(slotKey);
                if (indexToRemove > -1) {
                    finalConfig.categories[categoryKey].splice(indexToRemove, 1);
                }
            }
        }
    }
    for (const categoryKey in finalConfig.categories) {
        if (finalConfig.categories[categoryKey].length === 0) {
            delete finalConfig.categories[categoryKey];
        }
    }

    // 4. Generate the final slot map from the fully modified config.
    const finalSlotMap = generateSlotMap(finalConfig);

    return { layoutConfig: finalConfig, slotMap: finalSlotMap };
}

/**
 * Compares a character's equipment against a definitive layout.
 */
async function reconcileEquipmentSlots(character, finalSlotMap) {
    let characterNeedsUpdate = false;
    let newInventory = [...character.inventory];
    const orderedValidSlotIds = Object.values(finalSlotMap).flat();
    const newSortedSlots = {};
    for (const slotId of orderedValidSlotIds) {
        if (character.equipmentSlots.hasOwnProperty(slotId)) {
            newSortedSlots[slotId] = character.equipmentSlots[slotId];
        } else {
            newSortedSlots[slotId] = null;
            characterNeedsUpdate = true;
        }
    }
    for (const originalSlotId in character.equipmentSlots) {
        if (!newSortedSlots.hasOwnProperty(originalSlotId)) {
            const itemIdToUnequip = character.equipmentSlots[originalSlotId];
            if (itemIdToUnequip) {
                console.warn(`Reconciling: Invalid slot '${originalSlotId}' found. Unequipping '${itemIdToUnequip}'.`);
                characterNeedsUpdate = true;
                newInventory = newInventory.map(item =>
                    item.id === itemIdToUnequip ? { ...item, equipped: false } : item
                );
            }
        }
    }
    if (characterNeedsUpdate) {
        return await db.updateCharacter(character.id, { inventory: newInventory, equipmentSlots: newSortedSlots });
    } else {
        return character;
    }
}

/**
 * Helper function to update the display for a KOB attribute roll.
 */
function updateAttributeRollDisplay(row, baseResult, modifiedResult, activeModifiers) {
    let resultEl = row.querySelector('.roll-result');
    resultEl.textContent = modifiedResult;
    resultEl.classList.add('visible');
    setTimeout(() => resultEl.classList.remove('visible', 'fade-out'), 2500);
    setTimeout(() => resultEl.classList.add('fade-out'), 2000);
    let unmodifiedResultEl = row.querySelector('.unmodified-roll-result');
    if (activeModifiers.length > 0) {
        unmodifiedResultEl.textContent = baseResult;
        unmodifiedResultEl.classList.remove('empty-unmodified-cell');
        unmodifiedResultEl.classList.add('visible');
        setTimeout(() => unmodifiedResultEl.classList.remove('visible', 'fade-out'), 2500);
        setTimeout(() => unmodifiedResultEl.classList.add('fade-out'), 2000);
    }
}

/**
 * Master function to handle all item equip actions with priority-based logic.
 * @param {string} itemId The ID of the item to equip.
 */
async function handleEquip(itemId) {
    if (!activeCharacter || !itemId) return;
    const { layoutConfig, slotMap } = activeLayout;
    const itemDef = equipmentData[itemId];
    const itemInInventory = activeCharacter.inventory.find(i => i.id === itemId);
    const equippedCount = getEquippedCount(itemId, activeCharacter, equipmentData, layoutConfig);

    // This check now works correctly for both standard and combined items.
    if (!itemInInventory || itemInInventory.quantity <= equippedCount) {
        return alerter.show('No unequipped instances of this item are available.', 'warn');
    }

    const targetSlots = findTargetSlots(itemDef, activeCharacter.equipmentSlots, itemId, layoutConfig, slotMap, equipmentData);

    if (targetSlots.length === 0) {
        return alerter.show('All available slots are already filled with this item.', 'warn');
    }

    let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
    let newInventory = [...activeCharacter.inventory];

    // Unequip whatever is in the target slots first.
    targetSlots.forEach(slotId => {
        const itemToReplace = newEquipmentSlots[slotId];
        if (itemToReplace) {
            // Unequip logic must now handle both strings and objects
            const idToUnequip = typeof itemToReplace === 'object' ? itemToReplace.itemId : itemToReplace;
            const instanceToUnequip = typeof itemToReplace === 'object' ? itemToReplace.instanceId : null;

            if (instanceToUnequip) {
                // If replacing a combined item, remove all parts of that instance.
                for (const sId in newEquipmentSlots) {
                    if (newEquipmentSlots[sId]?.instanceId === instanceToUnequip) {
                        newEquipmentSlots[sId] = null;
                    }
                }
            } else {
                 newEquipmentSlots[slotId] = null;
            }
            
            // Update inventory status after checking if it's equipped elsewhere
            const isStillEquipped = Object.values(newEquipmentSlots).some(v => (v && v.itemId === idToUnequip) || v === idToUnequip);
            if(!isStillEquipped){
                 newInventory = newInventory.map(item => item.id === idToUnequip ? { ...item, equipped: false } : item);
            }
        }
    });

    // Now, equip the new item.
    if (layoutConfig.combined_slots[itemDef.equip_slot]) {
        // For combined items, create the new data structure with a unique instanceId.
        const instanceId = `${itemId}_instance_${Date.now()}`;
        targetSlots.forEach(slotId => {
            newEquipmentSlots[slotId] = { itemId: itemId, instanceId: instanceId };
        });
    } else {
        // For standard items, just place the ID string.
        targetSlots.forEach(slotId => {
            newEquipmentSlots[slotId] = itemId;
        });
    }

    // Update the inventory status of the item being equipped.
    newInventory = newInventory.map(item => item.id === itemId ? { ...item, equipped: true } : item);

    try {
        activeCharacter = await db.updateCharacter(activeCharacter.id, { inventory: newInventory, equipmentSlots: newEquipmentSlots });
        processAndRenderAll(activeCharacter);
    } catch (err) {
        console.error('Failed to equip item:', err);
        alerter.show('Failed to equip item.', 'error');
    }
}

/**
 * Reusable async function to handle all unequip actions.
 * @param {string} itemIdToUnequip The ID of the item to unequip.
 */
async function handleUnequip(itemIdToUnequip) {
    if (!activeCharacter || !itemIdToUnequip) return;
    let newEquipmentSlots = { ...activeCharacter.equipmentSlots };

    // Find all slots that hold this item ID, whether as a string or in an object.
    for (const slotId in newEquipmentSlots) {
        const slotValue = newEquipmentSlots[slotId];
        const idInSlot = slotValue?.itemId || slotValue;
        if (idInSlot === itemIdToUnequip) {
            newEquipmentSlots[slotId] = null;
        }
    }
    
    const newInventory = activeCharacter.inventory.map(item =>
        item.id === itemIdToUnequip ? { ...item, equipped: false } : item
    );

    // Before saving, check if the unequipped item is in the dismissed list.
    if (character.dismissedPassiveSources && character.dismissedPassiveSources.includes(itemIdToUnequip)) {
        console.log(`Resetting dismissal for source: ${itemIdToUnequip}`);
        // If it is, filter it out. This allows it to be summoned again if re-equipped.
        character.dismissedPassiveSources = character.dismissedPassiveSources.filter(id => id !== itemIdToUnequip);
    }

    try {
        activeCharacter = await db.updateCharacter(activeCharacter.id, { inventory: newInventory, equipmentSlots: newEquipmentSlots });
        processAndRenderAll(activeCharacter);
    } catch (err) { console.error('Failed to unequip item:', err); alerter.show('Failed to unequip item.', 'error'); }
}

/**
 * Initializes the page on load: loads data, sets up listeners.
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // --- DATA LOADING ---
        const { moduleSystemData } = await loadGameModules();
        moduleDefinitions = moduleSystemData;
        activeCharacter = await db.getActiveCharacter();
        if (activeCharacter) {
            const moduleDef = moduleDefinitions[activeCharacter.module];
            const moduleSpecificData = await loadDataForModule(moduleDef);
            abilityData = moduleSpecificData.abilityData || {};
            flawData = moduleSpecificData.flawData || {};
            perkData = moduleSpecificData.perkData || {};
            equipmentData = moduleSpecificData.equipmentAndLootData || {};
            bestiaryData = moduleSpecificData.bestiaryData || {};
            processAndRenderAll(activeCharacter);
        } else {
            document.querySelector('.play-content-scrollable').innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
        }

        // --- SINGLE EVENT LISTENER FOR ALL DYNAMIC ACTIONS ---
        const contentArea = document.querySelector('.play-content-scrollable');
        contentArea.addEventListener('click', async (event) => {
            if (!activeCharacter) return;
            const target = event.target;



            // --- NEW: HANDLER FOR A SUMMON'S ABILITY ACTION ---
            const actionButton = target.closest('.btn-action');
            if (actionButton) {
                const instanceId = actionButton.dataset.instanceId;
                const abilityId = actionButton.dataset.abilityId;

                const summonInstance = activeCharacter.summonedCreatures.find(s => s.instanceId === instanceId);
                if (!summonInstance) return;

                const summonDef = bestiaryData[summonInstance.creatureId];
                if (!summonDef || !summonDef.abilities) return;

                const abilityDef = summonDef.abilities.active?.find(a => a.id === abilityId);
                if (!abilityDef || !abilityDef.effect) return;

                const attackEffect = abilityDef.effect.find(e => e.type === 'attack');
                if (!attackEffect) return; // Only handle attack effects for now

                // --- Build the Roll Definition ---
                const rollDefinitions = [];

                // 1. Create the Attack Roll Group
                const attackAttr = attackEffect.attribute_bonus;
                const baseValue = summonDef.attributes[attackAttr] || 0;
                
                // Create a temporary effect handler for the summon to calculate its own modifiers
                const summonEffectHandler = new EffectHandler();
                summonEffectHandler.processActiveAbilities(
                    (summonDef.abilities.passive || []).map(p => ({ definition: p, itemType: 'passive' })), // Simulate ability structure
                    summonDef, {}, {}, new Set(), 'play'
                );
                const numericalEffects = summonEffectHandler.getEffectsForAttribute(attackAttr, 'modifier');
                const diceNumEffects = summonEffectHandler.getEffectsForAttribute(attackAttr, 'die_num');
                const combinedValue = summonEffectHandler.getCombinedAttributeValue(attackAttr, baseValue);

                rollDefinitions.push({
                    groupType: 'hope_fear',
                    label: `${abilityDef.name} - Attack Roll`,
                    attributeName: attackAttr,
                    baseValue: baseValue,
                    modifierData: {
                        combinedValue: combinedValue,
                        totalNumerical: numericalEffects.reduce((sum, eff) => sum + (eff.modifier || 0), 0),
                        totalDiceNum: diceNumEffects.reduce((sum, eff) => sum + (eff.modifier || 0), 0),
                        sources: [...numericalEffects, ...diceNumEffects]
                    }
                });
                
                // 2. Create the Damage Roll Group
                if (attackEffect.damage && attackEffect.damage.length > 0) {
                    rollDefinitions.push({
                        groupType: 'damage',
                        label: 'Damage',
                        rolls: attackEffect.damage.map(d => ({
                            label: d.type,
                            dice: d.dice,
                            baseValue: d.value || 0
                        }))
                    });
                }

                // 3. Launch the Roll Manager
                const rollManager = new RollManager(rollDefinitions);
                rollManager.show();
                return;
            }

            // --- Logic to unequip by clicking a filled slot in the UI ---
            const unequipSlot = target.closest('.equipment-slot.filled');
            if (unequipSlot) {
                const slotId = unequipSlot.dataset.slotId;
                const slotValue = activeCharacter.equipmentSlots[slotId];
                if (!slotValue) return;

                // --- NEW, PRECISE LOGIC ---
                // Check if the item in the clicked slot is a combined-slot item (which is an object).
                if (typeof slotValue === 'object' && slotValue.instanceId) {
                    // It's a combined item. We need to unequip only this specific instance.
                    const instanceIdToRemove = slotValue.instanceId;
                    let newEquipmentSlots = { ...activeCharacter.equipmentSlots };

                    // Find all slots occupied by this specific instance and set them to null.
                    for (const sId in newEquipmentSlots) {
                        if (newEquipmentSlots[sId]?.instanceId === instanceIdToRemove) {
                            newEquipmentSlots[sId] = null;
                        }
                    }

                    // Save the change and re-render.
                    try {
                        activeCharacter = await db.updateCharacter(activeCharacter.id, { equipmentSlots: newEquipmentSlots });
                        processAndRenderAll(activeCharacter);
                    } catch (err) {
                        console.error('Failed to unequip instance:', err);
                        alerter.show('Failed to unequip instance.', 'error');
                    }

                } else {
                    // --- EXISTING LOGIC FOR STANDARD ITEMS ---
                    // This handles unequipping single-slot items like helmets or rings.
                    const itemIdToUnequip = slotValue; // It's just an ID string here.
                    let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
                    let newInventory = [...activeCharacter.inventory];
                    newEquipmentSlots[slotId] = null;

                    const isStillEquippedElsewhere = Object.values(newEquipmentSlots).includes(itemIdToUnequip);
                    if (!isStillEquippedElsewhere) {
                        newInventory = newInventory.map(item =>
                            item.id === itemIdToUnequip ? { ...item, equipped: false } : item
                        );
                    }
                    
                    try {
                        activeCharacter = await db.updateCharacter(activeCharacter.id, { inventory: newInventory, equipmentSlots: newEquipmentSlots });
                        processAndRenderAll(activeCharacter);
                    } catch (err) {
                        console.error('Failed to unequip from slot:', err);
                        alerter.show('Failed to unequip from slot.', 'error');
                    }
                }
                return; // Stop further event processing.
            }

            // --- Logic for the standard Equip/Unequip button (for non-stackable items) ---
            const equipButton = target.closest('.btn-equip');
            if (equipButton) {
                const itemId = equipButton.dataset.itemId;
                const itemInstance = activeCharacter.inventory.find(i => i.id === itemId);
                if (itemInstance && itemInstance.equipped) {
                    await handleUnequip(itemId);
                } else {
                    // **MODIFICATION HERE**
                    await handleEquip(itemId); 
                }
                return;
            }

            // --- Logic for Stackable Item Equip Button ---
            const equipStackButton = target.closest('.btn-equip-stack');
            if (equipStackButton) {
                const itemId = equipStackButton.dataset.itemId;
                // **MODIFICATION HERE**
                await handleEquip(itemId); 
                return;
            }

            // --- Logic for Stackable Item Unequip Button ---
            const unequipStackButton = target.closest('.btn-unequip-stack');
            if (unequipStackButton) {
                const itemId = unequipStackButton.dataset.itemId;
                const itemDef = equipmentData[itemId];

                // Check if the item is a multi-slot item.
                if (itemDef && activeLayout.layoutConfig.combined_slots[itemDef.equip_slot]) {
                    // --- NEW LOGIC FOR MULTI-SLOT STACKABLE ITEMS ---
                    const equippedInstances = {};

                    // 1. Find all equipped instances of this item by grouping slots by instanceId.
                    for (const slotId in activeCharacter.equipmentSlots) {
                        const slotValue = activeCharacter.equipmentSlots[slotId];
                        if (slotValue?.itemId === itemId && slotValue.instanceId) {
                            if (!equippedInstances[slotValue.instanceId]) {
                                equippedInstances[slotValue.instanceId] = [];
                            }
                            equippedInstances[slotValue.instanceId].push(slotId);
                        }
                    }
                    
                    const instanceIds = Object.keys(equippedInstances);

                    if (instanceIds.length > 0) {
                        // 2. Find the "last" instance by sorting the IDs (which contain timestamps).
                        instanceIds.sort(); // A simple alphabetical sort works on the timestamp string.
                        const instanceIdToRemove = instanceIds[instanceIds.length - 1]; // Get the newest one.

                        let newEquipmentSlots = { ...activeCharacter.equipmentSlots };

                        // 3. Remove all slots belonging to that specific instance.
                        for (const slotId in newEquipmentSlots) {
                            if (newEquipmentSlots[slotId]?.instanceId === instanceIdToRemove) {
                                newEquipmentSlots[slotId] = null;
                            }
                        }

                        try {
                            activeCharacter = await db.updateCharacter(activeCharacter.id, { equipmentSlots: newEquipmentSlots });
                            processAndRenderAll(activeCharacter);
                        } catch (err) {
                            console.error('Failed to unequip multi-slot stackable instance:', err);
                            alerter.show('Failed to unequip instance.', 'error');
                        }
                    }
                } else {
                    // --- EXISTING LOGIC FOR SINGLE-SLOT STACKABLE ITEMS (like rings) ---
                    // This logic is correct and remains unchanged.
                    const equipSlotType = itemDef?.equip_slot;
                    const instanceSlots = activeLayout.slotMap[equipSlotType] || [];
                    const occupiedSlots = instanceSlots.filter(id => activeCharacter.equipmentSlots[id] === itemId);

                    if (occupiedSlots.length > 0) {
                        const slotToUnequip = occupiedSlots[occupiedSlots.length - 1];
                        let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
                        let newInventory = [...activeCharacter.inventory];
                        newEquipmentSlots[slotToUnequip] = null;
                        
                        // After this unequip, check if it was the last one equipped.
                        if (occupiedSlots.length - 1 === 0) {
                            newInventory = newInventory.map(item => item.id === itemId ? { ...item, equipped: false } : item);
                        }

                        try {
                            activeCharacter = await db.updateCharacter(activeCharacter.id, { inventory: newInventory, equipmentSlots: newEquipmentSlots });
                            processAndRenderAll(activeCharacter);
                        } catch (err) { console.error('Failed to unequip stackable item:', err); alerter.show('Failed to unequip item.', 'error'); }
                    }
                }
                return; // Stop further event processing.
            }
            
            // --- Logic for other buttons (Use, Craft, Health, Rolls) ---
            const useButton = target.closest('.btn-use');
            if (useButton) alerter.show(`Using ${useButton.dataset.itemName}`, 'info');
            const craftButton = target.closest('.btn-craft');
            if (craftButton) alerter.show('Crafting system not yet implemented.', 'info');

            // --- NEW: HANDLER FOR DISMISSING A SUMMON ---
            const dismissButton = target.closest('.btn-dismiss-summon');
            if (dismissButton) {
                const instanceId = dismissButton.dataset.instanceId;
                if (!instanceId) return;

                const summonToDismiss = activeCharacter.summonedCreatures.find(s => s.instanceId === instanceId);
                if (!summonToDismiss) return;
                
                // Initialize the array on the character if it doesn't exist
                activeCharacter.dismissedPassiveSources = activeCharacter.dismissedPassiveSources || [];

                // Check if the summon comes from a passive source (like equipment or a perk)
                const isPassiveSource = summonToDismiss.source.type === 'equipment' || summonToDismiss.source.type === 'perk' || summonToDismiss.source.type === 'flaw';

                if (isPassiveSource) {
                    // If passive, add the source ID to the dismissed list to prevent re-summoning.
                    if (!activeCharacter.dismissedPassiveSources.includes(summonToDismiss.source.id)) {
                        activeCharacter.dismissedPassiveSources.push(summonToDismiss.source.id);
                    }
                }
                
                // For all summon types, filter the dismissed summon out of the active list.
                const updatedSummons = activeCharacter.summonedCreatures.filter(s => s.instanceId !== instanceId);
                
                try {
                    // Save both the updated summons list and the new dismissed list to the database.
                    activeCharacter = await db.updateCharacter(activeCharacter.id, { 
                        summonedCreatures: updatedSummons,
                        dismissedPassiveSources: activeCharacter.dismissedPassiveSources
                    });
                    processAndRenderAll(activeCharacter);
                } catch (err) {
                    console.error('Failed to dismiss summon:', err);
                    alerter.show('Failed to dismiss summon.', 'error');
                }
                return;
            }

            // --- NEW: HANDLER FOR SUMMON HEALTH CHANGES ---
            const applySummonHealthBtn = target.closest('.btn-apply-health');
            if (applySummonHealthBtn && applySummonHealthBtn.dataset.entityType === 'summon') {
                const instanceId = applySummonHealthBtn.dataset.entityId;
                const healthInput = contentArea.querySelector(`#health-adj-${instanceId}`);
                const summon = activeCharacter.summonedCreatures.find(s => s.instanceId === instanceId);

                // Early exit if we can't find the necessary elements or data.
                if (!summon || !healthInput) return;
                
                const summonDef = bestiaryData[summon.creatureId];
                if (!summonDef) return;

                if (healthInput.value.trim() === '') {
                    return alerter.show('Please enter a health adjustment value (e.g., -5, 10).', 'info');
                }

                const adjustment = parseInt(healthInput.value, 10);
                if (isNaN(adjustment)) return alerter.show('Invalid input. Please use numbers only.', 'error');
                
                const newCurrentHealth = Math.max(0, Math.min(summon.currentHealth + adjustment, summonDef.health.max));

                // --- NEW: AUTO-DISMISSAL ON ZERO HEALTH ---
                if (newCurrentHealth === 0) {
                    alerter.show(`${summonDef.name} was defeated and dismissed.`, 'info');
                    
                    // Re-use the exact same logic as the manual dismiss button for consistency.
                    const isPassiveSource = summon.source.type === 'equipment' || summon.source.type === 'perk' || summon.source.type === 'flaw';
                    if (isPassiveSource) {
                        activeCharacter.dismissedPassiveSources = activeCharacter.dismissedPassiveSources || [];
                        if (!activeCharacter.dismissedPassiveSources.includes(summon.source.id)) {
                            activeCharacter.dismissedPassiveSources.push(summon.source.id);
                        }
                    }
                    // Filter the defeated summon out of the array.
                    activeCharacter.summonedCreatures = activeCharacter.summonedCreatures.filter(s => s.instanceId !== instanceId);

                } else {
                    // If health is not zero, just update the value on the existing summon object.
                    summon.currentHealth = newCurrentHealth;
                }

                try {
                    // This single database call now saves the result of either the dismissal or the health change.
                    activeCharacter = await db.updateCharacter(activeCharacter.id, { 
                        summonedCreatures: activeCharacter.summonedCreatures,
                        dismissedPassiveSources: activeCharacter.dismissedPassiveSources 
                    });
                    processAndRenderAll(activeCharacter);
                } catch(err) {
                    console.error('Error updating summon state:', err);
                    alerter.show('Error updating summon state.', 'error');
                }
                return;
            }

            if (applySummonHealthBtn && applySummonHealthBtn.dataset.entityType === 'character') {
                const healthInput = contentArea.querySelector(`#health-adj-${applySummonHealthBtn.dataset.entityId}`);
                if (!healthInput) return;
                const adjustment = parseInt(healthInput.value, 10);
                if (isNaN(adjustment)) return alerter.show('Invalid input.', 'error');
                const finalMaxHealth = activeCharacter.calculatedHealth ? activeCharacter.calculatedHealth.currentMax : activeCharacter.health.max;
                const newCurrentHealth = Math.max(0, Math.min(activeCharacter.health.current + adjustment, finalMaxHealth));
                try {
                    const newHealthObject = {
                        ...activeCharacter.health,
                        current: newCurrentHealth
                    };
                    activeCharacter = await db.updateCharacter(activeCharacter.id, {
                        health: newHealthObject,
                        lastMaxHealthBonus: activeCharacter.lastMaxHealthBonus
                    });
                    processAndRenderAll(activeCharacter);
                } catch(err) { 
                    console.error('Error updating character health:', err); 
                    alerter.show('Error updating health.', 'error'); 
                }
            }

            const hopeFearButton = target.closest('.hope-fear-roll-btn');
            if(hopeFearButton) {
                const attributeName = hopeFearButton.dataset.attribute;
                const numericalEffects = mainEffectHandler.getEffectsForAttribute(attributeName, 'modifier');
                const diceNumEffects = mainEffectHandler.getEffectsForAttribute(attributeName, 'die_num');
                const baseValue = activeCharacter.attributes[attributeName] || 0;
                const combinedValue = mainEffectHandler.getCombinedAttributeValue(attributeName, baseValue);
                const rollDefinitions = [{
                    groupType: 'hope_fear',
                    label: `${attributeName.charAt(0).toUpperCase() + attributeName.slice(1)} Check`,
                    attributeName: attributeName,
                    baseValue: baseValue,
                    modifierData: {
                        combinedValue: combinedValue,
                        totalNumerical: numericalEffects.reduce((sum, eff) => sum + (eff.modifier || 0), 0),
                        totalDiceNum: diceNumEffects.reduce((sum, eff) => sum + (eff.modifier || 0), 0),
                        sources: [...numericalEffects, ...diceNumEffects]
                    }
                }];
                const rollManager = new RollManager(rollDefinitions);
                rollManager.show();
            }

            const abilityButton = target.closest('.ability-button');
            if (abilityButton) {
                const abilityId = abilityButton.dataset.abilityId;
                if (activeAbilityStates.has(abilityId)) activeAbilityStates.delete(abilityId);
                else activeAbilityStates.add(abilityId);
                processAndRenderAll(activeCharacter);
            }
        });

        // --- STATIC LISTENERS (for elements outside the main content area) ---
        const tabsNav = document.querySelector('.tabs-nav');
        tabsNav.addEventListener('click', (event) => {
            const target = event.target.closest('.tab-button');
            if (!target) return;
            tabsNav.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');
            const tabId = target.dataset.tab;
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.toggle('active', panel.id === tabId);
            });
        });
        document.getElementById('levelUpBtn')?.addEventListener('click', () => {
            if (!activeCharacter) return;
            sessionStorage.setItem('levelUpCharacterId', activeCharacter.id);
            window.location.href = 'character-creator.html';
        });
        document.getElementById('exportSingleCharacterBtn').addEventListener('click', () => {
            if (!activeCharacter) return;
            db.exportCharacter(activeCharacter.id, activeCharacter.info.name).then(exportData => {
                const a = document.createElement('a');
                a.href = exportData.url;
                a.download = exportData.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(exportData.url), 100);
            }).catch(err => alerter.show('Export failed: ' + err, 'error'));
        });

    } catch (error) {
        console.error('A critical error occurred during initialization:', error);
        alerter.show('Failed to load game data. Check console.', 'error');
    }
});
