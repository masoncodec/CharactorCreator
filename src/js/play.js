// play.js (Corrected and Final)
import { EffectHandler } from './effectHandler.js';
import { loadGameModules, loadDataForModule } from './dataLoader.js';
import { alerter } from './alerter.js';
import { RollManager } from './RollManager.js';
import { renderTopNav, renderMainTab, renderAbilitiesTab, renderProfileTab, renderInventoryTab, renderEquipmentTab, EQUIPMENT_SLOT_CONFIG, getEquippedCount } from './play-ui.js';
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
    renderInventoryTab(effectedCharacter, equipmentData);
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
 * Reusable async function to handle all unequip actions.
 * @param {string} itemIdToUnequip The ID of the item to unequip.
 */
async function handleUnequip(itemIdToUnequip) {
    if (!activeCharacter || !itemIdToUnequip) return;
    let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
    // Find all slot instances that hold this item ID and clear them.
    for (const slotId in newEquipmentSlots) {
        if (newEquipmentSlots[slotId] === itemIdToUnequip) {
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
 * Finds the best target slot(s) for an item, handling single, repeatable, and combined items.
 * This is the final, robust version that correctly handles multi-wielding.
 * @param {object} itemDef - The definition of the item to equip.
 * @param {object} equipmentSlots - The character's current equipment slots.
 * @param {string} itemIdToEquip - The ID of the item being equipped.
 * @param {object} layoutConfig - The character's final layout configuration.
 * @param {object} slotMap - The character's final slot map.
 * @returns {Array<string>} An array of target slot IDs.
 */
function findTargetSlots(itemDef, equipmentSlots, itemIdToEquip, layoutConfig, slotMap) {
    const slotType = itemDef.equip_slot;
    const combinedConfig = layoutConfig.combined_slots[slotType];

    // --- Logic for Standard/Repeatable Items (e.g., ring, head) ---
    if (!combinedConfig) {
        const instanceSlots = slotMap[slotType] || [];
        // Priority 1: Find any empty slot
        const emptySlot = instanceSlots.find(id => !equipmentSlots[id]);
        if (emptySlot) {
            return [emptySlot];
        }
        // Priority 2: Find a slot with a *different* item to replace
        const replaceableSlot = instanceSlots.find(id => equipmentSlots[id] !== itemIdToEquip);
        if (replaceableSlot) {
            return [replaceableSlot];
        }
        // All available slots are already full of this same item.
        return [];
    }

    // Logic for Combined-Slot Items (e.g., two-hand)
    if (combinedConfig) {
        const requiredTypes = combinedConfig.replaces; // e.g., ['main-hand', 'off-hand']

        // 1. Get all possible instance slots for the required types
        const potentialPrimarySlots = slotMap[requiredTypes[0]] || [];
        const potentialSecondarySlots = slotMap[requiredTypes[1]] || [];

        // 2. Find which of those slots are already occupied by ANOTHER combined item
        const occupiedByCombined = new Set();
        for (const slotId in equipmentSlots) {
            const itemId = equipmentSlots[slotId];
            if (!itemId) continue;
            const itemDef = equipmentData[itemId];
            if (itemDef && layoutConfig.combined_slots[itemDef.equip_slot]) {
                occupiedByCombined.add(slotId);
            }
        }

        // 3. Create a pool of "available" slots that are not part of an existing combined-item pair
        const availablePrimary = potentialPrimarySlots.filter(id => !occupiedByCombined.has(id));
        const availableSecondary = potentialSecondarySlots.filter(id => !occupiedByCombined.has(id));

        let bestPair = [];
        let lowestCost = Infinity; // Using a cost system: 0 for empty, 1 for filled

        // 4. Iterate through all available pairs to find the best one
        for (const p of availablePrimary) {
            for (const s of availableSecondary) {
                const pIsFilled = !!equipmentSlots[p];
                const sIsFilled = !!equipmentSlots[s];
                const currentCost = (pIsFilled ? 1 : 0) + (sIsFilled ? 1 : 0);

                if (currentCost < lowestCost) {
                    lowestCost = currentCost;
                    bestPair = [p, s];
                    // If we find a perfect empty pair, use it immediately
                    if (lowestCost === 0) {
                        return bestPair;
                    }
                }
            }
        }
        return bestPair; // Return the best pair found, even if it requires replacement
    }

    return [];
}

/**
 * Master function to handle all item equip actions with priority-based logic.
 * @param {string} itemId The ID of the item to equip.
 */
async function handleEquip(itemId) {
    if (!activeCharacter || !itemId) return;

    // Pull the current layout from our new global variable.
    const { layoutConfig, slotMap } = activeLayout;

    const itemDef = equipmentData[itemId];
    // Pass layoutConfig to getEquippedCount.
    const itemInInventory = activeCharacter.inventory.find(i => i.id === itemId);
    const equippedCount = getEquippedCount(itemId, activeCharacter, equipmentData, layoutConfig);

    if (!itemInInventory || itemInInventory.quantity <= equippedCount) {
        return alerter.show('No unequipped instances of this item are available.', 'warn');
    }

    let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
    // Pass the dynamic layout to findTargetSlots.
    const targetSlots = findTargetSlots(itemDef, newEquipmentSlots, itemId, layoutConfig, slotMap);

    if (targetSlots.length === 0) {
        return alerter.show('All available slots are already filled with this item.', 'warn');
    }
    
    let newInventory = [...activeCharacter.inventory];
    targetSlots.forEach(slotId => {
        const itemToReplace = newEquipmentSlots[slotId];
        if (itemToReplace) {
            const totalEquipped = getEquippedCount(itemToReplace, activeCharacter, equipmentData, layoutConfig);
            if (totalEquipped <= 1) {
                newInventory = newInventory.map(item => item.id === itemToReplace ? { ...item, equipped: false } : item);
            }
        }
    });
    targetSlots.forEach(slotId => {
        newEquipmentSlots[slotId] = itemId;
    });
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
                // Get the specific slot instance that was clicked (e.g., "main-hand_1" or "ring_1").
                const slotId = unequipSlot.dataset.slotId;
                const itemIdToUnequip = activeCharacter.equipmentSlots[slotId];

                if (!itemIdToUnequip) return; // Safety check

                // Look up the item's definition to see what kind of item it is.
                const itemDef = equipmentData[itemIdToUnequip];

                // Check if the item is a combined-slot item (like a two-hander).
                if (itemDef && EQUIPMENT_SLOT_CONFIG.combined_slots[itemDef.equip_slot]) {
                    // If it IS a combined item, we must unequip it completely from all its slots.
                    // The existing `handleUnequip` function does this perfectly.
                    await handleUnequip(itemIdToUnequip);
                } else {
                    // If it's a STANDARD or REPEATABLE item (like a helmet or a ring),
                    // we only unequip it from the single slot that was clicked.
                    let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
                    let newInventory = [...activeCharacter.inventory];

                    // Clear only the specific slot that was clicked.
                    newEquipmentSlots[slotId] = null;

                    // After clearing, check if any other instances of this item are still equipped.
                    const isStillEquippedElsewhere = Object.values(newEquipmentSlots).includes(itemIdToUnequip);

                    // If no other instances are equipped, update the master "equipped" flag
                    // in the inventory list so the buttons can update.
                    if (!isStillEquippedElsewhere) {
                        newInventory = newInventory.map(item =>
                            item.id === itemIdToUnequip ? { ...item, equipped: false } : item
                        );
                    }

                    // Save the changes and re-render the UI.
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
                const equipSlotType = equipmentData[itemId]?.equip_slot;
                const instanceSlots = activeLayout.slotMap[equipSlotType] || [];
                const occupiedSlots = instanceSlots.filter(id => activeCharacter.equipmentSlots[id] === itemId);
                if (occupiedSlots.length > 0) {
                    const slotToUnequip = occupiedSlots[occupiedSlots.length - 1];
                    let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
                    let newInventory = [...activeCharacter.inventory];
                    newEquipmentSlots[slotToUnequip] = null;
                    if (occupiedSlots.length - 1 === 0) {
                        newInventory = newInventory.map(item => item.id === itemId ? { ...item, equipped: false } : item);
                    }
                    try {
                        activeCharacter = await db.updateCharacter(activeCharacter.id, { inventory: newInventory, equipmentSlots: newEquipmentSlots });
                        processAndRenderAll(activeCharacter);
                    } catch (err) { console.error('Failed to unequip stackable item:', err); alerter.show('Failed to unequip item.', 'error'); }
                }
                return;
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