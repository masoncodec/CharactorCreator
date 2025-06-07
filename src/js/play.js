// play.js

// In a new file, e.g., effectHandler.js (or within play.js for now, but separation is better long-term)

const EffectHandler = {
    // Stores currently active effects that influence character stats or state
    activeEffects: [], // This will be a list of processed effects, not just raw ability effects

    // This function will be called whenever character state might change (e.g., ability toggle, character load)
    // It processes all active abilities and compiles their effects
    processActiveAbilities: function(character, abilityData, flawData, activeAbilityStates) {
        this.activeEffects = []; // Clear previous active effects

        if (!character) return;

        // Process Abilities
        if (character.abilities) {
            character.abilities.forEach(abilityState => {
                const abilityDef = abilityData[abilityState.id];
                if (abilityDef && abilityDef.effect) {
                    const isActive = (abilityDef.type === "passive") || (abilityDef.type === "active" && activeAbilityStates.has(abilityState.id));

                    if (isActive) {
                        abilityDef.effect.forEach(effect => {
                            // Store the raw effect data along with the ability name for context
                            this.activeEffects.push({
                                ...effect,
                                abilityName: abilityDef.name,
                                abilityId: abilityState.id, // Include ability ID for cost deduction
                                abilityType: abilityDef.type,
                                sourceType: "ability" // New: Indicate source is an ability
                            });
                        });
                    }
                }
            });
        }


        // Process Flaws (converted to virtual passive abilities for effect handling)
        if (character.flaws && flawData) { // Ensure flawData is available
            character.flaws.forEach(flawState => { // flawState might just be { id: "flaw-id" }
                const flawDef = flawData[flawState.id];
                if (flawDef && flawDef.effect) {
                    flawDef.effect.forEach(effect => {
                        this.activeEffects.push({
                            ...effect,
                            abilityName: flawDef.name, // Use flaw name for context
                            abilityId: flawState.id,
                            abilityType: "passive", // Treat functionally as passive
                            sourceType: "flaw" // New: Indicate source is a flaw
                        });
                    });
                }
            });
        }
        console.log("EffectHandler: Active Effects Processed", this.activeEffects);
    },

    // Filters active effects for a specific attribute (e.g., for attribute rolls)
    getEffectsForAttribute: function(attributeName, effectType = null) {
        return this.activeEffects.filter(effect => {
            const targetsAttribute = effect.attribute && effect.attribute.toLowerCase() === attributeName;
            const matchesType = effectType ? effect.type === effectType : true;
            return targetsAttribute && matchesType;
        });
    },

    // Applies effects to the character data. This will be called before rendering.
    applyEffectsToCharacter: function(character) {
        let modifiedCharacter = JSON.parse(JSON.stringify(character)); // Deep clone to avoid direct mutation

        // Reset dynamic values that will be recalculated by effects
        if (modifiedCharacter.calculatedHealth) {
            modifiedCharacter.health.max = modifiedCharacter.calculatedHealth.baseMax; // Assuming a baseMax is stored
        }
        modifiedCharacter.tempResources = {}; // Clear temporary resources if any

        this.activeEffects.forEach(effect => {
            switch (effect.type) {
                case "modifier":
                    // Handled by getEffectsForAttribute for attribute rolls
                    break;
                case "language":
                    if (!modifiedCharacter.languages) {
                        modifiedCharacter.languages = [];
                    }
                    if (!modifiedCharacter.languages.includes(effect.name)) {
                        modifiedCharacter.languages.push(effect.name);
                    }
                    break;
                case "die_num":
                    // Logic to adjust character's rolling capabilities (e.g., add advantage)
                    // For now, just mark it as applied
                    if (!modifiedCharacter.activeRollEffects) {
                        modifiedCharacter.activeRollEffects = {};
                    }
                    if (!modifiedCharacter.activeRollEffects[effect.attribute]) {
                        modifiedCharacter.activeRollEffects[effect.attribute] = [];
                    }
                    modifiedCharacter.activeRollEffects[effect.attribute].push(effect);
                    break;
                case "max_health_mod": // New effect type for modifying max health
                    if (!modifiedCharacter.calculatedHealth) {
                        modifiedCharacter.calculatedHealth = {
                            baseMax: modifiedCharacter.health.max, // Store base max health
                            currentMax: modifiedCharacter.health.max
                        };
                    }
                    modifiedCharacter.calculatedHealth.currentMax += effect.value;
                    break;
                case "temporary_buff": // New effect type for temporary buffs
                    // Logic to store and manage temporary buffs (e.g., specific attribute bonuses for a duration)
                    // This will require a more complex time-based system for durations.
                    // For now, let's just add it to a list if we want to display it.
                    if (!modifiedCharacter.temporaryBuffs) {
                        modifiedCharacter.temporaryBuffs = [];
                    }
                    modifiedCharacter.temporaryBuffs.push(effect);
                    break;
                case "inventory_item": // New effect type for adding inventory
                    if (!modifiedCharacter.inventory) {
                        modifiedCharacter.inventory = [];
                    }
                    const existingItem = modifiedCharacter.inventory.find(item => item.name === effect.name);
                    if (existingItem) {
                        existingItem.quantity = (existingItem.quantity || 1) + (effect.quantity || 1);
                    } else {
                        modifiedCharacter.inventory.push({ name: effect.name, quantity: effect.quantity || 1 });
                    }
                    break;
                case "trigger_event": // New effect type for triggering events
                    // This is more complex and would likely involve dispatching custom events
                    // or calling specific game logic functions based on the event name.
                    console.log(`EffectHandler: Triggering event: ${effect.eventName}`);
                    break;
                case "summon_creature": // New effect type
                    // Logic to add a summoned creature to the character's active summons
                    if (!modifiedCharacter.summonedCreatures) {
                        modifiedCharacter.summonedCreatures = [];
                    }
                    modifiedCharacter.summonedCreatures.push({ name: effect.creatureName, stats: effect.stats });
                    break;
                case "deal_damage": // New effect type
                    // This would typically apply to a target, not the character gaining the ability.
                    // Needs context of a target. For self-damage, `character.health.current -= effect.value;`
                    break;
                case "healing": // New effect type
                    modifiedCharacter.health.current += effect.value;
                    if (modifiedCharacter.health.current > modifiedCharacter.health.max) {
                        modifiedCharacter.health.current = modifiedCharacter.health.max;
                    }
                    break;
                case "status": // New effect type
                    if (!modifiedCharacter.statuses) {
                        modifiedCharacter.statuses = [];
                    }
                    // Prevent duplicate statuses if not stackable
                    if (!modifiedCharacter.statuses.some(s => s.name === effect.name)) {
                        modifiedCharacter.statuses.push({ name: effect.name, duration: effect.duration, appliedAt: Date.now() });
                    }
                    break;
                case "resource_mod": // New effect type for modifying resource pools
                    if (!modifiedCharacter.resources) {
                        modifiedCharacter.resources = [];
                    }
                    let resource = modifiedCharacter.resources.find(r => r.type === effect.resource);
                    if (resource) {
                        resource.value += effect.value;
                        if (resource.max !== undefined && resource.value > resource.max) {
                            resource.value = resource.max;
                        }
                        if (resource.value < 0) resource.value = 0; // Prevent negative resources
                    } else {
                        // Add new resource if it doesn't exist
                        modifiedCharacter.resources.push({ type: effect.resource, value: effect.value, max: effect.max });
                    }
                    break;
                case "resistance_mod": // New effect type
                    if (!modifiedCharacter.resistances) {
                        modifiedCharacter.resistances = {};
                    }
                    if (!modifiedCharacter.resistances[effect.damageType]) {
                        modifiedCharacter.resistances[effect.damageType] = 0;
                    }
                    modifiedCharacter.resistances[effect.damageType] += effect.value; // Additive resistances
                    break;
                case "movement_mod": // New effect type
                    if (!modifiedCharacter.movement) {
                        modifiedCharacter.movement = { base: 0, current: 0 }; // Assuming base movement exists
                    }
                    modifiedCharacter.movement.current += effect.value;
                    break;
                default:
                    console.warn(`EffectHandler: Unknown effect type: ${effect.type}`, effect);
            }
        });
        return modifiedCharacter; // Return the character with applied effects
    }
};

