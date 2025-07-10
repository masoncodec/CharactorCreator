// play.js (Corrected and Final)
import { EffectHandler } from './effectHandler.js';
import { loadGameModules, loadDataForModule } from './dataLoader.js';
import { alerter } from './alerter.js';
import { RollManager } from './RollManager.js';
import { renderTopNav, renderMainTab, renderAbilitiesTab, renderProfileTab, renderInventoryTab, renderEquipmentTab, EQUIPMENT_SLOT_CONFIG, getEquippedCount, findTargetSlots } from './play-ui.js';
import { aggregateAllAbilities } from './abilityAggregator.js';

// Global variables
let moduleDefinitions = {}, abilityData = {}, flawData = {}, perkData = {}, equipmentData = {}, activeAbilityStates = new Set(), activeCharacter = null;

// Add this new global variable near the top with the others.
let activeLayout = {};

/**
 * Main function to process a character's data and render the entire layout.
 */
async function processAndRenderAll(character) {
    if (!character) {
        document.querySelector('.play-content-scrollable').innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
        return;
    }

    // Generate the layout and reconcile slots
    const { layoutConfig, slotMap } = generateCharacterLayout(character);
    const reconciledCharacter = await reconcileEquipmentSlots(character, slotMap);

    // Store the generated layout in our new global variable so event handlers can access it.
    activeLayout = { layoutConfig, slotMap };

    if (!reconciledCharacter.equipmentSlots) reconciledCharacter.equipmentSlots = {};

    // Use the reconciledCharacter from now on.
    const allAbilities = aggregateAllAbilities(reconciledCharacter, abilityData, equipmentData);
    EffectHandler.processActiveAbilities(allAbilities, reconciledCharacter, flawData, perkData, activeAbilityStates, 'play');
    const effectedCharacter = EffectHandler.applyEffectsToCharacter(reconciledCharacter, 'play', activeAbilityStates);

    // This copies all dynamically calculated properties from the effected character
    // back to the main character object, making them available to all event handlers.

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
                // Pass the dynamic layoutConfig to getEquippedCount
                fullItemData.equippedCount = getEquippedCount(item.id, effectedCharacter, equipmentData, layoutConfig);
            }
            return fullItemData;
        })
        .filter(Boolean);
        
    renderTopNav(effectedCharacter, moduleDefinitions);
    renderMainTab(effectedCharacter, moduleDefinitions);
    renderAbilitiesTab(allAbilities, effectedCharacter);
    renderProfileTab(effectedCharacter, flawData, perkData);
    renderInventoryTab(effectedCharacter, equipmentData, layoutConfig, slotMap);
    // Pass the dynamic layout down to the rendering function.
    renderEquipmentTab(equipmentItems, effectedCharacter.equipmentSlots, equipmentData, effectedCharacter, layoutConfig, slotMap);
}

/**
 * Creates a map of slot types to their unique instance IDs based on a layout config.
 * E.g., { "ring": ["ring_1", "ring_2"] }
 * @param {object} config - The equipment slot configuration object.
 * @returns {object} The generated slot map.
 */
function generateSlotMap(config) {
    const slotMap = {};
    // Iterate through all slot types defined in the categories
    for (const categoryName in config.categories) {
        const slotTypes = config.categories[categoryName];
        slotTypes.forEach(slotType => {
            // If we haven't seen this slot type before, initialize its array
            if (!slotMap[slotType]) {
                slotMap[slotType] = [];
            }
            // Create a unique instance ID, e.g., "ring_1", "ring_2"
            const instanceNumber = slotMap[slotType].length + 1;
            slotMap[slotType].push(`${slotType}_${instanceNumber}`);
        });
    }
    return slotMap;
}

/**
 * Generates the final equipment slot configuration and map for a character.
 * FUTURE: This is where logic will go to apply perks/flaws to the base config.
 * @param {object} character - The character object.
 * @returns {object} An object containing the final layoutConfig and slotMap.
 */
function generateCharacterLayout(character) {
    // For now, we use the hard-coded default config from the UI file.
    const baseConfig = EQUIPMENT_SLOT_CONFIG;

    // In the future, you would apply character-specific modifications to baseConfig here.
    // For example:
    // const finalConfig = applyLayoutMods(baseConfig, character.perks, character.flaws);

    const finalConfig = baseConfig; // Using the base config for now.

    // The slot map must be generated from the FINAL config every time.
    const finalSlotMap = generateSlotMap(finalConfig); // We'll move generateSlotMap to play.js

    return { layoutConfig: finalConfig, slotMap: finalSlotMap };
}

/**
 * Compares a character's equipment against a definitive layout, then returns a
 * new, clean character object with a perfectly sorted equipmentSlots object.
 * @param {object} character - The character object with current equipment.
 * @param {object} finalSlotMap - The newly generated slot map to check against.
 * @returns {Promise<object>} A new character object with a reconciled equipment state.
 */
