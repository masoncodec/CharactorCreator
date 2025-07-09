// play.js (Corrected and Final)
import { EffectHandler } from './effectHandler.js';
import { loadGameModules, loadDataForModule } from './dataLoader.js';
import { alerter } from './alerter.js';
import { RollManager } from './RollManager.js';
import { renderTopNav, renderMainTab, renderAbilitiesTab, renderProfileTab, renderInventoryTab, renderEquipmentTab, EQUIPMENT_SLOT_CONFIG, EQUIPMENT_SLOT_MAP } from './play-ui.js';
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
        .map(item => ({ ...item, definition: equipmentData[item.id] }))
        .filter(item => item.definition && item.definition.type === 'equipment');
    renderTopNav(effectedCharacter, moduleDefinitions);
    renderMainTab(effectedCharacter, moduleDefinitions);
    renderAbilitiesTab(allAbilities, effectedCharacter);
    renderProfileTab(effectedCharacter, flawData, perkData);
    renderInventoryTab(effectedCharacter, equipmentData);
    renderEquipmentTab(equipmentItems, effectedCharacter.equipmentSlots, equipmentData);
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

            const unequipSlot = target.closest('.equipment-slot.filled');
            if (unequipSlot) {
                const slotId = unequipSlot.dataset.slotId;
                const itemIdToUnequip = activeCharacter.equipmentSlots[slotId];
                await handleUnequip(itemIdToUnequip);
                return;
            }

            // --- Equip/Unequip from Button Logic ---
            const equipButton = target.closest('.btn-equip');
            
            if (equipButton) {
                const itemId = equipButton.dataset.itemId;
                const itemInstance = activeCharacter.inventory.find(i => i.id === itemId);

                // This part handles clicking a button that already says "Unequip"
                if (itemInstance && itemInstance.equipped) {
                    await handleUnequip(itemId);
                } else {
                    // This is the main logic for when the button says "Equip"
                    const itemToEquipDef = equipmentData[itemId];
                    const equipSlotType = itemToEquipDef.equip_slot;
                    if (!equipSlotType) return alerter.show('This item cannot be equipped.', 'warn');
                    
                    let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
                    let newInventory = [...activeCharacter.inventory];
                    const combinedConfig = EQUIPMENT_SLOT_CONFIG.combined_slots[equipSlotType];
                    const instanceSlots = EQUIPMENT_SLOT_MAP[equipSlotType];

                    if (combinedConfig) {
                        // --- Case 1: Equipping a Combined Item (e.g., "two-hand") ---
                        // This is the new, smarter logic that dynamically finds available slots.
                        
                        const baseTypes = combinedConfig.replaces; // e.g., ['main-hand', 'off-hand']
                        const targetSlots = []; // This will hold the specific slots to occupy, e.g., ['main-hand_1', 'off-hand_2']

                        // For each required slot type, find an available instance.
                        for (const type of baseTypes) {
                            const availableInstances = EQUIPMENT_SLOT_MAP[type];
                            if (!availableInstances) continue;

                            // First, try to find an empty instance of this type.
                            const emptyInstance = availableInstances.find(id => !newEquipmentSlots[id]);
                            if (emptyInstance) {
                                targetSlots.push(emptyInstance);
                            } else {
                                // If no empty instance is found, we must replace one.
                                // We'll target the first instance of this type for replacement.
                                targetSlots.push(availableInstances[0]);
                            }
                        }

                        // Now that we have our target slots, find all unique items currently in them.
                        const conflictingItemIds = new Set(targetSlots.map(s => newEquipmentSlots[s]).filter(Boolean));

                        // Unequip every conflicting item.
                        for (const id of conflictingItemIds) {
                            // Fully unequip the item from all slots it might occupy.
                            for (const slotId in newEquipmentSlots) {
                                if (newEquipmentSlots[slotId] === id) {
                                    newEquipmentSlots[slotId] = null;
                                }
                            }
                            newInventory = newInventory.map(item => item.id === id ? { ...item, equipped: false } : item);
                        }
                        
                        // Equip the new combined item in all its dynamically found target slots.
                        targetSlots.forEach(s => newEquipmentSlots[s] = itemId);

                    } else if (instanceSlots) {
                        // --- Case 2 & 3: Equipping a Repeatable or Standard Item ---
                        // This logic is already correct.
                        const emptySlotId = instanceSlots.find(slotId => !newEquipmentSlots[slotId]);
                        if (emptySlotId) {
                            newEquipmentSlots[emptySlotId] = itemId;
                        } else {
                            const slotToReplace = instanceSlots[instanceSlots.length - 1];
                            const oldItemId = newEquipmentSlots[slotToReplace];
                            if (oldItemId) {
                                for (const slotId in newEquipmentSlots) {
                                    if (newEquipmentSlots[slotId] === oldItemId) {
                                        newEquipmentSlots[slotId] = null;
                                    }
                                }
                                newInventory = newInventory.map(item => item.id === oldItemId ? { ...item, equipped: false } : item);
                            }
                            newEquipmentSlots[slotToReplace] = itemId;
                        }
                    } else {
                        return alerter.show('Invalid slot type definition.', 'error');
                    }
                    
                    // Finally, update the new item's status to be "equipped".
                    newInventory = newInventory.map(item => item.id === itemId ? { ...item, equipped: true } : item);
                    
                    // Save all changes and re-render the UI.
                    try {
                        activeCharacter = await db.updateCharacter(activeCharacter.id, { inventory: newInventory, equipmentSlots: newEquipmentSlots });
                        processAndRenderAll(activeCharacter);
                    } catch (err) { console.error('Failed to equip item:', err); alerter.show('Failed to equip item.', 'error'); }
                }
                return; // Stop further event processing.
            }
            
            // --- Other Actions ---
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