// effectHandler.js (Updated)
// This module centralizes the logic for processing and applying character effects.

// REFACTORED: The EffectHandler is now an instantiable class to support independent
// effect processing for the character and, in the future, for individual summons.
export class EffectHandler {
    /**
     * The constructor for the EffectHandler class.
     */
    constructor() {
        // activeEffects is now an instance property, keeping each handler's list separate.
        this.activeEffects = [];
    }

    /**
     * Processes a pre-aggregated list of abilities, plus flaws and perks, to compile their effects.
     * MODIFIED: Corrected the logic to allow processing of abilities even when no character
     * (and thus no perks/flaws) is present, which is necessary for summons.
     * @param {Array<object>} allAbilities - The master list of abilities from the abilityAggregator.
     * @param {object} character - The character object, needed for flaws and perks.
     * @param {object} flawData - A map of all flaw definitions by ID.
     * @param {object} perkData - A map of all perk definitions by ID.
     * @param {Set<string>} activeAbilityStates - A Set of IDs of currently toggled active abilities.
     * @param {string} context - The context in which effects are being processed.
     */
    processActiveAbilities(allAbilities, character, flawData, perkData, activeAbilityStates, context) {
        this.activeEffects = []; // Reset effects for this processing cycle
        
        // This guard clause was incorrect and has been removed.
        // if (!character) return;

        // Process the unified list of all abilities provided to the function.
        // This part does not require a character object and will now run for summons.
        if (allAbilities) {
            allAbilities.forEach(ability => {
                const abilityDef = ability.definition;
                if (!abilityDef || !abilityDef.effect) return;

                const isEffectivelyActive = (ability.itemType === "passive") || (ability.itemType === "active" && activeAbilityStates.has(ability.instancedId));

                if (isEffectivelyActive) {
                    abilityDef.effect.forEach(effect => {
                        this.activeEffects.push({
                            ...effect,
                            itemType: ability.itemType,
                            itemName: abilityDef.name,
                            itemId: ability.instancedId,
                            sourceType: ability.sourceType
                        });
                    });
                }
            });
        }

        // Process Flaws and Perks - this part still requires a character object.
        // It is now wrapped in a conditional to ensure it only runs when a character is passed in.
        if (character) {
            if (character.flaws && flawData) {
                character.flaws.forEach(flawState => {
                    const flawDef = flawData[flawState.id];
                    if (flawDef && flawDef.effect) {
                        flawDef.effect.forEach(effect => {
                            this.activeEffects.push({
                                ...effect,
                                itemName: flawDef.name,
                                itemId: flawState.id,
                                itemType: "passive",
                                sourceType: "flaw"
                            });
                        });
                    }
                });
            }
            if (character.perks && perkData) {
                character.perks.forEach(perkState => {
                    const perkDef = perkData[perkState.id];
                    if (perkDef && perkDef.effect) {
                        perkDef.effect.forEach(effect => {
                            this.activeEffects.push({
                                ...effect,
                                itemName: perkDef.name,
                                itemId: perkState.id,
                                itemType: "passive",
                                sourceType: "perk"
                            });
                        });
                    }
                });
            }
        }

        console.log("EffectHandler: Active Effects Processed for context:", context, this.activeEffects);
    }