// This function will be called to fully update the character display
function processAndRenderCharacter(character) {
    if (!character) {
        document.getElementById('characterDetails').innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
        return;
    }

    // Step 1: Process all active abilities and flaws to populate EffectHandler.activeEffects
    // Pass flawData to EffectHandler
    EffectHandler.processActiveAbilities(character, abilityData, flawData, activeAbilityStates);

    // Step 2: Apply all active effects to a cloned version of the character data
    // This creates a 'derived' character state with all passive and active effects applied
    const effectedCharacter = EffectHandler.applyEffectsToCharacter(character);

    // Step 3: Render UI based on the effectedCharacter data
    const characterDetails = document.getElementById('characterDetails'); // Get this element early
    const characterNameHeader = document.getElementById('characterNameHeader');

    if (characterNameHeader) {
        characterNameHeader.innerHTML = `
            ${effectedCharacter.info.name}
            <span class="character-subheader">Destiny: ${effectedCharacter.destiny} | Class: ${effectedCharacter.module || 'Crescendo'}</span>
        `;
    }

    let attributesHtml = '';
    if (effectedCharacter.attributes) {
        attributesHtml = Object.entries(effectedCharacter.attributes).map(([attr, die]) => {
            const initialModifiers = EffectHandler.getEffectsForAttribute(attr, "modifier"); // Use EffectHandler

            console.debug(`Processing attribute: ${attr}, Initial Modifiers:`, initialModifiers);

            let modifierSpans = '';
            for (let i = 0; i < MAX_MODIFIER_COLUMNS; i++) {
                const mod = initialModifiers[i];
                if (mod) {
                    modifierSpans += `<span class="modifier-display" style="color: ${mod.modifier > 0 ? '#03AC13' : '#FF0000'};" data-ability-name="${mod.abilityName}" data-source-type="${mod.sourceType}">${(mod.modifier > 0 ? '+' : '') + mod.modifier}</span>`;
                } else {
                    modifierSpans += `<span class="modifier-display empty-modifier-cell">&nbsp;</span>`;
                }
            }
            // For initial render, unmodified result is empty as no roll has occurred
            const unmodifiedResultHtml = initialModifiers.length > 0
                ? `<div class="unmodified-roll-result"></div>` // Placeholder for initial render
                : `<div class="unmodified-roll-result empty-unmodified-cell">&nbsp;</div>`;
            return `
                <div class="attribute-row" data-attribute="${attr}" data-dice="${die}">
                    <label>${attr.charAt(0).toUpperCase() + attr.slice(1)}</label>
                    <span class="die-type">${die.toUpperCase()}</span>
                    <button class="btn-roll attribute-roll">Roll</button>
                    <div class="roll-result"></div>
                    ${modifierSpans}
                    ${unmodifiedResultHtml}
                </div>
            `;
        }).join('');

        const initialLuckModifiers = EffectHandler.getEffectsForAttribute('luck', "modifier"); // Use EffectHandler
        let luckModifierSpans = '';
        for (let i = 0; i < MAX_MODIFIER_COLUMNS; i++) {
            const mod = initialLuckModifiers[i];
            if (mod) {
                luckModifierSpans += `<span class="modifier-display" style="color: ${mod.modifier > 0 ? '#03AC13' : '#FF0000'};" data-ability-name="${mod.abilityName}" data-source-type="${mod.sourceType}">${(mod.modifier > 0 ? '+' : '') + mod.modifier}</span>`;
            } else {
                luckModifierSpans += `<span class="modifier-display empty-modifier-cell">&nbsp;</span>`;
            }
        }
        const unmodifiedLuckResultHtml = initialLuckModifiers.length > 0
            ? `<div class="unmodified-roll-result"></div>`
            : `<div class="unmodified-roll-result empty-unmodified-cell">&nbsp;</div>`;
        attributesHtml += `
            <div class="attribute-row" data-attribute="luck" data-dice="d100">
                <label>Luck</label>
                <span class="die-type">D100</span>
                <button class="btn-roll attribute-roll">Roll</button>
                <div class="roll-result"></div>
                ${luckModifierSpans}
                ${unmodifiedLuckResultHtml}
            </div>
        `;
    }

    characterDetails.innerHTML = `
        <div class="character-stats">
            <h4>Attributes</h4>
            <div class="attributes-grid-container"> ${attributesHtml}</div>
        </div>

        <div class="character-health health-display"></div>
        ${renderResources(effectedCharacter)}
        ${renderLanguages(effectedCharacter)}
        ${renderStatuses(effectedCharacter)}
        ${renderFlaws(effectedCharacter)}

        ${effectedCharacter.inventory && effectedCharacter.inventory.length > 0 ? `
        <div class="character-inventory">
            <h4>Inventory</h4>
            <ul>
                ${effectedCharacter.inventory.map(item => `<li>${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ''}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        ${renderAbilities(effectedCharacter)}
        <div class="character-info">
            <h4>Info</h4>
            <p><strong>Name:</strong> ${effectedCharacter.info.name}</p>
            <p><strong>Bio:</strong> ${effectedCharacter.info.bio || 'N/A'}</p>
        </div>
    `;

    // Always use the effectedCharacter for health display
    renderHealthDisplay(effectedCharacter);
    attachAttributeRollListeners(); // Re-attach listeners for all buttons
}

// === Configuration for Attribute Display ===
// IMPORTANT: This constant defines the maximum number of modifier columns.
// If an attribute has more modifiers than this, they will not be displayed.
// If an attribute has fewer, empty columns will be created to maintain grid structure.
const MAX_MODIFIER_COLUMNS = 5; // User-defined maximum number of modifiers

// A simple alerter utility for displaying messages.
// This uses alert() for immediate feedback and console.log() for logging.
const alerter = {
    show: function(message, type = 'info') {
        alert(`[${type.toUpperCase()}] ${message}`);
        console.log(`Alerter (${type}): ${message}`);

        // Note for future: To implement a non-blocking UI message,
        // you would dynamically create and display a styled message element
        // (using _informer.css which you already have for styling purposes).
        // Example (conceptual):
        /*
        const messageEl = document.createElement('div');
        messageEl.classList.add('alerter-message', `alerter-${type}`); // Using alerter-message class
        messageEl.textContent = message;
        document.body.appendChild(messageEl);
        setTimeout(() => {
            messageEl.remove();
        }, 3000); // Remove after 3 seconds
        */
    }
};

// Function to highlight the active navigation link
function highlightActiveNav(pageName) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').includes(pageName)) {
            link.classList.add('active');
        }
    });
}

