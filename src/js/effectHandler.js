// effectHandler.js (Updated)
// This module centralizes the logic for processing and applying character effects.

export const EffectHandler = {
    activeEffects: [],

    /**
     * Processes a pre-aggregated list of abilities, plus flaws and perks, to compile their effects.
     * UPDATED: Now uses the new top-level itemType property from the aggregated ability objects.
     * @param {Array<object>} allAbilities - The master list of abilities from the abilityAggregator.
     * @param {object} character - The character object, needed for flaws and perks.
     * @param {object} flawData - A map of all flaw definitions by ID.
     * @param {object} perkData - A map of all perk definitions by ID.
     * @param {Set<string>} activeAbilityStates - A Set of IDs of currently toggled active abilities.
     * @param {string} context - The context in which effects are being processed.
     */
    processActiveAbilities: function(allAbilities, character, flawData, perkData, activeAbilityStates, context) {
        this.activeEffects = [];
        if (!character) return;

        // Process the unified list of all abilities
        if (allAbilities) {
            allAbilities.forEach(ability => {
                const abilityDef = ability.definition;
                if (!abilityDef || !abilityDef.effect) return;

                // UPDATED: Check the top-level `ability.itemType` property now, not ability.definition.type
                const isEffectivelyActive = (ability.itemType === "passive") || (ability.itemType === "active" && activeAbilityStates.has(ability.instancedId));

                if (isEffectivelyActive) {
                    abilityDef.effect.forEach(effect => {
                        // UPDATED: Add the itemType to the effect object for later use.
                        this.activeEffects.push({
                            ...effect,
                            itemType: ability.itemType, // Pass the type ('active' or 'passive') along
                            itemName: abilityDef.name,
                            itemId: ability.instancedId,
                            sourceType: ability.sourceType
                        });
                    });
                }
            });
        }

        // Process Flaws and Perks (This logic is unchanged)
        if (character.flaws && flawData) {
            character.flaws.forEach(flawState => {
                const flawDef = flawData[flawState.id];
                if (flawDef && flawDef.effect) {
                    flawDef.effect.forEach(effect => {
                        this.activeEffects.push({
                            ...effect,
                            itemName: flawDef.name,
                            itemId: flawState.id,
                            itemType: "passive", // Treat functionally as passive
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
                            itemType: "passive", // Treat functionally as passive
                            sourceType: "perk"
                        });
                    });
                }
            });
        }

        console.log("EffectHandler: Active Effects Processed for context:", context, this.activeEffects);
    },

    /**
     * Filters active effects for a specific attribute and/or effect type.
     * @param {string} attributeName - The name of the attribute (e.g., 'strength', 'luck').
     * @param {string} [effectType=null] - Optional: The type of effect to filter by (e.g., 'modifier', 'language').
     * @returns {Array<object>} An array of filtered effect objects.
     */
    getEffectsForAttribute: function(attributeName, effectType = null) {
        return this.activeEffects.filter(effect => {
            const targetsAttribute = effect.attribute && effect.attribute.toLowerCase() === attributeName;
            const matchesType = effectType ? effect.type === effectType : true;
            return targetsAttribute && matchesType;
        });
    },

    /**
     * NEW: Calculates the final value of an attribute by adding all active numerical modifiers.
     * @param {string} attributeName - The name of the attribute to calculate.
     * @param {number} baseValue - The character's base value for that attribute.
     * @returns {number} The final, combined value of the attribute.
     */
    getCombinedAttributeValue: function(attributeName, baseValue) {
        const numericalModifiers = this.getEffectsForAttribute(attributeName, 'modifier');
        const totalModifier = numericalModifiers.reduce((sum, effect) => sum + (effect.modifier || 0), 0);
        return baseValue + totalModifier;
    },

    /**
     * Applies all currently active effects to a character object.
     * This function creates a new character object with effects applied,
     * it does NOT modify the original character object.
     * @param {object} character - The base character object.
     * @param {string} context - The context for applying effects ('wizard' or 'play').
     * @returns {object} A new character object with effects applied.
     */
    applyEffectsToCharacter: function(character, context, activeAbilityStates) {
        let modifiedCharacter = JSON.parse(JSON.stringify(character)); // Deep clone to avoid direct mutation

        // This makes the returned object a complete package for the renderer.
        modifiedCharacter.activeAbilityIds = activeAbilityStates;

        // Initialize or reset dynamic values that will be recalculated by effects
        // Store base max health if not already present, to allow modifications
        if (!modifiedCharacter.calculatedHealth) {
            modifiedCharacter.calculatedHealth = {
                baseMax: modifiedCharacter.health.max,
                currentMax: modifiedCharacter.health.max
            };
        } else {
            // Reset currentMax to baseMax for recalculation
            modifiedCharacter.calculatedHealth.currentMax = modifiedCharacter.calculatedHealth.baseMax;
        }

        modifiedCharacter.tempResources = {}; // Clear temporary resources for recalculation
        modifiedCharacter.languages = modifiedCharacter.languages || []; // Ensure languages array exists
        modifiedCharacter.activeRollEffects = modifiedCharacter.activeRollEffects || {}; // Ensure object exists
        modifiedCharacter.temporaryBuffs = modifiedCharacter.temporaryBuffs || []; // Ensure array exists
        modifiedCharacter.inventory = modifiedCharacter.inventory || []; // Ensure inventory array exists
        modifiedCharacter.summonedCreatures = modifiedCharacter.summonedCreatures || []; // Ensure array exists
        modifiedCharacter.statuses = modifiedCharacter.statuses || []; // Ensure array exists
        modifiedCharacter.resources = modifiedCharacter.resources || []; // Ensure array exists
        modifiedCharacter.resistances = modifiedCharacter.resistances || {}; // Ensure object exists
        if (!modifiedCharacter.movement) {
            modifiedCharacter.movement = { base: 0, current: 0 };
        } else {
            modifiedCharacter.movement.current = modifiedCharacter.movement.base; // Reset for recalculation
        }


        this.activeEffects.forEach(effect => {
            switch (effect.type) {
                case "modifier":
                    // Modifiers are handled by getEffectsForAttribute during attribute rolls,
                    // so no direct change to modifiedCharacter is needed here for this type.
                    break;
                case "language":
                    if (!modifiedCharacter.languages.includes(effect.name)) {
                        modifiedCharacter.languages.push(effect.name);
                    }
                    break;
                case "die_num":
                    // Logic to adjust character's rolling capabilities (e.g., add advantage/disadvantage dice)
                    if (!modifiedCharacter.activeRollEffects[effect.attribute]) {
                        modifiedCharacter.activeRollEffects[effect.attribute] = [];
                    }
                    modifiedCharacter.activeRollEffects[effect.attribute].push(effect);
                    break;
                case "max_health_mod":
                    // Apply max_health_mod based on itemType and context
                    // If source is a flaw or perk, it's always considered 'passive' for this effect,
                    // applying in 'wizard' context as per your requirement.
                    // Existing abilities still use their specific type (active/passive).
                    const isPassiveEffect = effect.itemType === 'passive'; // Simplified check

                    if (context === 'wizard' && isPassiveEffect) {
                        if (modifiedCharacter.calculatedHealth) {
                            modifiedCharacter.calculatedHealth.currentMax += effect.value;
                        }
                    } else if (context === 'play') {
                        // Apply effect if ability is active OR if it's a passive effect from equipment
                        if (effect.itemType === 'active' || (isPassiveEffect && effect.sourceType === 'equipment')) {
                            if (modifiedCharacter.calculatedHealth) {
                                modifiedCharacter.calculatedHealth.currentMax += effect.value;
                            }
                        }
                    }
                    break;
                case "temporary_buff":
                    // Adds a temporary buff that might affect stats for a duration
                    modifiedCharacter.temporaryBuffs.push(effect);
                    break;
                case "inventory_item":
                    // Adds items to the character's inventory
                    const existingItem = modifiedCharacter.inventory.find(item => item.name === effect.name);
                    if (existingItem) {
                        existingItem.quantity = (existingItem.quantity || 1) + (effect.quantity || 1);
                    } else {
                        modifiedCharacter.inventory.push({ name: effect.name, quantity: effect.quantity || 1 });
                    }
                    break;
                case "trigger_event":
                    // Represents an event to be triggered in game logic (e.g., 'gain_xp', 'cast_spell')
                    console.log(`EffectHandler: Triggering event: ${effect.eventName}`);
                    // Actual event dispatching would happen in game loop/manager
                    break;
                case "summon_creature":
                    // Adds a summoned creature to the character's active summons
                    modifiedCharacter.summonedCreatures.push({ name: effect.creatureName, stats: effect.stats });
                    break;
                case "deal_damage":
                    // Applies damage to the character (requires a target context in a full game)
                    // For simplicity, if applied to self, deduct from current health
                    modifiedCharacter.health.current = Math.max(0, modifiedCharacter.health.current - effect.value);
                    break;
                case "healing":
                    // Applies healing to the character
                    modifiedCharacter.health.current = Math.min(modifiedCharacter.health.current + effect.value, modifiedCharacter.calculatedHealth.currentMax);
                    break;
                case "status":
                    // Applies a status effect (e.g., 'poisoned', 'blessed')
                    if (!modifiedCharacter.statuses.some(s => s.name === effect.name)) { // Prevent duplicates
                        modifiedCharacter.statuses.push({ name: effect.name, duration: effect.duration, appliedAt: Date.now() });
                    }
                    break;
                case "resource_mod":
                    // Modifies resource pools (e.g., 'mana', 'stamina')
                    let resource = modifiedCharacter.resources.find(r => r.type === effect.resource);
                    if (resource) {
                        resource.value += effect.value;
                        if (resource.max !== undefined && resource.value > resource.max) {
                            resource.value = resource.max;
                        }
                        if (resource.value < 0) resource.value = 0;
                    } else {
                        modifiedCharacter.resources.push({ type: effect.resource, value: effect.value, max: effect.max });
                    }
                    break;
                case "resistance_mod":
                    // Adds or modifies damage resistances
                    if (!modifiedCharacter.resistances[effect.damageType]) {
                        modifiedCharacter.resistances[effect.damageType] = 0;
                    }
                    modifiedCharacter.resistances[effect.damageType] += effect.value; // Additive resistances
                    break;
                case "movement_mod":
                    // Modifies character's movement speed
                    modifiedCharacter.movement.current += effect.value;
                    break;
                default:
                    console.warn(`EffectHandler: Unknown effect type encountered: ${effect.type}`, effect);
            }
        });
        return modifiedCharacter; // Return the character with applied effects
    }
};