async function reconcileEquipmentSlots(character, finalSlotMap) {
    let characterNeedsUpdate = false;
    let newInventory = [...character.inventory];
    
    // This array, generated from the config, is the source of truth for the correct order.
    const orderedValidSlotIds = Object.values(finalSlotMap).flat();
    const newSortedSlots = {};

    // 1. Build the new, sorted slots object from scratch.
    for (const slotId of orderedValidSlotIds) {
        if (character.equipmentSlots.hasOwnProperty(slotId)) {
            // If the slot exists on the character, copy its value (item ID or null).
            newSortedSlots[slotId] = character.equipmentSlots[slotId];
        } else {
            // If the valid slot was missing from the character data, add it.
            newSortedSlots[slotId] = null;
            characterNeedsUpdate = true;
        }
    }

    // 2. Check if any items were in old, invalid slots that need to be unequipped.
    for (const originalSlotId in character.equipmentSlots) {
        // If an original slot isn't in our new sorted object, it's invalid.
        if (!newSortedSlots.hasOwnProperty(originalSlotId)) {
            const itemIdToUnequip = character.equipmentSlots[originalSlotId];
            if (itemIdToUnequip) {
                console.warn(`Reconciling: Invalid slot '${originalSlotId}' found. Unequipping '${itemIdToUnequip}'.`);
                characterNeedsUpdate = true;
                // Mark the item as unequipped in the inventory list.
                newInventory = newInventory.map(item =>
                    item.id === itemIdToUnequip ? { ...item, equipped: false } : item
                );
            }
        }
    }

    if (characterNeedsUpdate) {
        // Save the updated, clean character data back to the database.
        return await db.updateCharacter(character.id, { inventory: newInventory, equipmentSlots: newSortedSlots });
    } else {
        // Return the original character if no changes were needed.
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
            processAndRenderAll(activeCharacter);
        } else {
            document.querySelector('.play-content-scrollable').innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
        }

        // --- SINGLE EVENT LISTENER FOR ALL DYNAMIC ACTIONS ---
        const contentArea = document.querySelector('.play-content-scrollable');
        contentArea.addEventListener('click', async (event) => {
            if (!activeCharacter) return;
            const target = event.target;

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
            const applyHealthBtn = target.closest('#applyHealthAdjustment');
            if (applyHealthBtn) {
                const healthInput = contentArea.querySelector('#healthAdjustmentInput');
                const adjustment = parseInt(healthInput.value, 10);
                if (isNaN(adjustment)) return alerter.show('Invalid input.', 'error');
                const finalMaxHealth = activeCharacter.calculatedHealth ? activeCharacter.calculatedHealth.currentMax : activeCharacter.health.max;
                const newCurrentHealth = Math.max(0, Math.min(activeCharacter.health.current + adjustment, finalMaxHealth));
                try {
                    activeCharacter = await db.updateCharacterHealth(activeCharacter.id, { current: newCurrentHealth });
                    processAndRenderAll(activeCharacter);
                } catch(err) { console.error('Error updating character health:', err); alerter.show('Error updating health.', 'error'); }
            }
            const rollButton = target.closest('.attribute-roll');
            if (rollButton) {
                const row = rollButton.closest('.attribute-row');
                const attributeName = row.dataset.attribute;
                const dieType = row.dataset.dice;
                let baseResult = Math.floor(Math.random() * parseInt(dieType.substring(1))) + 1;
                const activeModifiers = EffectHandler.getEffectsForAttribute(attributeName, "modifier");
                let totalModifier = activeModifiers.reduce((sum, mod) => sum + (mod.modifier || 0), 0);
                const modifiedResult = baseResult + totalModifier;
                updateAttributeRollDisplay(row, baseResult, modifiedResult, activeModifiers);
            }
            const hopeFearButton = target.closest('.hope-fear-roll-btn');
            if(hopeFearButton) {
                const attributeName = hopeFearButton.dataset.attribute;
                const numericalEffects = EffectHandler.getEffectsForAttribute(attributeName, 'modifier');
                const diceNumEffects = EffectHandler.getEffectsForAttribute(attributeName, 'die_num');
                const baseValue = activeCharacter.attributes[attributeName] || 0;
                const combinedValue = EffectHandler.getCombinedAttributeValue(attributeName, baseValue);
                const modifierData = {
                    totalNumerical: numericalEffects.reduce((sum, eff) => sum + (eff.modifier || 0), 0),
                    totalDiceNum: diceNumEffects.reduce((sum, eff) => sum + (eff.modifier || 0), 0),
                    sources: [...numericalEffects, ...diceNumEffects]
                };
                const rollManager = new RollManager(attributeName, combinedValue, modifierData, baseValue);
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