// Global variable to hold ability data
let abilityData = {}; // Initialize as empty object
// Global variable to hold flaw data
let flawData = {}; // New: Initialize as empty object for flaws

// Global variable to hold the state of active toggleable abilities
// Resets on page refresh as requested.
let activeAbilityStates = new Set(); // It is a Set.

// Helper function to calculate and get active modifiers for a given attribute
// This function was originally intended to be used, but direct access to 'modifier'
// in raw effects proved more straightforward for current display logic.
// Keeping it for potential future uses where a 'value' property might be universally desired.
function getActiveModifiersForAttribute(attributeName) {
    // Delegate to EffectHandler to get relevant modifier effects
    return EffectHandler.getEffectsForAttribute(attributeName, "modifier")
        .map(effect => ({
            value: effect.modifier, // Correctly maps 'modifier' to 'value'
            abilityName: effect.abilityName,
            sourceType: effect.sourceType // Include sourceType
        }));
}

// Helper function to render modifier display elements and the unmodified result
// This function is now responsible for re-rendering the modifier columns within the attribute-row
// It replaces the previous renderModifierDisplays functionality for dynamic updates
function updateAttributeRollDisplay(assignmentElement, baseResult, modifiedResult, activeModifiers) {
    // Select existing elements or create placeholders if they don't exist
    let yellowResultEl = assignmentElement.querySelector('.roll-result');
    let blueResultEl = assignmentElement.querySelector('.unmodified-roll-result');

    // Ensure elements exist. They should be created during initial rendering, but this is a fallback.
    if (!yellowResultEl) {
        yellowResultEl = document.createElement('div');
        yellowResultEl.classList.add('roll-result');
        assignmentElement.appendChild(yellowResultEl);
    }
    if (!blueResultEl) {
        blueResultEl = document.createElement('div');
        blueResultEl.classList.add('unmodified-roll-result');
        assignmentElement.appendChild(blueResultEl);
    }

    // --- IMPORTANT FIX: Reset classes to ensure display on subsequent rolls ---
    yellowResultEl.classList.remove('visible', 'fade-out');
    blueResultEl.classList.remove('visible', 'fade-out');
    blueResultEl.classList.remove('empty-unmodified-cell'); // Ensure visibility if it becomes active

    // Clear previous dynamic modifier spans
    assignmentElement.querySelectorAll('.modifier-display, .empty-modifier-cell').forEach(el => el.remove());

    // Display yellow modified result (Column 4)
    yellowResultEl.textContent = modifiedResult;
    yellowResultEl.classList.add('visible');
    setTimeout(() => yellowResultEl.classList.add('fade-out'), 2000);


    // Re-render Modifiers (Columns 5 to 5 + MAX_MODIFIER_COLUMNS - 1)
    const modifiersToDisplay = activeModifiers.slice(0, MAX_MODIFIER_COLUMNS); // Cap at MAX_MODIFIER_COLUMNS

    // Add actual modifiers and append them directly after the roll-result element
    // This ensures they are inserted in the correct grid column order after the yellow result.
    const rollResultColumn = assignmentElement.querySelector('.roll-result');
    let lastInsertedElement = rollResultColumn; // Start inserting after the roll result

    modifiersToDisplay.forEach(mod => {
        const modSpan = document.createElement('span');
        modSpan.classList.add('modifier-display');
        // CORRECTED: Access mod.modifier directly
        modSpan.textContent = (mod.modifier > 0 ? '+' : '') + mod.modifier;
        modSpan.style.color = mod.modifier > 0 ? '#03AC13' : '#FF0000';
        modSpan.dataset.abilityName = mod.abilityName;
        modSpan.dataset.sourceType = mod.sourceType; // Add sourceType to data-attribute

        // Insert modifiers after the last inserted element
        lastInsertedElement.insertAdjacentElement('afterend', modSpan);
        lastInsertedElement = modSpan; // Update last inserted element
    });

    // Add empty modifier cells to maintain grid columns (if needed)
    for (let i = modifiersToDisplay.length; i < MAX_MODIFIER_COLUMNS; i++) {
        const emptyModSpan = document.createElement('span');
        emptyModSpan.classList.add('modifier-display', 'empty-modifier-cell');
        emptyModSpan.innerHTML = '&nbsp;'; // Non-breaking space to maintain height
        lastInsertedElement.insertAdjacentElement('afterend', emptyModSpan);
        lastInsertedElement = emptyModSpan; // Update last inserted element
    }

    // Display blue unmodified result (Column 10)
    // This element should always be the last one in the grid row for attribute-row
    if (activeModifiers.length > 0) {
        blueResultEl.textContent = baseResult;
        blueResultEl.classList.add('visible');
        setTimeout(() => blueResultEl.classList.add('fade-out'), 2000);
    } else {
        // If no modifiers, ensure it's hidden but space is maintained
        blueResultEl.textContent = '';
        blueResultEl.classList.add('empty-unmodified-cell');
    }
}


