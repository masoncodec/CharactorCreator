// play.js (Corrected and Final)
import { EffectHandler } from './effectHandler.js';
import { loadGameModules, loadDataForModule } from './dataLoader.js';
import { alerter } from './alerter.js';
import { RollManager } from './RollManager.js';
import { renderTopNav, renderMainTab, renderAbilitiesTab, renderProfileTab, renderInventoryTab, renderEquipmentTab, renderSummonsPanel, EQUIPMENT_SLOT_CONFIG, getEquippedCount, findTargetSlots, renderAbilityInfoModal, renderTopNavResources } from './play-ui.js';
import { aggregateAllAbilities } from './abilityAggregator.js';

// --- NEW: Central Configuration for Roll Relevance ---
const RELEVANCE_RULES = {
  'hope_fear': {
    relevantEffectTypes: ['modifier', 'die_num'],
    contextKey: 'attribute'
  },
  'damage': {
    // ACTIVATING THIS FOR PHASE 2
    relevantEffectTypes: ['damage_mod', 'damage_dice_mod'],
    contextKey: 'damage_types' // Note: plural, as we'll check against an array of types
  }
};


// --- NEW: Functions to manage the Ability Info Modal ---
let boundCloseAbilityModalOnEscape;

/**
 * Removes the ability info modal from the DOM and cleans up its event listeners.
 */
function closeAbilityInfoModal() {
    const modal = document.getElementById('ability-info-modal');
    if (modal) {
        modal.remove();
    }
    // IMPORTANT: Clean up the global event listener to prevent memory leaks.
    if (boundCloseAbilityModalOnEscape) {
        document.removeEventListener('keydown', boundCloseAbilityModalOnEscape);
    }
}

/**
 * Creates and displays the ability info modal.
 * @param {object} ability - The full ability object to display.
 */
