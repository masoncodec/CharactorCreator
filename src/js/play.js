// play.js (Corrected and Final)
import { EffectHandler } from './effectHandler.js';
import { loadGameModules, loadDataForModule } from './dataLoader.js';
import { alerter } from './alerter.js';
import { RollManager } from './RollManager.js';
import { renderTopNav, renderMainTab, renderAbilitiesTab, renderProfileTab, renderInventoryTab, renderEquipmentTab, renderSummonsPanel, EQUIPMENT_SLOT_CONFIG, getEquippedCount, findTargetSlots } from './play-ui.js';
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
    
    // 1. Instantiate handler and process all active effects.
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
    
    // 5. DYNAMIC HEALTH LOGIC.
    const previousMaxHealthBonus = reconciledCharacter.lastMaxHealthBonus ?? 0;
    const newMaxHealthBonus = mainEffectHandler.activeEffects.filter(e => e.type === 'max_health_mod' && (e.itemType === 'active' || (e.itemType === 'passive' && ['equipment', 'perk', 'flaw'].includes(e.sourceType)))).reduce((sum, e) => sum + e.value, 0);
    const bonusChange = newMaxHealthBonus - previousMaxHealthBonus;
    if (bonusChange !== 0) {
        reconciledCharacter.health.current = Math.max(0, (reconciledCharacter.health.current ?? 0) + bonusChange);
    }
    reconciledCharacter.lastMaxHealthBonus = newMaxHealthBonus;
    
    // 6. Apply all other effects.
    const effectedCharacter = mainEffectHandler.applyEffectsToCharacter(reconciledCharacter, 'play', activeAbilityStates, bestiaryData);
    
    // 7. Store layout globally.
    activeLayout = { layoutConfig, slotMap };
    
    // --- FINAL STATE UPDATE ---
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
    
    const equipmentItems = effectedCharacter.inventory.map(item => { const def = equipmentData[item.id]; if (!def || def.type !== 'equipment') return null; const full = { ...item, definition: def }; if (item.quantity > 1) { full.equippedCount = getEquippedCount(item.id, effectedCharacter, equipmentData, layoutConfig); } return full; }).filter(Boolean);
        
    // --- RENDER EVERYTHING ---
    renderTopNav(effectedCharacter, moduleDefinitions);
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
        } else {
            document.querySelector('.play-content-scrollable').innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
        }

        const contentArea = document.querySelector('.play-content-scrollable');
        contentArea.addEventListener('click', async (event) => {
            if (!activeCharacter) return;
            const target = event.target;

            // --- Generic Roll Handler Logic ---
            const setupAndLaunchRoll = (sourceAbilities, baseRollDef, damageDef = null) => {
                const attributeName = baseRollDef.attributeName;
                const attributeContext = { attribute: attributeName };
                const damageTypes = (damageDef?.damage || []).map(d => d.type);
                const damageContext = { damage_types: damageTypes };

                // Combine abilities, perks, and flaws into one list for processing.
                const allPotentialModifiers = [...sourceAbilities];

                (activeCharacter.perks || []).forEach(perkState => {
                    const perkDef = perkData[perkState.id];
                    if (perkDef) {
                        allPotentialModifiers.push({
                            definition: perkDef,
                            itemType: 'passive',
                            sourceType: 'perk',
                            sourceName: perkDef.name,
                            instancedId: perkState.id
                        });
                    }
                });

                (activeCharacter.flaws || []).forEach(flawState => {
                    const flawDef = flawData[flawState.id];
                    if (flawDef) {
                        allPotentialModifiers.push({
                            definition: flawDef,
                            itemType: 'passive',
                            sourceType: 'flaw',
                            sourceName: flawDef.name,
                            instancedId: flawState.id
                        });
                    }
                });
                
                // Filter the combined list for relevance.
                const passiveAbilities = [];
                const availableActives = [];
                const availableConditionals = [];

                allPotentialModifiers.forEach(ab => {
                    const isRelevantToAttribute = isAbilityRelevant(ab, 'hope_fear', attributeContext);
                    const isRelevantToDamage = damageTypes.length > 0 && isAbilityRelevant(ab, 'damage', damageContext);
                    
                    if (!isRelevantToAttribute && !isRelevantToDamage) return;

                    if (ab.definition.condition) {
                        availableConditionals.push(ab);
                    } else if (ab.itemType === 'active') {
                        availableActives.push(ab);
                    } else {
                        passiveAbilities.push(ab);
                    }
                });

                const rollDefinitions = [{
                    ...baseRollDef,
                    passiveAbilities,
                    availableActives,
                    availableConditionals,
                }];

                if (damageDef) {
                    rollDefinitions.push({
                        groupType: 'damage',
                        label: 'Damage',
                        rolls: damageDef.damage.map(d => ({ label: d.type, dice: d.dice, baseValue: d.value || 0 }))
                    });
                }

                const rollManager = new RollManager(rollDefinitions, activeAbilityStates);
                rollManager.show();
            };

            // --- EVENT HANDLERS ---

            const abilityRollButton = target.closest('.btn-ability-roll');
            if (abilityRollButton) {
                const abilityId = abilityRollButton.dataset.abilityId;
                const ability = allAbilities.find(a => a.instancedId === abilityId);
                if (!ability?.definition.effect) return;

                const attackEffect = ability.definition.effect.find(e => e.type === 'attack');
                if (!attackEffect) return;

                const baseRollDef = {
                    groupType: 'hope_fear',
                    label: `${ability.definition.name} - Attack Roll`,
                    attributeName: attackEffect.attribute_bonus,
                    baseValue: activeCharacter.attributes[attackEffect.attribute_bonus] || 0,
                };

                setupAndLaunchRoll(allAbilities, baseRollDef, attackEffect);
                return;
            }
            
            const hopeFearButton = target.closest('.hope-fear-roll-btn');
            if(hopeFearButton) {
                const attributeName = hopeFearButton.dataset.attribute;
                const baseRollDef = {
                    groupType: 'hope_fear',
                    label: `${attributeName.charAt(0).toUpperCase() + attributeName.slice(1)} Check`,
                    attributeName: attributeName,
                    baseValue: activeCharacter.attributes[attributeName] || 0,
                };
                setupAndLaunchRoll(allAbilities, baseRollDef);
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
                if (!attackEffect) return;
                const allSummonAbilities = [...(summonDef.abilities.passive || []).map(p => ({ definition: p, itemType: 'passive' })), ...(summonDef.abilities.active || []).map(a => ({ definition: a, itemType: 'active' }))];
                const baseRollDef = {
                    groupType: 'hope_fear',
                    label: `${abilityDef.name} - Attack Roll`,
                    attributeName: attackEffect.attribute_bonus,
                    baseValue: summonDef.attributes[attackEffect.attribute_bonus] || 0,
                };
                setupAndLaunchRoll(allSummonAbilities, baseRollDef, attackEffect);
                return;
            }
            
            const unequipSlot = target.closest('.equipment-slot.filled');
            if (unequipSlot) {
                const slotId = unequipSlot.dataset.slotId;
                const slotValue = activeCharacter.equipmentSlots[slotId];
                if (!slotValue) return;
                if (typeof slotValue === 'object' && slotValue.instanceId) {
                    const instanceIdToRemove = slotValue.instanceId;
                    let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
                    for (const sId in newEquipmentSlots) {
                        if (newEquipmentSlots[sId]?.instanceId === instanceIdToRemove) {
                            newEquipmentSlots[sId] = null;
                        }
                    }
                    try {
                        activeCharacter = await db.updateCharacter(activeCharacter.id, { equipmentSlots: newEquipmentSlots });
                        processAndRenderAll(activeCharacter);
                    } catch (err) { console.error('Failed to unequip instance:', err); alerter.show('Failed to unequip instance.', 'error'); }
                } else {
                    const itemIdToUnequip = slotValue;
                    let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
                    let newInventory = [...activeCharacter.inventory];
                    newEquipmentSlots[slotId] = null;
                    const isStillEquippedElsewhere = Object.values(newEquipmentSlots).includes(itemIdToUnequip);
                    if (!isStillEquippedElsewhere) {
                        newInventory = newInventory.map(item => item.id === itemIdToUnequip ? { ...item, equipped: false } : item);
                    }
                    try {
                        activeCharacter = await db.updateCharacter(activeCharacter.id, { inventory: newInventory, equipmentSlots: newEquipmentSlots });
                        processAndRenderAll(activeCharacter);
                    } catch (err) { console.error('Failed to unequip from slot:', err); alerter.show('Failed to unequip from slot.', 'error'); }
                }
                return;
            }

            const equipButton = target.closest('.btn-equip');
            if (equipButton) {
                const itemId = equipButton.dataset.itemId;
                const itemInstance = activeCharacter.inventory.find(i => i.id === itemId);
                if (itemInstance && itemInstance.equipped) { await handleUnequip(itemId); } 
                else { await handleEquip(itemId); }
                return;
            }

            const equipStackButton = target.closest('.btn-equip-stack');
            if (equipStackButton) { await handleEquip(equipStackButton.dataset.itemId); return; }

            const unequipStackButton = target.closest('.btn-unequip-stack');
            if (unequipStackButton) {
                const itemId = unequipStackButton.dataset.itemId;
                const itemDef = equipmentData[itemId];
                if (itemDef && activeLayout.layoutConfig.combined_slots[itemDef.equip_slot]) {
                    const equippedInstances = {};
                    for (const slotId in activeCharacter.equipmentSlots) {
                        const slotValue = activeCharacter.equipmentSlots[slotId];
                        if (slotValue?.itemId === itemId && slotValue.instanceId) {
                            if (!equippedInstances[slotValue.instanceId]) equippedInstances[slotValue.instanceId] = [];
                            equippedInstances[slotValue.instanceId].push(slotId);
                        }
                    }
                    const instanceIds = Object.keys(equippedInstances);
                    if (instanceIds.length > 0) {
                        instanceIds.sort();
                        const instanceIdToRemove = instanceIds[instanceIds.length - 1];
                        let newEquipmentSlots = { ...activeCharacter.equipmentSlots };
                        for (const slotId in newEquipmentSlots) {
                            if (newEquipmentSlots[slotId]?.instanceId === instanceIdToRemove) newEquipmentSlots[slotId] = null;
                        }
                        try {
                            activeCharacter = await db.updateCharacter(activeCharacter.id, { equipmentSlots: newEquipmentSlots });
                            processAndRenderAll(activeCharacter);
                        } catch (err) { console.error('Failed to unequip multi-slot stackable instance:', err); alerter.show('Failed to unequip instance.', 'error'); }
                    }
                } else {
                    const equipSlotType = itemDef?.equip_slot;
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
            if (applySummonHealthBtn && applySummonHealthBtn.dataset.entityType === 'summon') {
                const instanceId = applySummonHealthBtn.dataset.entityId;
                const healthInput = contentArea.querySelector(`#health-adj-${instanceId}`);
                const summon = activeCharacter.summonedCreatures.find(s => s.instanceId === instanceId);
                if (!summon || !healthInput) return;
                const summonDef = bestiaryData[summon.creatureId];
                if (!summonDef) return;
                if (healthInput.value.trim() === '') return alerter.show('Please enter a health adjustment value (e.g., -5, 10).', 'info');
                const adjustment = parseInt(healthInput.value, 10);
                if (isNaN(adjustment)) return alerter.show('Invalid input. Please use numbers only.', 'error');
                const newCurrentHealth = Math.max(0, Math.min(summon.currentHealth + adjustment, summonDef.health.max));
                if (newCurrentHealth === 0) {
                    alerter.show(`${summonDef.name} was defeated and dismissed.`, 'info');
                    const isPassiveSource = ['equipment', 'perk', 'flaw'].includes(summon.source.type);
                    activeCharacter.dismissedPassiveSources = activeCharacter.dismissedPassiveSources || [];
                    if (isPassiveSource && !activeCharacter.dismissedPassiveSources.includes(summon.source.id)) {
                        activeCharacter.dismissedPassiveSources.push(summon.source.id);
                    }
                    activeCharacter.summonedCreatures = activeCharacter.summonedCreatures.filter(s => s.instanceId !== instanceId);
                } else {
                    summon.currentHealth = newCurrentHealth;
                }
                try {
                    activeCharacter = await db.updateCharacter(activeCharacter.id, { summonedCreatures: activeCharacter.summonedCreatures, dismissedPassiveSources: activeCharacter.dismissedPassiveSources });
                    processAndRenderAll(activeCharacter);
                } catch(err) { console.error('Error updating summon state:', err); alerter.show('Error updating summon state.', 'error'); }
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
                    const newHealthObject = { ...activeCharacter.health, current: newCurrentHealth };
                    activeCharacter = await db.updateCharacter(activeCharacter.id, { health: newHealthObject, lastMaxHealthBonus: activeCharacter.lastMaxHealthBonus });
                    processAndRenderAll(activeCharacter);
                } catch(err) { console.error('Error updating character health:', err); alerter.show('Error updating health.', 'error'); }
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