// Function to attach attribute roll event listeners
function attachAttributeRollListeners() {
    document.querySelectorAll('.attribute-roll').forEach(btn => {
        btn.addEventListener('click', function() {
            const assignment = this.closest('.attribute-row');
            const attributeName = assignment.getAttribute('data-attribute');
            const dieType = assignment.getAttribute('data-dice');
            let baseResult = Math.floor(Math.random() * parseInt(dieType.substring(1))) + 1;

            // --- Cost Deduction Logic ---
            // Only abilities can have costs, not flaws, so filter by sourceType
            const relevantActiveEffects = EffectHandler.activeEffects.filter(effect =>
                effect.attribute && effect.attribute.toLowerCase() === attributeName && effect.cost && effect.sourceType === "ability"
            );

            let canAffordAll = true;
            const costsToDeduct = {};

            relevantActiveEffects.forEach(effect => {
                const costResource = effect.cost.resource;
                const costValue = parseInt(effect.cost.value, 10);

                if (!costsToDeduct[costResource]) {
                    costsToDeduct[costResource] = 0;
                }
                costsToDeduct[costResource] += costValue;
            });

            for (const resourceType in costsToDeduct) {
                const totalCost = costsToDeduct[resourceType];
                const charResource = activeCharacter.resources.find(r => r.type === resourceType);

                if (!charResource || charResource.value < totalCost) {
                    canAffordAll = false;
                    alerter.show(`Not enough ${resourceType} to use all active abilities affecting ${attributeName.charAt(0).toUpperCase() + attributeName.slice(1)}.`, 'error');
                    break;
                }
            }

            if (!canAffordAll) {
                return; // Stop the roll if costs can't be met
            }

            // If costs can be met, deduct them and update character
            if (Object.keys(costsToDeduct).length > 0) {
                const newResources = activeCharacter.resources.map(res => {
                    if (costsToDeduct[res.type]) {
                        return { ...res, value: res.value - costsToDeduct[res.type] };
                    }
                    return res;
                });
                // Update activeCharacter and persist to DB
                db.updateCharacterResources(activeCharacter.id, newResources).then(updatedChar => {
                    activeCharacter = updatedChar; // Update global activeCharacter
                    processAndRenderCharacter(activeCharacter); // Re-render the character sheet with updated resources
                    alerter.show(`Costs deducted for active abilities affecting ${attributeName.charAt(0).toUpperCase() + attributeName.slice(1)}.`, 'info');
                }).catch(err => {
                    alerter.show('Error deducting costs. See console.', 'error');
                    console.error('Error deducting character resources:', err);
                    return; // Prevent roll if resource update fails
                });
            }


            // Apply modifiers (uses the already updated EffectHandler.activeEffects from processAndRenderCharacter)
            const activeModifiers = EffectHandler.getEffectsForAttribute(attributeName, "modifier");
            // CORRECTED: Access mod.modifier directly
            let totalModifier = activeModifiers.reduce((sum, mod) => sum + mod.modifier, 0);

            const modifiedResult = baseResult + totalModifier; // Apply modifier to the result

            // Update the display for this specific attribute-row
            updateAttributeRollDisplay(assignment, baseResult, modifiedResult, activeModifiers);
        });
    });
}

