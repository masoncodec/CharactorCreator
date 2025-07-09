// play.js (Corrected and Final)
import { EffectHandler } from './effectHandler.js';
import { loadGameModules, loadDataForModule } from './dataLoader.js';
import { alerter } from './alerter.js';
import { RollManager } from './RollManager.js';
import { renderTopNav, renderMainTab, renderAbilitiesTab, renderProfileTab, renderInventoryTab, renderEquipmentTab, EQUIPMENT_SLOT_CONFIG } from './play-ui.js';
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
 * UPDATED: Uses the new config to find all slots an item type occupies.
 * @param {string} equipSlot - The equip_slot from the item's definition (e.g., "head", "two-hand").
 * @returns {Array<string>} An array of the actual base slot names the item uses.
 */
function getSlotsForEquipSlot(equipSlot) {
    const combinedConfig = EQUIPMENT_SLOT_CONFIG.combined_slots[equipSlot];
    if (combinedConfig) {
        return combinedConfig.replaces;
    }
    if (equipSlot) {
        return [equipSlot];
    }
    return [];
}

/**
 * Reusable async function to handle all unequip actions.
 * @param {string} itemIdToUnequip The ID of the item to unequip.
 */
async function handleUnequip(itemIdToUnequip) {
    if (!activeCharacter || !itemIdToUnequip) return;
    const itemDef = equipmentData[itemIdToUnequip];
    if (!itemDef) return;
    const slotsToClear = getSlotsForEquipSlot(itemDef.equip_slot);
    const newEquipmentSlots = { ...activeCharacter.equipmentSlots };
    slotsToClear.forEach(s => {
        if (newEquipmentSlots[s] === itemIdToUnequip) newEquipmentSlots[s] = null;
    });
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

            // --- Unequip from Slot Logic ---
            const unequipSlot = target.closest('.equipment-slot.filled');
            if (unequipSlot) {
                const slotId = unequipSlot.dataset.slotId;
                const itemIdToUnequip = activeCharacter.equipmentSlots[slotId];
                await handleUnequip(itemIdToUnequip); // Use the reusable function
                return;
            }

            // --- Equip/Unequip from Button Logic ---
            const equipButton = target.closest('.btn-equip');
            if (equipButton) {
                const itemId = equipButton.dataset.itemId;
                const itemInstance = activeCharacter.inventory.find(i => i.id === itemId);

                if (itemInstance && itemInstance.equipped) {
                    await handleUnequip(itemId);
                } else {
                    // EQUIP LOGIC
                    const itemToEquipDef = equipmentData[itemId];
                    if (!itemToEquipDef || !itemToEquipDef.equip_slot) return alerter.show('This item cannot be equipped.', 'warn');
                    
                    const targetSlots = getSlotsForEquipSlot(itemToEquipDef.equip_slot);
                    const conflictingItemIds = new Set(targetSlots.map(s => activeCharacter.equipmentSlots[s]).filter(Boolean));
                    
                    let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
                    
                    conflictingItemIds.forEach(id => {
                        if (id === itemId) return;
                        const def = equipmentData[id];
                        getSlotsForEquipSlot(def.equip_slot).forEach(s => newEquipmentSlots[s] = null);
                    });

                    // Equip the new item by filling ALL its target slots with its ID
                    targetSlots.forEach(s => {
                        newEquipmentSlots[s] = itemId;
                    });

                    const newInventory = activeCharacter.inventory.map(item => {
                        if (item.id === itemId) return { ...item, equipped: true };
                        if (conflictingItemIds.has(item.id)) return { ...item, equipped: false };
                        return item;
                    });

                    try {
                        activeCharacter = await db.updateCharacter(activeCharacter.id, { inventory: newInventory, equipmentSlots: newEquipmentSlots });
                        processAndRenderAll(activeCharacter);
                    } catch (err) { console.error('Failed to equip item:', err); alerter.show('Failed to equip item.', 'error'); }
                }
                return;
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