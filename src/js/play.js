// play.js (Corrected and Final)
import { EffectHandler } from './effectHandler.js';
import { loadGameModules, loadDataForModule } from './dataLoader.js';
import { alerter } from './alerter.js';
import { RollManager } from './RollManager.js';
import { renderTopNav, renderMainTab, renderAbilitiesTab, renderProfileTab, renderInventoryTab, renderEquipmentTab, EQUIPMENT_SLOT_CONFIG, EQUIPMENT_SLOT_MAP, getEquippedCount } from './play-ui.js';
import { aggregateAllAbilities } from './abilityAggregator.js';

// Global variables
let moduleDefinitions = {}, abilityData = {}, flawData = {}, perkData = {}, equipmentData = {}, activeAbilityStates = new Set(), activeCharacter = null;

/**
 * Main function to process a character's data and render the entire layout.
 */
function processAndRenderAll(character) {
    if (!character) {
        document.querySelector('.play-content-scrollable').innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
        return;
    }
    if (!character.equipmentSlots) character.equipmentSlots = {};
    const allAbilities = aggregateAllAbilities(character, abilityData, equipmentData);
    EffectHandler.processActiveAbilities(allAbilities, character, flawData, perkData, activeAbilityStates, 'play');
    const effectedCharacter = EffectHandler.applyEffectsToCharacter(character, 'play', activeAbilityStates);
    const equipmentItems = effectedCharacter.inventory
        .map(item => {
            const definition = equipmentData[item.id];
            // Ensure the item has a valid definition and is of type 'equipment'.
            if (!definition || definition.type !== 'equipment') return null;

            const fullItemData = { ...item, definition };

            // If the item in the inventory is stackable (quantity > 1),
            // we calculate its equipped count and add it to the data object.
            if (item.quantity > 1) {
                fullItemData.equippedCount = getEquippedCount(item.id, effectedCharacter, equipmentData);
            }

            return fullItemData;
        })
        .filter(Boolean); // This removes any null entries from the list.
    renderTopNav(effectedCharacter, moduleDefinitions);
    renderMainTab(effectedCharacter, moduleDefinitions);
    renderAbilitiesTab(allAbilities, effectedCharacter);
    renderProfileTab(effectedCharacter, flawData, perkData);
    renderInventoryTab(effectedCharacter, equipmentData);
    renderEquipmentTab(equipmentItems, effectedCharacter.equipmentSlots, equipmentData, effectedCharacter);
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

function findTargetSlots(itemDef, equipmentSlots, itemIdToEquip) { // Add itemIdToEquip
    const slotType = itemDef.equip_slot;
    const combinedConfig = EQUIPMENT_SLOT_CONFIG.combined_slots[slotType];

    // --- Logic for Standard/Repeatable Items (e.g., ring, head) ---
    if (!combinedConfig) {
        const instanceSlots = EQUIPMENT_SLOT_MAP[slotType] || [];
        
        // Priority 1: Find any empty slot
        const emptySlot = instanceSlots.find(id => !equipmentSlots[id]);
        if (emptySlot) {
            return [emptySlot];
        }

        // Priority 2 (NEW): Find a slot occupied by a DIFFERENT item
        const replaceableSlot = instanceSlots.find(id => equipmentSlots[id] !== itemIdToEquip);
        if (replaceableSlot) {
            return [replaceableSlot];
        }

        // If all slots are full of the same item, there's nothing to do.
        return [];
    }

    // --- Logic for Combined-Slot Items (e.g., two-hand) ---
    // This logic remains the same as it doesn't involve stacking.
    if (combinedConfig) {
        const requiredTypes = combinedConfig.replaces;
        const possibleInstances = requiredTypes.map(type => EQUIPMENT_SLOT_MAP[type]);
        let targetSlots = [];
        const primarySlot = possibleInstances[0][0];
        const secondarySlots = possibleInstances[1];
        const emptySecondarySlot = secondarySlots.find(id => !equipmentSlots[id]);

        if (emptySecondarySlot) {
            targetSlots = [primarySlot, emptySecondarySlot];
            return targetSlots;
        }

        targetSlots = requiredTypes.map(type => EQUIPMENT_SLOT_MAP[type][0]);
        return targetSlots;
    }

    return [];
}

/**
 * Master function to handle all item equip actions with priority-based logic.
 * @param {string} itemId The ID of the item to equip.
 */
async function handleEquip(itemId) {
    if (!activeCharacter || !itemId) return;

    const itemDef = equipmentData[itemId];
    const itemInInventory = activeCharacter.inventory.find(i => i.id === itemId);
    const equippedCount = getEquippedCount(itemId, activeCharacter, equipmentData);

    // 1. Check Availability
    if (!itemInInventory || itemInInventory.quantity <= equippedCount) {
        return alerter.show('No unequipped instances of this item are available.', 'warn');
    }

    let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
    // 2. Find target slots using the NEW, smarter function
    const targetSlots = findTargetSlots(itemDef, newEquipmentSlots, itemId);

    if (targetSlots.length === 0) {
        // This message is now more accurate.
        return alerter.show('All available slots are already filled with this item.', 'warn');
    }

    // 3. (REVISED) Precisely unequip whatever is in the target slot(s)
    let newInventory = [...activeCharacter.inventory];
    targetSlots.forEach(slotId => {
        const itemToReplace = newEquipmentSlots[slotId];
        if (itemToReplace) {
            // Check if this is the last equipped instance of the item being replaced.
            const totalEquipped = getEquippedCount(itemToReplace, activeCharacter, equipmentData);
            if (totalEquipped <= 1) {
                newInventory = newInventory.map(item => item.id === itemToReplace ? { ...item, equipped: false } : item);
            }
        }
    });

    // 4. (REVISED) Equip the new item by first clearing and then setting the slots
    targetSlots.forEach(slotId => {
        newEquipmentSlots[slotId] = itemId;
    });
    newInventory = newInventory.map(item => item.id === itemId ? { ...item, equipped: true } : item);

    // 5. Save changes and re-render the UI
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
                const instanceSlots = EQUIPMENT_SLOT_MAP[equipSlotType] || [];
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