// Function to render abilities, separating active and passive
function renderAbilities(character) {
    if (!character.abilities || character.abilities.length === 0) {
        return '';
    }

    const activeAbilitiesHtml = [];
    const passiveAbilitiesHtml = [];

    character.abilities.forEach(abilityState => {
        const abilityDef = abilityData[abilityState.id]; // Look up full ability definition
        if (!abilityDef) {
            console.warn(`Ability definition not found for ID: ${abilityState.id}`);
            return;
        }

        let description = abilityDef.description;

        // Replace template variables in the description
        description = description.replace(/\${([^}]+)}/g, (match, p1) => {
            let value;
            try {
                const path = p1.split('.');
                let current = abilityDef; // Use abilityDef as the base
                for (let i = 0; i < path.length; i++) {
                    if (current === null || current === undefined) {
                        current = undefined;
                        break;
                    }
                    current = current[path[i]];
                }
                value = current;
                if (value === undefined && typeof abilityDef[p1] !== 'undefined') {
                    value = abilityDef[p1];
                }
            } catch (e) {
                console.error(`Error resolving template variable ${p1} for ability ${abilityState.id}:`, e);
                value = undefined;
            }
            if (value !== undefined) {
                if (p1 === 'cost.gold' && typeof value === 'number') {
                    return `${value} gold`;
                }
                return value;
            }
            return match;
        });

        let optionsHtml = '';
        if (abilityDef.options && abilityState.selections && abilityState.selections.length > 0) {
            const selectedOptionNames = abilityState.selections.map(selection => {
                const option = abilityDef.options.find(opt => opt.id === selection.id);
                return option ? option.name : selection.id;
            }).join(', ');
            optionsHtml = `<p class="ability-selections">Selections: ${selectedOptionNames}</p>`;
        }

        if (abilityDef.type === "active") {
            const isOn = activeAbilityStates.has(abilityState.id) ? 'toggled-red' : '';
            activeAbilitiesHtml.push(`
                <li class="ability-list-item">
                    <button class="ability-button ability-item ${isOn}" data-ability-id="${abilityState.id}">
                        <strong>${abilityDef.name}</strong> <span class="ability-type-tag active">ACTIVE</span> (Tier ${abilityState.tier})
                        <p>${description}</p>
                        ${optionsHtml}
                    </button>
                </li>
            `);
        } else { // Passive ability
            passiveAbilitiesHtml.push(`
                <li class="ability-item passive-ability-item">
                    <strong>${abilityDef.name}</strong> <span class="ability-type-tag passive">PASSIVE</span> (Tier ${abilityState.tier})
                    <p>${description}</p>
                    ${optionsHtml}
                </li>
            `);
        }
    });

    return `
        <div class="character-abilities">
            <h4>Abilities</h4>
            <div class="abilities-section-active">
                <h5>Active Abilities</h5>
                <ul id="activeAbilitiesList">
                    ${activeAbilitiesHtml.join('')}
                </ul>
            </div>
            <div class="abilities-section-passive">
                <h5>Passive Abilities</h5>
                <ul id="passiveAbilitiesList">
                    ${passiveAbilitiesHtml.join('')}
                </ul>
            </div>
        </div>
    `;
}