    /**
     * Applies all currently active effects to a character object.
     * This method creates a new character object with effects applied.
     * MODIFIED: Now correctly resets activeRollEffects to prevent duplication on re-renders.
     * @param {object} character - The base character object.
     * @param {string} context - The context for applying effects ('wizard' or 'play').
     * @param {Set<string>} activeAbilityStates - A Set of IDs of currently toggled active abilities.
     * @param {object} bestiaryData - The master list of all creature definitions.
     * @returns {object} A new character object with effects applied.
     */
    applyEffectsToCharacter(character, context, activeAbilityStates, bestiaryData = {}) {
        let modifiedCharacter = JSON.parse(JSON.stringify(character)); // Deep clone

        // This makes the returned object a complete package for the renderer.
        modifiedCharacter.activeAbilityIds = activeAbilityStates;

        // Initialize or reset dynamic values that will be recalculated by effects
        if (!modifiedCharacter.calculatedHealth) {
            modifiedCharacter.calculatedHealth = {
                baseMax: modifiedCharacter.health.max,
                currentMax: modifiedCharacter.health.max
            };
        } else {
            modifiedCharacter.calculatedHealth.currentMax = modifiedCharacter.calculatedHealth.baseMax;
        }

        // --- BUG FIX: Reset activeRollEffects to prevent duplication on each processing cycle. ---
        modifiedCharacter.activeRollEffects = {};
        
        modifiedCharacter.summonedCreatures = modifiedCharacter.summonedCreatures || [];
        modifiedCharacter.languages = modifiedCharacter.languages || [];
        modifiedCharacter.statuses = modifiedCharacter.statuses || [];
        modifiedCharacter.tempResources = {};
        modifiedCharacter.temporaryBuffs = modifiedCharacter.temporaryBuffs || [];
        modifiedCharacter.inventory = modifiedCharacter.inventory || [];
        modifiedCharacter.resources = modifiedCharacter.resources || [];
        modifiedCharacter.resistances = modifiedCharacter.resistances || {};
        if (!modifiedCharacter.movement) {
            modifiedCharacter.movement = { base: 0, current: 0 };
        } else {
            modifiedCharacter.movement.current = modifiedCharacter.movement.base;
        }


        this.activeEffects.forEach(effect => {
            switch (effect.type) {
                case "modifier":
                    // Modifiers are handled by getEffectsForAttribute during attribute rolls.
                    break;
                case "language":
                    if (!modifiedCharacter.languages.includes(effect.name)) {
                        modifiedCharacter.languages.push(effect.name);
                    }
                    break;
                case "die_num":
                    if (!modifiedCharacter.activeRollEffects[effect.attribute]) {
                        modifiedCharacter.activeRollEffects[effect.attribute] = [];
                    }
                    modifiedCharacter.activeRollEffects[effect.attribute].push(effect);
                    break;
                case "max_health_mod": {
                    const isPassiveEffect = effect.itemType === 'passive';

                    if (context === 'wizard' && isPassiveEffect) {
                        if (modifiedCharacter.calculatedHealth) {
                            modifiedCharacter.calculatedHealth.currentMax += effect.value;
                        }
                    } else if (context === 'play') {
                        if (effect.itemType === 'active' || (isPassiveEffect && (effect.sourceType === 'equipment' || effect.sourceType === 'perk' || effect.sourceType === 'flaw'))) {
                            if (modifiedCharacter.calculatedHealth) {
                                modifiedCharacter.calculatedHealth.currentMax += effect.value;
                            }
                        }
                    }
                    break;
                }
                
                case "summon_creature": {
                    // First, check if this summon's source has been manually dismissed by the user.
                    if (modifiedCharacter.dismissedPassiveSources && modifiedCharacter.dismissedPassiveSources.includes(effect.itemId)) {
                        break; // If so, do not process this effect.
                    }

                    const creatureDef = bestiaryData[effect.creatureId];
                    if (!creatureDef) {
                        console.warn(`Summon effect failed: Creature ID "${effect.creatureId}" not found in bestiary.`);
                        break;
                    }

                    // For passive effects, we only want to add the summon once.
                    // This check prevents re-adding a summon from the same source on every processing pass.
                    const alreadySummoned = modifiedCharacter.summonedCreatures.some(s => s.source.id === effect.itemId);
                    if (alreadySummoned) {
                        break;
                    }

                    const isPassiveSummon = effect.itemType === 'passive';
                    let shouldSummon = false;

                    // This conditional logic mirrors the `max_health_mod` rules for when an effect should apply.
                    if (context === 'wizard' && isPassiveSummon) {
                        shouldSummon = true;
                    } else if (context === 'play') {
                        if (effect.itemType === 'active' || (isPassiveSummon && (effect.sourceType === 'equipment' || effect.sourceType === 'perk' || effect.sourceType === 'flaw'))) {
                            shouldSummon = true;
                        }
                    }

                    if (shouldSummon) {
                        const newSummon = {
                            instanceId: `${effect.creatureId}_${Date.now()}`,
                            creatureId: effect.creatureId,
                            currentHealth: creatureDef.health.max,
                            source: {
                                type: effect.sourceType,
                                id: effect.itemId
                            }
                        };
                        modifiedCharacter.summonedCreatures.push(newSummon);
                    }
                    break;
                }
                // NEW: Handles effects that modify the max value of a resource.
                case "max_resource_mod": {
                    if (!modifiedCharacter.resources) modifiedCharacter.resources = [];
                    // Find the resource by its 'id' (e.g., "mana")
                    let resource = modifiedCharacter.resources.find(r => r.id === effect.resource);
            
                    // If the resource doesn't exist on the character, create it.
                    if (!resource) {
                        const resourceName = effect.resource.charAt(0).toUpperCase() + effect.resource.slice(1);
                        resource = {
                            id: effect.resource,
                            displayName: resourceName,
                            value: 0, // Start with a base value
                            max: 0
                        };
                        modifiedCharacter.resources.push(resource);
                    }
                    
                    // Apply the bonus from the effect.
                    resource.max += effect.value;

                    // During character creation, also set the current value to the new max.
                    if (context === 'wizard') {
                        resource.value = resource.max;
                    }
                    break;
                }

                case "temporary_buff":
                    modifiedCharacter.temporaryBuffs.push(effect);
                    break;
                case "inventory_item":
                    const existingItem = modifiedCharacter.inventory.find(item => item.name === effect.name);
                    if (existingItem) {
                        existingItem.quantity = (existingItem.quantity || 1) + (effect.quantity || 1);
                    } else {
                        modifiedCharacter.inventory.push({ name: effect.name, quantity: effect.quantity || 1 });
                    }
                    break;
                case "status":
                    if (!modifiedCharacter.statuses.some(s => s.name === effect.name)) {
                        modifiedCharacter.statuses.push({ name: effect.name, duration: effect.duration, appliedAt: Date.now() });
                    }
                    break;
                default:
                    // console.warn(`EffectHandler: Unknown effect type encountered: ${effect.type}`, effect);
            }
        });
        return modifiedCharacter; // Return the character with applied effects
    }