function showAbilityInfoModal(ability) {
    // First, ensure no other modal is open.
    closeAbilityInfoModal();

    const modalContentHTML = renderAbilityInfoModal(ability, activeCharacter);
    const modalContainerHTML = `
        <div id="ability-info-modal">
            <div class="ability-modal-backdrop" data-action="close-ability-info"></div>
            <div class="ability-modal-content">
                <button class="ability-modal-close" data-action="close-ability-info">&times;</button>
                ${modalContentHTML}
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalContainerHTML);
    const modalElement = document.getElementById('ability-info-modal');

    // Add a click listener to the modal container for closing.
    modalElement.addEventListener('click', (event) => {
        if (event.target.hasAttribute('data-action') && event.target.getAttribute('data-action') === 'close-ability-info') {
            closeAbilityInfoModal();
        }
    });

    // Add a keydown listener to the document for the Escape key.
    boundCloseAbilityModalOnEscape = (event) => {
        if (event.key === "Escape") {
            closeAbilityInfoModal();
        }
    };
    document.addEventListener('keydown', boundCloseAbilityModalOnEscape);
}


/**
 * NEW: Gathers the full set of abilities for a character roll, including global perks and flaws.
 * @param {Array<object>} baseAbilities - The starting list of abilities (e.g., from equipment).
 * @returns {Array<object>} A new array containing the base abilities plus perks and flaws.
 */
function getCharacterRollAbilities(baseAbilities) {
    const fullAbilityList = [...baseAbilities];

    // Add perks from the active character
    (activeCharacter.perks || []).forEach(perkState => {
        const perkDef = perkData[perkState.id];
        if (perkDef) {
            fullAbilityList.push({
                definition: perkDef,
                itemType: 'passive',
                sourceType: 'perk',
                sourceName: perkDef.name,
                instancedId: perkState.id
            });
        }
    });

    // Add flaws from the active character
    (activeCharacter.flaws || []).forEach(flawState => {
        const flawDef = flawData[flawState.id];
        if (flawDef) {
            fullAbilityList.push({
                definition: flawDef,
                itemType: 'passive',
                sourceType: 'flaw',
                sourceName: flawDef.name,
                instancedId: flawState.id
            });
        }
    });

    return fullAbilityList;
}

/**
 * MODIFIED: Helper function to determine if an ability is relevant to a specific roll context.
 * Now handles array-based contexts for damage types.
 * @param {object} ability - The full ability object.
 * @param {string} groupType - The type of roll group (e.g., 'hope_fear').
 * @param {object} context - The context of the roll (e.g., { attribute: 'whimsy' } or { damage_types: ['slashing'] }).
 * @returns {boolean} - True if the ability is relevant.
 */
function isAbilityRelevant(ability, groupType, context) {
    const rules = RELEVANCE_RULES[groupType];
    if (!rules || !ability.definition.effect || rules.relevantEffectTypes.length === 0) {
        return false;
    }

    const contextValue = context[rules.contextKey];
    if (!contextValue) {
        return false;
    }
    
    return ability.definition.effect.some(eff => {
        const hasRelevantType = rules.relevantEffectTypes.includes(eff.type);
        if (!hasRelevantType) return false;

        // Handle context being a single value (like an attribute)
        if (!Array.isArray(contextValue)) {
            return eff[rules.contextKey] === contextValue;
        }
        
        // Handle context being an array (like damage_types)
        // An effect is relevant if its damage_type is 'all' or is included in the roll's damage types.
        const effectContextKey = eff.damage_type; // e.g., the effect's "slashing" damage_type
        return effectContextKey === 'all' || contextValue.includes(effectContextKey);
    });
}

// --- Global variables ---
let moduleDefinitions = {}, abilityData = {}, flawData = {}, perkData = {};
let equipmentData = {}, activeAbilityStates = new Set(), activeCharacter = null;
let bestiaryData = {}, activeLayout = {};
let mainEffectHandler;
let allAbilities = []; 

/**
 * Main function to process a character's data and render the entire layout.
 */
async function processAndRenderAll(character) {
    if (!character) {
        document.querySelector('.play-content-scrollable').innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
        return;
    }

    // --- LOGIC ORDER ---
    
    // 1. Instantiate handler and process all of the CHARACTER's active effects.
    mainEffectHandler = new EffectHandler();
    allAbilities = aggregateAllAbilities(character, abilityData, equipmentData);
    mainEffectHandler.processActiveAbilities(allAbilities, character, flawData, perkData, activeAbilityStates, 'play');
    
    // 2. Reconcile summons based on active effects.
    const validSummonSourceIds = new Set(mainEffectHandler.activeEffects.filter(e => e.type === 'summon_creature').map(e => e.itemId));
    if (character.summonedCreatures && character.summonedCreatures.length > 0) {
        character.summonedCreatures = character.summonedCreatures.filter(summon => validSummonSourceIds.has(summon.source.id));
    }
    
    // 3. Generate dynamic equipment layout.
    const layoutEffects = mainEffectHandler.processLayoutEffects(mainEffectHandler.activeEffects);
    const { layoutConfig, slotMap } = generateCharacterLayout(character, layoutEffects);
    
    // 4. Reconcile equipped items.
    const reconciledCharacter = await reconcileEquipmentSlots(character, slotMap);

    // NEW 5a: DYNAMIC RESOURCE LOGIC.
    // This section recalculates current resource values when max values change.
    const lastResourceMaxBonuses = reconciledCharacter.lastResourceMaxBonuses || {};
    const newResourceMaxBonuses = {};
    if (!reconciledCharacter.resources) reconciledCharacter.resources = [];

    mainEffectHandler.activeEffects.forEach(effect => {
        if (effect.type === 'max_resource_mod') {
            const resourceId = effect.resource;
            if (!newResourceMaxBonuses[resourceId]) newResourceMaxBonuses[resourceId] = 0;
            newResourceMaxBonuses[resourceId] += effect.value;
        }
    });

    reconciledCharacter.resources.forEach(resource => {
        const lastBonus = lastResourceMaxBonuses[resource.id] || 0;
        const newBonus = newResourceMaxBonuses[resource.id] || 0;
        const bonusChange = newBonus - lastBonus;

        if (bonusChange !== 0) {
            resource.value = Math.max(0, resource.value + bonusChange);
        }
        // Also ensure current value does not exceed the new max.
        if (resource.max !== undefined) {
             resource.value = Math.min(resource.value, resource.max);
        }
    });
    reconciledCharacter.lastResourceMaxBonuses = newResourceMaxBonuses;
    
    // 6. Apply all other effects to the character.
    const effectedCharacter = mainEffectHandler.applyEffectsToCharacter(reconciledCharacter, 'play', activeAbilityStates, bestiaryData);
    
    // NEW 6a: Calculate final attributes for the main character and attach them for the UI.
    effectedCharacter.calculatedAttributes = {};
    for(const attr in effectedCharacter.attributes) {
        effectedCharacter.calculatedAttributes[attr] = mainEffectHandler.getCombinedAttributeValue(attr, effectedCharacter.attributes[attr]);
    }
    
    // NEW 6b: Loop through summons to calculate their final attributes.
    if (effectedCharacter.summonedCreatures) {
        effectedCharacter.summonedCreatures.forEach(summon => {
            const summonDef = bestiaryData[summon.creatureId];
            if (!summonDef || !summonDef.attributes) return;
            
            // Create a temporary, isolated handler for this summon.
            const summonEffectHandler = new EffectHandler();
            const allSummonAbilities = [
                ...(summonDef.abilities?.passive || []).map(p => ({ definition: p, itemType: 'passive' })),
                ...(summonDef.abilities?.active || []).map(a => ({ definition: a, itemType: 'active' }))
            ];
            // Note: We're not passing any toggle states to summons yet. This can be a future enhancement.
            summonEffectHandler.processActiveAbilities(allSummonAbilities, null, null, null, new Set(), 'summon');
            
            // Calculate and attach the final attributes to the summon instance.
            summon.calculatedAttributes = {};
            for (const attr in summonDef.attributes) {
                summon.calculatedAttributes[attr] = summonEffectHandler.getCombinedAttributeValue(attr, summonDef.attributes[attr]);
            }
        });
    }

    // 7. Store layout globally.
    activeLayout = { layoutConfig, slotMap };
    
    // --- FINAL STATE UPDATE ---
    character.calculatedAttributes = effectedCharacter.calculatedAttributes;
    character.languages = effectedCharacter.languages;
    character.activeRollEffects = effectedCharacter.activeRollEffects;
    character.temporaryBuffs = effectedCharacter.temporaryBuffs;
    character.summonedCreatures = effectedCharacter.summonedCreatures;
    character.statuses = effectedCharacter.statuses;
    character.resources = effectedCharacter.resources;
    character.resistances = effectedCharacter.resistances;
    character.movement = effectedCharacter.movement;
    
    const equipmentItems = effectedCharacter.inventory.map(item => { const def = equipmentData[item.id]; if (!def || def.type !== 'equipment') return null; const full = { ...item, definition: def }; if (item.quantity > 1) { full.equippedCount = getEquippedCount(item.id, effectedCharacter, equipmentData, layoutConfig); } return full; }).filter(Boolean);
        
    // --- RENDER EVERYTHING ---
    renderTopNav(effectedCharacter, moduleDefinitions);
    const resourceDisplayContainer = document.getElementById('character-resource-display');
    if (resourceDisplayContainer) {
        resourceDisplayContainer.innerHTML = renderTopNavResources(effectedCharacter, equipmentData);
    }
    renderMainTab(effectedCharacter, moduleDefinitions, mainEffectHandler);
    renderAbilitiesTab(allAbilities, effectedCharacter);
    renderProfileTab(effectedCharacter, flawData, perkData);
    renderInventoryTab(effectedCharacter, equipmentData, layoutConfig, slotMap);
    renderEquipmentTab(equipmentItems, effectedCharacter.equipmentSlots, equipmentData, effectedCharacter, layoutConfig, slotMap);
    renderSummonsPanel(effectedCharacter.summonedCreatures, bestiaryData);
}

// --- Functions below this line are unchanged and included for completeness ---

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

function generateCharacterLayout(character, layoutSummary) {
    const finalConfig = JSON.parse(JSON.stringify(EQUIPMENT_SLOT_CONFIG));
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
    const finalSlotMap = generateSlotMap(finalConfig);
    return { layoutConfig: finalConfig, slotMap: finalSlotMap };
}

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

async function handleEquip(itemId) {
    if (!activeCharacter || !itemId) return;
    const { layoutConfig, slotMap } = activeLayout;
    const itemDef = equipmentData[itemId];
    const itemInInventory = activeCharacter.inventory.find(i => i.id === itemId);
    const equippedCount = getEquippedCount(itemId, activeCharacter, equipmentData, layoutConfig);
    if (!itemInInventory || itemInInventory.quantity <= equippedCount) {
        return alerter.show('No unequipped instances of this item are available.', 'warn');
    }
    const targetSlots = findTargetSlots(itemDef, activeCharacter.equipmentSlots, itemId, layoutConfig, slotMap, equipmentData);
    if (targetSlots.length === 0) {
        return alerter.show('All available slots are already filled with this item.', 'warn');
    }
    let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
    let newInventory = [...activeCharacter.inventory];
    targetSlots.forEach(slotId => {
        const itemToReplace = newEquipmentSlots[slotId];
        if (itemToReplace) {
            const idToUnequip = typeof itemToReplace === 'object' ? itemToReplace.itemId : itemToReplace;
            const instanceToUnequip = typeof itemToReplace === 'object' ? itemToReplace.instanceId : null;
            if (instanceToUnequip) {
                for (const sId in newEquipmentSlots) {
                    if (newEquipmentSlots[sId]?.instanceId === instanceToUnequip) {
                        newEquipmentSlots[sId] = null;
                    }
                }
            } else {
                 newEquipmentSlots[slotId] = null;
            }
            const isStillEquipped = Object.values(newEquipmentSlots).some(v => (v && v.itemId === idToUnequip) || v === idToUnequip);
            if(!isStillEquipped){
                 newInventory = newInventory.map(item => item.id === idToUnequip ? { ...item, equipped: false } : item);
            }
        }
    });
    if (layoutConfig.combined_slots[itemDef.equip_slot]) {
        const instanceId = `${itemId}_instance_${Date.now()}`;
        targetSlots.forEach(slotId => {
            newEquipmentSlots[slotId] = { itemId: itemId, instanceId: instanceId };
        });
    } else {
        targetSlots.forEach(slotId => {
            newEquipmentSlots[slotId] = itemId;
        });
    }
    newInventory = newInventory.map(item => item.id === itemId ? { ...item, equipped: true } : item);
    try {
        activeCharacter = await db.updateCharacter(activeCharacter.id, { inventory: newInventory, equipmentSlots: newEquipmentSlots });
        processAndRenderAll(activeCharacter);
    } catch (err) {
        console.error('Failed to equip item:', err);
        alerter.show('Failed to equip item.', 'error');
    }
}

async function handleUnequip(itemIdToUnequip) {
    if (!activeCharacter || !itemIdToUnequip) return;
    let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
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
    if (activeCharacter.dismissedPassiveSources && activeCharacter.dismissedPassiveSources.includes(itemIdToUnequip)) {
        activeCharacter.dismissedPassiveSources = activeCharacter.dismissedPassiveSources.filter(id => id !== itemIdToUnequip);
    }
    try {
        activeCharacter = await db.updateCharacter(activeCharacter.id, { inventory: newInventory, equipmentSlots: newEquipmentSlots });
        processAndRenderAll(activeCharacter);
    } catch (err) { console.error('Failed to unequip item:', err); alerter.show('Failed to unequip item.', 'error'); }
}

/**
 * NEW: Helper function to clean up dismissed summon records when their source item is unequipped.
 * @param {object} character - The active character object.
 * @param {Array<string>} instanceIdsToPurge - An array of equipment instanceIds that have been unequipped.
 * @returns {Array<string>} The new, filtered list of dismissed passive sources.
 */
function cleanupDismissedOnUnequip(character, instanceIdsToPurge) {
    if (!character.dismissedPassiveSources || !character.dismissedPassiveSources.length || !instanceIdsToPurge || !instanceIdsToPurge.length) {
        return character.dismissedPassiveSources || [];
    }
    
    const idsToPurgeSet = new Set(instanceIdsToPurge);

    return character.dismissedPassiveSources.filter(dismissedId => {
        // We check if any of the instance IDs being unequipped are part of the dismissedId string.
        for (const instanceId of idsToPurgeSet) {
            if (dismissedId.includes(instanceId)) {
                return false; // This dismissed record corresponds to an unequipped item, so we remove it.
            }
        }
        return true; // Keep this dismissed record as its source is still equipped.
    });
}

/**
 * Performs the logic for a given rest type, updating the character's resources.
 * @param {string} restType - The type of rest ('short', 'medium', or 'long').
 */
async function handleRestAction(restType) {
    if (!activeCharacter) return;

    let alertMessage = '';

    // A small helper to clamp a value between 0 and a max.
    const clamp = (value, max) => Math.max(0, Math.min(value, max));

    switch (restType) {
        case 'short': {
            const mana = activeCharacter.resources.find(r => r.id === 'mana');
            if (mana) {
                mana.value = clamp(mana.value + 5, mana.max);
                alertMessage = 'You feel slightly refreshed. (+5 Mana)';
            }
            break;
        }
        case 'medium': {
            const mana = activeCharacter.resources.find(r => r.id === 'mana');
            if (mana) {
                mana.value = clamp(mana.value + 30, mana.max);
                alertMessage = 'You take a moment to recuperate. (+30 Mana)';
            }
            break;
        }
        case 'long': {
            // This will iterate through ALL resources and set their value to their max.
            activeCharacter.resources.forEach(resource => {
                if (resource.max !== undefined) {
                    resource.value = resource.max;
                }
            });
            alertMessage = 'You are fully rested. (All resources restored)';
            break;
        }
        default:
            return; // Exit if the rest type is unknown
    }

    try {
        // Save the updated resources to the database.
        await db.updateCharacter(activeCharacter.id, { resources: activeCharacter.resources });
        // Show a confirmation message.
        alerter.show(alertMessage, 'success');
        // Re-render the entire UI to show the new resource values.
        processAndRenderAll(activeCharacter);
    } catch (err) {
        console.error('Failed to save character state after rest:', err);
        alerter.show('Error saving character after rest.', 'error');
    }
}

/**
 * Sets up the event listeners for the rest buttons.
 */
function initializeRestSystem() {
    const restBtn = document.getElementById('btn-rest');
    const restActionsContainer = document.getElementById('rest-actions-container');
    const restOptionsContainer = document.getElementById('rest-options-container');

    if (!restBtn || !restOptionsContainer || !restActionsContainer) return;

    // A helper function to close the rest menu.
    const closeRestMenu = () => {
        restOptionsContainer.classList.add('hidden');
        restBtn.classList.remove('hidden');
    };

    // When the main "Rest" button is clicked, show the options.
    restBtn.addEventListener('click', (event) => {
        // Stop the click from bubbling up to the document listener we're about to add.
        event.stopPropagation();
        restBtn.classList.add('hidden');
        restOptionsContainer.classList.remove('hidden');
    });

    // When any of the rest option buttons are clicked...
    restOptionsContainer.addEventListener('click', async (event) => {
        const target = event.target;
        if (target.classList.contains('btn-rest-option')) {
            const restType = target.dataset.restType;
            // Perform the rest action.
            await handleRestAction(restType);
            // Reset the UI back to its initial state.
            closeRestMenu();
        }
    });

    // NEW: Add a global click listener to the entire document.
    document.addEventListener('click', (event) => {
        // Check if the rest options are currently visible.
        const isVisible = !restOptionsContainer.classList.contains('hidden');

        // If the menu is visible AND the click was not inside the rest container...
        if (isVisible && !restActionsContainer.contains(event.target)) {
            // ...close the menu.
            closeRestMenu();
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
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
            await processAndRenderAll(activeCharacter);
            initializeRestSystem();

            // Force-save the fully processed character state to ensure data integrity for exports.
            activeCharacter = await db.updateCharacter(activeCharacter.id, activeCharacter);
            console.log('Synchronized character state with database after initial load.');
        } else {
            document.querySelector('.play-content-scrollable').innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
        }

        const contentArea = document.querySelector('.play-content-scrollable');
        contentArea.addEventListener('click', async (event) => {
            if (!activeCharacter) return;
            const target = event.target;
            
            // --- MODIFIED: ABILITY INFO MODAL HANDLER ---
            // This now calls the dedicated showAbilityInfoModal function.
            const infoButton = target.closest('[data-action="show-ability-info"]');
            if (infoButton) {
                const abilityId = infoButton.dataset.abilityId;
                const ability = allAbilities.find(a => a.instancedId === abilityId);
                if (ability) {
                    showAbilityInfoModal(ability);
                }
                return; // Stop further processing
            }

            // The close handler was moved into the show/close functions and is no longer needed here.

            // FIX: Renamed function from handleCostPayment to handleResourceUpdate to reflect its new purpose.
            /**
             * Callback that processes a consolidated object of resource changes from a roll.
             * @param {object} deltas - An object of net resource changes (e.g., { mana: -10, stamina: 5 }).
             * @returns {Array<object>|null} The updated resources array on success, or null on failure.
             */
            const handleResourceUpdate = async (deltas) => {
                try {
                    let needsUpdate = false;
                    for (const resourceId in deltas) {
                        const deltaValue = deltas[resourceId];
                        if (deltaValue === 0) continue;

                        const resource = activeCharacter.resources.find(r => r.id === resourceId);
                        if (resource) {
                            // FIX: The logic is now a simple addition. The delta value is positive for gains
                            // and negative for costs, so adding it to the current value works correctly.
                            // e.g., value = 100, delta = -10 (cost) => 100 + (-10) = 90
                            // e.g., value = 50, delta = 12 (gain) => 50 + 12 = 62
                            resource.value += deltaValue;

                            // Clamp the value to be between 0 and its max, if a max is defined.
                            if (resource.max !== undefined) {
                                resource.value = Math.max(0, Math.min(resource.value, resource.max));
                            } else {
                                resource.value = Math.max(0, resource.value); // Ensure it doesn't go below 0 if no max
                            }
                            needsUpdate = true;
                        }
                    }

                    if (needsUpdate) {
                        const updatedCharacter = await db.updateCharacter(activeCharacter.id, { resources: activeCharacter.resources });
                        activeCharacter.resources = updatedCharacter.resources;
                        return activeCharacter.resources;
                    }
                    return activeCharacter.resources; // Return resources even if no update was needed
                } catch (err) {
                    console.error('Failed to process resource update:', err);
                    alerter.show('Error updating resources.', 'error');
                    return null; // Explicitly return null on failure
                }
            };

            // FIX: Renamed the parameter to onResourceUpdateCallback for clarity.
            const setupAndLaunchRoll = (rollContext, onResourceUpdateCallback) => {
                const { baseRollDef, abilities, damageDef, characterResources, activeEffects } = rollContext;

                // FIX: Enrich the activeEffects with their source names before passing them to the RollManager.
                // This ensures passive effects from perks, flaws, and equipment have the correct display name.
                const enrichedActiveEffects = activeEffects.map(effect => {
                    const sourceAbility = abilities.find(a => a.instancedId === effect.itemId);
                    if (sourceAbility) {
                        return { ...effect, itemName: sourceAbility.definition.name };
                    }
                    return effect;
                });

                const attributeName = baseRollDef.attributeName;
                const attributeContext = { attribute: attributeName };
                const damageTypes = (damageDef?.damage || []).map(d => d.type);
                const damageContext = { damage_types: damageTypes };
                
                const passiveAbilities = [], availableActives = [], availableConditionals = [];

                abilities.forEach(ab => {
                    const isRelevantToAttribute = isAbilityRelevant(ab, 'hope_fear', attributeContext);
                    const isRelevantToDamage = damageDef && isAbilityRelevant(ab, 'damage', damageContext);
                    if (!isRelevantToAttribute && !isRelevantToDamage) return;

                    if (ab.itemType === 'passive') {
                        passiveAbilities.push(ab);
                    } else if (ab.itemType === 'active') {
                        if (ab.definition.condition) {
                            availableConditionals.push(ab);
                        } else {
                            availableActives.push(ab);
                        }
                    }
                });

                const rollDefinitions = [{
                    ...baseRollDef,
                    passiveAbilities,
                    availableActives,
                    availableConditionals,
                    characterResources: characterResources,
                    activeEffects: enrichedActiveEffects
                }];

                if (damageDef) {
                    rollDefinitions.push({
                        groupType: 'damage',
                        label: 'Damage',
                        buttonLabel: 'Roll Damage',
                        rolls: damageDef.damage.map(d => ({ label: d.type, dice: d.dice, baseValue: d.value || 0 }))
                    });
                }
                
                const onRollComplete = () => {
                    processAndRenderAll(activeCharacter);
                };
                
                // FIX: Pass the correctly named callback to the RollManager.
                const rollManager = new RollManager(rollDefinitions, activeAbilityStates, onResourceUpdateCallback, onRollComplete);
                rollManager.show();
            };

            // --- EVENT HANDLERS (All call sites are corrected) ---

            const abilityRollButton = target.closest('.btn-ability-roll');
            if (abilityRollButton) {
                const abilityId = abilityRollButton.dataset.abilityId;
                const ability = allAbilities.find(a => a.instancedId === abilityId);
                const attackEffect = ability?.definition.effect?.find(e => e.type === 'attack');
                if (!attackEffect) return;
                
                const characterAbilities = getCharacterRollAbilities(allAbilities);
                const rollContext = {
                    abilities: characterAbilities,
                    damageDef: attackEffect,
                    characterResources: activeCharacter.resources,
                    activeEffects: mainEffectHandler.activeEffects,
                    baseRollDef: {
                        groupType: 'hope_fear',
                        label: `${ability.definition.name} - Attack Roll`,
                        buttonLabel: 'Roll Attack',
                        attributeName: attackEffect.attribute_bonus,
                        baseValue: activeCharacter.attributes[attackEffect.attribute_bonus] || 0,
                        isAttackRoll: true,
                        cost: ability.definition.cost,
                        // CHANGE: Added hopeBonus configuration
                        hopeBonus: { resourceId: 'mana', maxProperty: 'max', percentage: 10 }
                    }
                };
                // FIX: Pass the new handleResourceUpdate function.
                setupAndLaunchRoll(rollContext, handleResourceUpdate);
                return;
            }
            
            const hopeFearButton = target.closest('.hope-fear-roll-btn');
            if(hopeFearButton) {
                const attributeName = hopeFearButton.dataset.attribute;
                const characterAbilities = getCharacterRollAbilities(allAbilities);
                const rollContext = {
                    abilities: characterAbilities,
                    characterResources: activeCharacter.resources,
                    activeEffects: mainEffectHandler.activeEffects,
                    baseRollDef: {
                        groupType: 'hope_fear',
                        label: `${attributeName.charAt(0).toUpperCase() + attributeName.slice(1)} Check`,
                        buttonLabel: 'Roll Check',
                        attributeName: attributeName,
                        baseValue: activeCharacter.attributes[attributeName] || 0,
                        // CHANGE: Added hopeBonus configuration
                        hopeBonus: { resourceId: 'mana', maxProperty: 'max', percentage: 10 }
                    }
                };
                // FIX: Pass the new handleResourceUpdate function.
                setupAndLaunchRoll(rollContext, handleResourceUpdate);
                return;
            }

            const summonAttrRollBtn = target.closest('.summon-attribute-roll-btn');
            if (summonAttrRollBtn) {
                const instanceId = summonAttrRollBtn.dataset.instanceId;
                const attributeName = summonAttrRollBtn.dataset.attribute;
                const summonInstance = activeCharacter.summonedCreatures.find(s => s.instanceId === instanceId);
                if (!summonInstance) return;
                const summonDef = bestiaryData[summonInstance.creatureId];
                if (!summonDef || !summonDef.attributes) return;

                const allSummonAbilities = [
                    ...(summonDef.abilities?.passive || []).map(p => ({ definition: p, itemType: 'passive' })),
                    ...(summonDef.abilities?.active || []).map(a => ({ definition: a, itemType: 'active' }))
                ];
                const rollContext = {
                    abilities: allSummonAbilities,
                    characterResources: activeCharacter.resources,
                    activeEffects: mainEffectHandler.activeEffects,
                    baseRollDef: {
                        groupType: 'hope_fear',
                        label: `${summonDef.name} - ${attributeName.charAt(0).toUpperCase() + attributeName.slice(1)} Check`,
                        buttonLabel: 'Roll Check',
                        attributeName: attributeName,
                        baseValue: summonDef.attributes[attributeName] || 0,
                        // CHANGE: Added hopeBonus configuration for summon rolls as well.
                        hopeBonus: { resourceId: 'mana', maxProperty: 'max', percentage: 10 }
                    }
                };
                // FIX: Pass the new handleResourceUpdate function.
                setupAndLaunchRoll(rollContext, handleResourceUpdate);
                return;
            }

            const actionButton = target.closest('.btn-action');
            if (actionButton) {
                const instanceId = actionButton.dataset.instanceId;
                const abilityId = actionButton.dataset.abilityId;
                const summonInstance = activeCharacter.summonedCreatures.find(s => s.instanceId === instanceId);
                if (!summonInstance) return;
                const summonDef = bestiaryData[summonInstance.creatureId];
                const abilityDef = summonDef?.abilities?.active?.find(a => a.id === abilityId);
                const attackEffect = abilityDef?.effect?.find(e => e.type === 'attack');
                if (!attackEffect) return;

                const allSummonAbilities = [
                    ...(summonDef.abilities?.passive || []).map(p => ({ definition: p, itemType: 'passive' })),
                    ...(summonDef.abilities?.active || []).map(a => ({ definition: a, itemType: 'active' }))
                ];
                const rollContext = {
                    abilities: allSummonAbilities,
                    damageDef: attackEffect,
                    characterResources: activeCharacter.resources, 
                    activeEffects: mainEffectHandler.activeEffects,
                    baseRollDef: {
                        groupType: 'hope_fear',
                        label: `${abilityDef.name} - Attack Roll`,
                        buttonLabel: 'Roll Attack',
                        attributeName: attackEffect.attribute_bonus,
                        baseValue: summonDef.attributes[attackEffect.attribute_bonus] || 0,
                        isAttackRoll: true,
                        cost: abilityDef.cost,
                        // CHANGE: Added hopeBonus configuration
                        hopeBonus: { resourceId: 'mana', maxProperty: 'max', percentage: 10 }
                    }
                };
                // FIX: Pass the new handleResourceUpdate function.
                setupAndLaunchRoll(rollContext, handleResourceUpdate);
                return;
            }

            const abilityToggleButton = target.closest('.ability-toggle');
            if (abilityToggleButton) {
                const abilityId = abilityToggleButton.dataset.abilityId;
                if (activeAbilityStates.has(abilityId)) activeAbilityStates.delete(abilityId);
                else activeAbilityStates.add(abilityId);
                processAndRenderAll(activeCharacter);
                return;
            }
            
            // --- BUG FIX #2: UNEQUIP SLOT HANDLER ---
            const unequipSlot = target.closest('.equipment-slot.filled');
            if (unequipSlot) {
                const slotId = unequipSlot.dataset.slotId;
                const slotValue = activeCharacter.equipmentSlots[slotId];
                if (!slotValue) return;

                // FIX: Get the item ID *before* changing the slots.
                const itemIdToUnequip = slotValue.itemId || slotValue;
                
                let instanceIdsToPurge = [];
                let newEquipmentSlots = { ...activeCharacter.equipmentSlots };

                if (typeof slotValue === 'object' && slotValue.instanceId) {
                    const instanceIdToRemove = slotValue.instanceId;
                    instanceIdsToPurge.push(instanceIdToRemove);
                    for (const sId in newEquipmentSlots) {
                        if (newEquipmentSlots[sId]?.instanceId === instanceIdToRemove) {
                            newEquipmentSlots[sId] = null;
                        }
                    }
                } else {
                    newEquipmentSlots[slotId] = null;
                }
                
                // FIX: Check if the item is still equipped elsewhere. If not, update the inventory.
                const isStillEquipped = Object.values(newEquipmentSlots).some(val => (val?.itemId || val) === itemIdToUnequip);
                let newInventory = activeCharacter.inventory;
                if (!isStillEquipped) {
                    newInventory = activeCharacter.inventory.map(item =>
                        item.id === itemIdToUnequip ? { ...item, equipped: false } : item
                    );
                }

                const newDismissedSources = cleanupDismissedOnUnequip(activeCharacter, instanceIdsToPurge);

                try {
                    activeCharacter = await db.updateCharacter(activeCharacter.id, {
                        equipmentSlots: newEquipmentSlots,
                        dismissedPassiveSources: newDismissedSources,
                        inventory: newInventory // Pass the updated inventory to the database.
                    });
                    processAndRenderAll(activeCharacter);
                } catch (err) { console.error('Failed to unequip instance:', err); alerter.show('Failed to unequip instance.', 'error'); }
                return;
            }

            const equipButton = target.closest('.btn-equip');
            if (equipButton) {
                const itemId = equipButton.dataset.itemId;
                const itemInstance = activeCharacter.inventory.find(i => i.id === itemId);
                
                if (itemInstance && itemInstance.equipped) {
                    let instanceIdsToPurge = [];
                    let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
                    
                    for(const slotId in activeCharacter.equipmentSlots) {
                        const slotValue = activeCharacter.equipmentSlots[slotId];
                        const idInSlot = slotValue?.itemId || slotValue;
                        if(idInSlot === itemId) {
                            if(slotValue?.instanceId) instanceIdsToPurge.push(slotValue.instanceId);
                            newEquipmentSlots[slotId] = null;
                        }
                    }
                    
                    const newDismissedSources = cleanupDismissedOnUnequip(activeCharacter, instanceIdsToPurge);
                    const newInventory = activeCharacter.inventory.map(item => item.id === itemId ? { ...item, equipped: false } : item);

                    activeCharacter = await db.updateCharacter(activeCharacter.id, {
                        inventory: newInventory,
                        equipmentSlots: newEquipmentSlots,
                        dismissedPassiveSources: newDismissedSources
                    });
                    processAndRenderAll(activeCharacter);
                } 
                else { 
                    await handleEquip(itemId); 
                }
                return;
            }

            const equipStackButton = target.closest('.btn-equip-stack');
            if (equipStackButton) { await handleEquip(equipStackButton.dataset.itemId); return; }

            // --- BUG FIX #2: UNEQUIP STACK HANDLER ---
            const unequipStackButton = target.closest('.btn-unequip-stack');
            if (unequipStackButton) {
                const itemIdToUnequip = unequipStackButton.dataset.itemId;
                const itemDef = equipmentData[itemIdToUnequip];
                let instanceIdToPurge = null;
                let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
                let unequippedSuccessfully = false;

                if (itemDef && activeLayout.layoutConfig.combined_slots[itemDef.equip_slot]) {
                    const instanceIds = Object.values(activeCharacter.equipmentSlots)
                        .filter(v => v?.itemId === itemIdToUnequip && v.instanceId)
                        .map(v => v.instanceId)
                        .sort();
                    if (instanceIds.length > 0) {
                        instanceIdToPurge = instanceIds[instanceIds.length - 1];
                        for (const slotId in newEquipmentSlots) {
                            if (newEquipmentSlots[slotId]?.instanceId === instanceIdToPurge) newEquipmentSlots[slotId] = null;
                        }
                        unequippedSuccessfully = true;
                    }
                } else {
                    const equipSlotType = itemDef?.equip_slot;
                    const instanceSlots = activeLayout.slotMap[equipSlotType] || [];
                    const occupiedSlots = instanceSlots.filter(id => (activeCharacter.equipmentSlots[id]?.itemId || activeCharacter.equipmentSlots[id]) === itemIdToUnequip);
                    
                    if (occupiedSlots.length > 0) {
                        const slotToUnequip = occupiedSlots[occupiedSlots.length - 1];
                        const slotValue = newEquipmentSlots[slotToUnequip];
                        if(slotValue?.instanceId) instanceIdToPurge = slotValue.instanceId;
                        newEquipmentSlots[slotToUnequip] = null;
                        unequippedSuccessfully = true;
                    }
                }
                
                if (unequippedSuccessfully) {
                    // FIX: Add the same inventory update logic here.
                    const isStillEquipped = Object.values(newEquipmentSlots).some(val => (val?.itemId || val) === itemIdToUnequip);
                    let newInventory = activeCharacter.inventory;
                    if (!isStillEquipped) {
                        newInventory = activeCharacter.inventory.map(item =>
                            item.id === itemIdToUnequip ? { ...item, equipped: false } : item
                        );
                    }

                    const newDismissedSources = cleanupDismissedOnUnequip(activeCharacter, instanceIdToPurge ? [instanceIdToPurge] : []);
                    
                    try {
                        activeCharacter = await db.updateCharacter(activeCharacter.id, { 
                            equipmentSlots: newEquipmentSlots, 
                            dismissedPassiveSources: newDismissedSources,
                            inventory: newInventory // Pass updated inventory
                        });
                        processAndRenderAll(activeCharacter);
                    } catch (err) { console.error('Failed to unequip stackable item:', err); alerter.show('Failed to unequip item.', 'error'); }
                }
                return;
            }
            
            const useButton = target.closest('.btn-use');
            if (useButton) alerter.show(`Using ${useButton.dataset.itemName}`, 'info');
            const craftButton = target.closest('.btn-craft');
            if (craftButton) alerter.show('Crafting system not yet implemented.', 'info');

            const dismissButton = target.closest('.btn-dismiss-summon');
            if (dismissButton) {
                const instanceId = dismissButton.dataset.instanceId;
                if (!instanceId) return;
                const summonToDismiss = activeCharacter.summonedCreatures.find(s => s.instanceId === instanceId);
                if (!summonToDismiss) return;
                activeCharacter.dismissedPassiveSources = activeCharacter.dismissedPassiveSources || [];
                const isPassiveSource = ['equipment', 'perk', 'flaw'].includes(summonToDismiss.source.type);
                if (isPassiveSource && !activeCharacter.dismissedPassiveSources.includes(summonToDismiss.source.id)) {
                    activeCharacter.dismissedPassiveSources.push(summonToDismiss.source.id);
                }
                const updatedSummons = activeCharacter.summonedCreatures.filter(s => s.instanceId !== instanceId);
                try {
                    activeCharacter = await db.updateCharacter(activeCharacter.id, { summonedCreatures: updatedSummons, dismissedPassiveSources: activeCharacter.dismissedPassiveSources });
                    processAndRenderAll(activeCharacter);
                } catch (err) { console.error('Failed to dismiss summon:', err); alerter.show('Failed to dismiss summon.', 'error'); }
                return;
            }

            const applySummonHealthBtn = target.closest('.btn-apply-health');
            if (applySummonHealthBtn && applySummonHealthBtn.dataset.entityType === 'character') {
                const healthInput = contentArea.querySelector(`#health-adj-${applySummonHealthBtn.dataset.entityId}`);
                if (!healthInput) return;

                const adjustment = parseInt(healthInput.value, 10);
                if (isNaN(adjustment)) return alerter.show('Invalid input.', 'error');
                
                // Find health within the resources array
                const healthResource = activeCharacter.resources.find(r => r.id === 'health');
                if (!healthResource) return;

                const finalMaxHealth = healthResource.max;
                healthResource.value = Math.max(0, Math.min(healthResource.value + adjustment, finalMaxHealth));
                
                try {
                    activeCharacter = await db.updateCharacter(activeCharacter.id, { resources: activeCharacter.resources });
                    processAndRenderAll(activeCharacter);
                } catch(err) { console.error('Error updating character health:', err); alerter.show('Error updating health.', 'error'); }
            }

            // NEW: This block handles health adjustments for SUMMONS and dismissal at 0 HP.
            if (applySummonHealthBtn && applySummonHealthBtn.dataset.entityType === 'summon') {
                const instanceId = applySummonHealthBtn.dataset.entityId;
                const summonInstance = activeCharacter.summonedCreatures.find(s => s.instanceId === instanceId);
                if (!summonInstance) return;

                const healthInput = contentArea.querySelector(`#health-adj-${instanceId}`);
                if (!healthInput) return;

                const adjustment = parseInt(healthInput.value, 10);
                if (isNaN(adjustment)) return alerter.show('Invalid input. Please use numbers only.', 'error');

                const summonDef = bestiaryData[summonInstance.creatureId];
                if (!summonDef) return;

                // Calculate the summon's new health, clamped between 0 and max.
                const newCurrentHealth = Math.max(0, Math.min(summonInstance.currentHealth + adjustment, summonDef.health.max));

                if (newCurrentHealth === 0) {
                    // If health is 0, dismiss the summon.
                    alerter.show(`${summonDef.name} was defeated and dismissed.`, 'info');
                    
                    // If the summon came from a passive source (perk, equipment), add its source to a 'dismissed' list
                    // to prevent it from being re-summoned automatically on the next render.
                    const isPassiveSource = ['equipment', 'perk', 'flaw'].includes(summonInstance.source.type);
                    activeCharacter.dismissedPassiveSources = activeCharacter.dismissedPassiveSources || [];
                    if (isPassiveSource && !activeCharacter.dismissedPassiveSources.includes(summonInstance.source.id)) {
                        activeCharacter.dismissedPassiveSources.push(summonInstance.source.id);
                    }
                    
                    // Filter the defeated summon out of the active list.
                    activeCharacter.summonedCreatures = activeCharacter.summonedCreatures.filter(s => s.instanceId !== instanceId);

                } else {
                    // If health is above 0, just update the value.
                    summonInstance.currentHealth = newCurrentHealth;
                }

                try {
                    // Save the updated character state to the database.
                    // This will save both the updated health or the filtered summon list.
                    activeCharacter = await db.updateCharacter(activeCharacter.id, { 
                        summonedCreatures: activeCharacter.summonedCreatures,
                        dismissedPassiveSources: activeCharacter.dismissedPassiveSources 
                    });
                    processAndRenderAll(activeCharacter);
                } catch(err) {
                    console.error('Error updating summon health:', err);
                    alerter.show('Error updating summon health.', 'error');
                }
            }
        });

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