let activeCharacter = null; // Variable to store the active character

// Function to render health display
function renderHealthDisplay(character) { // Now accepts the effectedCharacter
    if (!character || !character.health) {
        console.warn("Character or health data not available for rendering health display.");
        return;
    }

    const healthDisplayContainer = document.querySelector('.character-health.health-display');
    if (!healthDisplayContainer) {
        console.warn("Health display container not found.");
        return;
    }

    // Use character.calculatedHealth if it exists, otherwise fall back to base health
    const currentMaxHealth = character.calculatedHealth ? character.calculatedHealth.currentMax : character.health.max;

    // Calculate health percentage and determine health class
    const healthPercentage = (character.health.current / currentMaxHealth) * 100;
    let healthClass = '';
    if (healthPercentage > 60) {
        healthClass = 'health-full';
    } else if (healthPercentage > 30) {
        healthClass = 'health-medium';
    } else {
        healthClass = 'health-low';
    }

    healthDisplayContainer.innerHTML = `
        <h4>Health</h4>
        <div class="health-controls">
            <input type="number" id="healthAdjustmentInput" placeholder="e.g. -5, +10" class="form-control" />
            <button id="applyHealthAdjustment" class="btn btn-primary">Apply</button>
        </div>
        <div class="health-bar-container">
            <div class="health-bar ${healthClass}" style="width: ${healthPercentage}%"></div>
        </div>
        <div class="health-numbers">
            ${character.health.current} / ${currentMaxHealth}
            ${character.health.temporary ? `(+${character.health.temporary} temp)` : ''}
        </div>
    `;

    const applyButton = document.getElementById('applyHealthAdjustment');
    const inputField = document.getElementById('healthAdjustmentInput');

    applyButton.addEventListener('click', function() {
        const value = inputField.value;
        const adjustment = parseInt(value, 10);

        if (isNaN(adjustment) || !Number.isInteger(adjustment)) {
            alerter.show('Invalid input. Please enter a whole number.', 'error');
            inputField.value = '';
            return;
        }

        let newCurrentHealth = character.health.current + adjustment;
        const finalMaxHealth = character.calculatedHealth ? character.calculatedHealth.currentMax : character.health.max;

        // Cap current health at calculated max health
        if (newCurrentHealth > finalMaxHealth) {
            newCurrentHealth = finalMaxHealth;
        }
        if (newCurrentHealth < 0) { // Prevent health from going below zero (unless temporary health allows)
            newCurrentHealth = 0;
        }

        db.updateCharacterHealth(activeCharacter.id, { current: newCurrentHealth }).then(updatedCharacter => {
            activeCharacter = updatedCharacter; // Update the global activeCharacter
            processAndRenderCharacter(activeCharacter); // Re-render with updated character state
            console.log(`Health adjusted for ${activeCharacter.info.name}: ${adjustment}. New health: ${activeCharacter.health.current}`);
            inputField.value = ''; // Clear input field
        }).catch(err => {
            alerter.show('Error updating health. See console.', 'error');
            console.error('Error updating character health:', err);
        });
    });

    inputField.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            applyButton.click();
        }
    });
}