    /**
     * Filters active effects for a specific attribute and/or effect type.
     * @param {string} attributeName - The name of the attribute (e.g., 'strength', 'luck').
     * @param {string} [effectType=null] - Optional: The type of effect to filter by.
     * @returns {Array<object>} An array of filtered effect objects.
     */
    getEffectsForAttribute(attributeName, effectType = null) {
        return this.activeEffects.filter(effect => {
            const targetsAttribute = effect.attribute && effect.attribute.toLowerCase() === attributeName;
            const matchesType = effectType ? effect.type === effectType : true;
            return targetsAttribute && matchesType;
        });
    }

    /**
     * Calculates the final value of an attribute by adding all active numerical modifiers.
     * @param {string} attributeName - The name of the attribute to calculate.
     * @param {number} baseValue - The character's base value for that attribute.
     * @returns {number} The final, combined value of the attribute.
     */
    getCombinedAttributeValue(attributeName, baseValue) {
        const numericalModifiers = this.getEffectsForAttribute(attributeName, 'modifier');
        const totalModifier = numericalModifiers.reduce((sum, effect) => sum + (effect.modifier || 0), 0);
        return baseValue + totalModifier;
    }

    /**
     * Processes all active effects to find and aggregate equipment slot modifications.
     * @param {Array<object>} allActiveEffects - The full list of currently active effects.
     * @returns {object} A summary object with the net changes to the equipment layout.
     */
    processLayoutEffects(allActiveEffects) {
        const summary = {
            slotMods: {},
            categoriesToAdd: {},
            categoriesToRemove: []
        };
        const slugify = (str) => str.toLowerCase().replace(/\s+/g, '_');

        // --- Process Additions First ---
        allActiveEffects.forEach(effect => {
            if (effect.type === 'add_equip_category') {
                const key = slugify(effect.name);
                if (!summary.categoriesToAdd[key]) {
                    summary.categoriesToAdd[key] = {
                        name: effect.name,
                        slots: []
                    };
                }
                summary.categoriesToAdd[key].slots.push(...effect.slots.map(slugify));
            }
            if (effect.type === 'equip_slot' && effect.value > 0) {
                const key = `${slugify(effect.category)}_${slugify(effect.slot)}`;
                summary.slotMods[key] = (summary.slotMods[key] || 0) + effect.value;
            }
        });

        // --- Then Process Removals ---
        allActiveEffects.forEach(effect => {
            if (effect.type === 'remove_equip_category') {
                summary.categoriesToRemove.push(slugify(effect.name));
            }
            if (effect.type === 'equip_slot' && effect.value < 0) {
                const key = `${slugify(effect.category)}_${slugify(effect.slot)}`;
                summary.slotMods[key] = (summary.slotMods[key] || 0) + effect.value;
            }
        });

        console.log('Summary of equipment slots: ', summary);

        return summary;
    }
};