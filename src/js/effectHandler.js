// effectHandler.js
// This module centralizes the logic for processing and applying character effects
// derived from abilities and flaws.

export const EffectHandler = {
    // Stores currently active effects that influence character stats or state
    activeEffects: [], // This will be a list of processed effects, not just raw ability effects

    /**
     * Processes active abilities and flaws to compile their effects.
     * This function should be called whenever character state might change (e.g., ability toggle, character load).
     * @param {object} character - The character object containing abilities and flaws.
     * @param {object} abilityData - A map of all ability definitions by ID.
     * @param {object} flawData - A map of all flaw definitions by ID.
     * @param {Set<string>} activeAbilityStates - A Set of IDs of currently toggled active abilities.
     */
    processActiveAbilities: function(character, abilityData, flawData, activeAbilityStates) {
        this.activeEffects = []; // Clear previous active effects

        if (!character) return;

        // Process Abilities
        if (character.abilities) {
            character.abilities.forEach(abilityState => {
                const abilityDef = abilityData[abilityState.id];
                if (abilityDef && abilityDef.effect) {
                    // An ability is 'active' if it's passive, or if it's an active ability AND its ID is in activeAbilityStates
                    const isActive = (abilityDef.type === "passive") || (abilityDef.type === "active" && activeAbilityStates.has(abilityState.id));

                    if (isActive) {
                        abilityDef.effect.forEach(effect => {
                            // Store the raw effect data along with context
                            this.activeEffects.push({
                                ...effect,
                                abilityName: abilityDef.name,
                                abilityId: abilityState.id, // Include ability ID for cost deduction
                                abilityType: abilityDef.type,
                                sourceType: "ability" // Indicate source is an ability
                            });
                        });
                    }
                }
            });
        }

        // Process Flaws (treated as virtual passive abilities for effect handling)
        if (character.flaws && flawData) {
            character.flaws.forEach(flawState => {
                const flawDef = flawData[flawState.id];
                if (flawDef && flawDef.effect) {
                    flawDef.effect.forEach(effect => {
                        this.activeEffects.push({
                            ...effect,
                            abilityName: flawDef.name, // Use flaw name for context
                            abilityId: flawState.id, // Include flaw ID
                            abilityType: "passive", // Treat functionally as passive for effect processing
                            sourceType: "flaw" // Indicate source is a flaw
                        });
                    });
                }
            });
        }
        console.log("EffectHandler: Active Effects Processed", this.activeEffects);
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
     * Applies all currently active effects to a character object.
     * This function creates a new character object with effects applied,
     * it does NOT modify the original character object.
     * @param {object} character - The base character object.
     * @returns {object} A new character object with effects applied.
     */
    applyEffectsToCharacter: function(character) {
        let modifiedCharacter = JSON.parse(JSON.stringify(character)); // Deep clone to avoid direct mutation

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
                    // This effect modifies the character's *maximum* health
                    // It should apply regardless of ability type (passive/active) as it's an inherent effect
                    if (modifiedCharacter.calculatedHealth) { // Ensure calculatedHealth is initialized
                        modifiedCharacter.calculatedHealth.currentMax += effect.value;
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