// Function to render resources
function renderResources(character) {
    if (!character.resources || character.resources.length === 0) {
        return '';
    }
    return `
        <div class="character-resources">
            <h4>Resources</h4>
            <ul class="resource-list">
                ${character.resources.map(resource => `
                    <li>
                        <strong>${resource.type.charAt(0).toUpperCase() + resource.type.slice(1)}:</strong>
                        ${resource.value} ${resource.max !== undefined ? `/ ${resource.max}` : ''}
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
}

// Function to render languages
function renderLanguages(character) {
    if (!character.languages || character.languages.length === 0) {
        return '';
    }
    return `
        <div class="character-languages">
            <h4>Languages</h4>
            <ul>
                ${character.languages.map(lang => `<li>${lang}</li>`).join('')}
            </ul>
        </div>
    `;
}

// Function to render statuses
function renderStatuses(character) {
    if (!character.statuses || character.statuses.length === 0) {
        return '';
    }
    // You might want to add duration display and expiration logic here
    return `
        <div class="character-statuses">
            <h4>Active Statuses</h4>
            <ul>
                ${character.statuses.map(status => `<li>${status.name}</li>`).join('')}
            </ul>
        </div>
    `;
}

// New: Function to render flaws
function renderFlaws(character) {
    if (!character.flaws || character.flaws.length === 0) {
        return '';
    }
    return `
        <div class="character-flaws">
            <h4>Flaws</h4>
            <ul>
                ${character.flaws.map(flawState => {
                    const flawDef = flawData[flawState.id];
                    if (!flawDef) {
                        console.warn(`Flaw definition not found for ID: ${flawState.id}`);
                        return `<li>Unknown Flaw (ID: ${flawState.id})</li>`;
                    }
                    return `
                        <li class="flaw-item">
                            <strong>${flawDef.name}</strong>
                            <p>${flawDef.description}</p>
                        </li>
                    `;
                }).join('')}
            </ul>
        </div>
    `;
}


// Initialize play page
document.addEventListener('DOMContentLoaded', function() {
    highlightActiveNav('play.html'); // Highlight "Play" link

    const characterDetails = document.getElementById('characterDetails'); // Get this element early

    // --- ONE AND ONLY ONE DELEGATED EVENT LISTENER FOR TOOLTIPS ---
    // This listener will be active for ALL clicks within characterDetails,
    // and it will check if the click originated from a .modifier-display.
    if (characterDetails) {
        characterDetails.addEventListener('click', function(event) {
            // Use .closest() to find the .modifier-display element that was clicked or is an ancestor of the click target
            let targetModSpan = event.target.closest('.modifier-display');

            // Ensure a .modifier-display was clicked AND it's not an empty placeholder
            if (targetModSpan && !targetModSpan.classList.contains('empty-modifier-cell')) {
                // Remove any existing tooltips on this specific element before creating a new one
                // This prevents multiple tooltips if clicked rapidly on the same span
                targetModSpan.querySelectorAll('.modifier-tooltip').forEach(tip => tip.remove());

                const tooltip = document.createElement('div');
                tooltip.classList.add('modifier-tooltip');
                // Display both ability name and source type in tooltip
                const abilityName = targetModSpan.dataset.abilityName;
                const sourceType = targetModSpan.dataset.sourceType;
                tooltip.textContent = `${abilityName} (Source: ${sourceType.charAt(0).toUpperCase() + sourceType.slice(1)})`;


                // Append the tooltip directly to the clicked modifier span
                targetModSpan.appendChild(tooltip);

                // Set a timeout to remove the tooltip after 3 seconds
                setTimeout(() => {
                    // Ensure the tooltip is still a child of targetModSpan before trying to remove it
                    if (targetModSpan.contains(tooltip)) {
                        targetModSpan.removeChild(tooltip);
                    }
                }, 3000);
            }
        });
    }
    // --- END OF DELEGATED EVENT LISTENER ---


    // Load abilities.json and flaws.json
    Promise.all([
        fetch('data/abilities.json').then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        }),
        fetch('data/flaws.json').then(response => { // New: Fetch flaws.json
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
    ])
    .then(([abilitiesDataLoaded, flawsDataLoaded]) => {
        abilityData = abilitiesDataLoaded;
        flawData = flawsDataLoaded; // Assign loaded flaw data
        console.log('play.js: abilities.json and flaws.json loaded successfully.');

        db.getActiveCharacter().then(function(character) {
            activeCharacter = character;
            // IMPORTANT: If character.selectedFlaw exists, convert it to the new character.flaws format
            if (activeCharacter && activeCharacter.selectedFlaw && !activeCharacter.flaws) {
                console.warn("Converting old 'selectedFlaw' to new 'flaws' array format.");
                activeCharacter.flaws = [{ id: activeCharacter.selectedFlaw }];
                delete activeCharacter.selectedFlaw; // Remove the old property
                // Persist this change to the database
                db.updateCharacter(activeCharacter.id, { flaws: activeCharacter.flaws, selectedFlaw: null }).then(() => {
                    processAndRenderCharacter(activeCharacter); // Initial render with updated structure
                }).catch(err => {
                    console.error("Error updating character flaws in DB:", err);
                    alerter.show("Error migrating flaw data.", "error");
                    processAndRenderCharacter(activeCharacter); // Render anyway, with potential old data issue
                });
            } else {
                processAndRenderCharacter(activeCharacter); // Initial render
            }

        }).catch(function(err) {
            console.error('Error loading character:', err);
            alerter.show('Failed to load active character.', 'error');
        });
    })
    .catch(error => {
        console.error('play.js: Error loading data files:', error);
        alert('Failed to load game data (abilities.json or flaws.json). Please check the console for details.');
    });

    // Event listener for toggling active abilities
    // Moved outside the initial characterDetails.innerHTML rendering to be persistent
    document.getElementById('characterDetails').addEventListener('click', function(event) {
        const button = event.target.closest('.ability-button');
        if (button) {
            const abilityId = button.dataset.abilityId;

            if (activeAbilityStates.has(abilityId)) {
                activeAbilityStates.delete(abilityId);
                button.classList.remove('toggled-red');
                console.log(`Ability ${abilityId} turned OFF.`);
            } else {
                activeAbilityStates.add(abilityId);
                button.classList.add('toggled-red');
                console.log(`Ability ${abilityId} turned ON.`);
            }
            // After toggling, re-process and re-render the character sheet
            processAndRenderCharacter(activeCharacter);
        }
    });

    // Dice roller functionality for D20
    document.getElementById('rollD20').addEventListener('click', function() {
        const result = Math.floor(Math.random() * 20) + 1;
        const diceResult = document.getElementById('diceResult');

        diceResult.textContent = '...';
        setTimeout(function() {
            diceResult.textContent = result;
        }, 500);
    });

    // Export single character
    document.getElementById('exportSingleCharacterBtn').addEventListener('click', function() {
        if (!activeCharacter) {
            alert('No character selected to export.');
            return;
        }

        db.exportCharacter(activeCharacter.id, activeCharacter.info.name).then(function(exportData) {
            if (!exportData) {
                alert('Selected character not found for export.');
                return;
            }

            console.log('Exporting character:', exportData.data);

            const a = document.createElement('a');
            a.href = exportData.url;
            a.download = exportData.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function() {
                URL.revokeObjectURL(exportData.url);
            }, 100);
        }).catch(function(err) {
            console.error('Export failed:', err);
            alerter.show('Export failed: ' + err, 'error'); // Alerter for export failure
        });
    });
});