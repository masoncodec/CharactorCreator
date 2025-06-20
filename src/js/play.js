// play.js (Updated)
// This file handles the main character display and interaction on the play page.

// Import shared modules
import { EffectHandler } from './effectHandler.js';
import { loadGameData } from './dataLoader.js';
import { alerter } from './alerter.js';

// === Configuration for Attribute Display ===
// IMPORTANT: This constant defines the maximum number of modifier columns.
// If an attribute has more modifiers than this, they will not be displayed.
// If an attribute has fewer, empty columns will be created to maintain grid structure.
const MAX_MODIFIER_COLUMNS = 5; // User-defined maximum number of modifiers

// Global variable to hold ability data, flaw data, and perk data (now populated by dataLoader)
let abilityData = {};
let flawData = {};
let perkData = {};

// Global variable to hold the state of active toggleable abilities
// Resets on page refresh as requested.
let activeAbilityStates = new Set(); // It is a Set.

let activeCharacter = null; // Variable to store the active character

/**
 * This function will be called to fully update the character display.
 * It orchestrates processing effects and rendering the UI.
 * @param {object} character - The character object to display.
 */
function processAndRenderCharacter(character) {
    if (!character) {
        document.getElementById('characterDetails').innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
        return;
    }

    // Step 1: Process all active abilities, flaws, and perks to populate EffectHandler.activeEffects
    // Pass 'play' context here, including perkData
    EffectHandler.processActiveAbilities(character, abilityData, flawData, perkData, activeAbilityStates, 'play'); // MODIFIED: Added perkData

    // Step 2: Apply all active effects to a cloned version of the character data
    // Pass 'play' context here
    const effectedCharacter = EffectHandler.applyEffectsToCharacter(character, 'play');

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
            // Get initial modifiers for display. EffectHandler is now a global utility.
            const initialModifiers = EffectHandler.getEffectsForAttribute(attr, "modifier");

            console.debug(`Processing attribute: ${attr}, Initial Modifiers:`, initialModifiers);

            let modifierSpans = '';
            for (let i = 0; i < MAX_MODIFIER_COLUMNS; i++) {
                const mod = initialModifiers[i];
                if (mod) {
                    modifierSpans += `<span class="modifier-display" style="color: ${mod.modifier > 0 ? '#03AC13' : '#FF0000'};" data-item-name="${mod.itemName}" data-source-type="${mod.sourceType}">${(mod.modifier > 0 ? '+' : '') + mod.modifier}</span>`; // MODIFIED: data-ability-name to data-item-name
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

        const initialLuckModifiers = EffectHandler.getEffectsForAttribute('luck', "modifier");
        let luckModifierSpans = '';
        for (let i = 0; i < MAX_MODIFIER_COLUMNS; i++) {
            const mod = initialLuckModifiers[i];
            if (mod) {
                luckModifierSpans += `<span class="modifier-display" style="color: ${mod.modifier > 0 ? '#03AC13' : '#FF0000'};" data-item-name="${mod.itemName}" data-source-type="${mod.sourceType}">${(mod.modifier > 0 ? '+' : '') + mod.modifier}</span>`; // MODIFIED: data-ability-name to data-item-name
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
        ${renderPerks(effectedCharacter)}

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

/**
 * Updates the display for an attribute roll, including results and modifiers.
 * @param {HTMLElement} assignmentElement - The .attribute-row element.
 * @param {number} baseResult - The raw dice roll result.
 * @param {number} modifiedResult - The result after applying modifiers.
 * @param {Array<object>} activeModifiers - An array of active modifier effects.
 */
function updateAttributeRollDisplay(assignmentElement, baseResult, modifiedResult, activeModifiers) {
    let yellowResultEl = assignmentElement.querySelector('.roll-result');
    let blueResultEl = assignmentElement.querySelector('.unmodified-roll-result');

    if (!yellowResultEl || !blueResultEl) {
        console.error("Missing roll result display elements.");
        return;
    }

    // Reset classes to ensure display on subsequent rolls
    yellowResultEl.classList.remove('visible', 'fade-out');
    blueResultEl.classList.remove('visible', 'fade-out');
    blueResultEl.classList.remove('empty-unmodified-cell');

    // Clear previous dynamic modifier spans
    assignmentElement.querySelectorAll('.modifier-display, .empty-modifier-cell').forEach(el => el.remove());

    // Display yellow modified result
    yellowResultEl.textContent = modifiedResult;
    yellowResultEl.classList.add('visible');
    setTimeout(() => yellowResultEl.classList.add('fade-out'), 2000);

    // Re-render Modifiers
    const modifiersToDisplay = activeModifiers.slice(0, MAX_MODIFIER_COLUMNS);

    const rollResultColumn = assignmentElement.querySelector('.roll-result');
    let lastInsertedElement = rollResultColumn;

    modifiersToDisplay.forEach(mod => {
        const modSpan = document.createElement('span');
        modSpan.classList.add('modifier-display');
        modSpan.textContent = (mod.modifier > 0 ? '+' : '') + mod.modifier;
        modSpan.style.color = mod.modifier > 0 ? '#03AC13' : '#FF0000';
        modSpan.dataset.itemName = mod.itemName; // MODIFIED: data-ability-name to data-item-name
        modSpan.dataset.sourceType = mod.sourceType;

        lastInsertedElement.insertAdjacentElement('afterend', modSpan);
        lastInsertedElement = modSpan;
    });

    // Add empty modifier cells to maintain grid columns
    for (let i = modifiersToDisplay.length; i < MAX_MODIFIER_COLUMNS; i++) {
        const emptyModSpan = document.createElement('span');
        emptyModSpan.classList.add('modifier-display', 'empty-modifier-cell');
        emptyModSpan.innerHTML = '&nbsp;';
        lastInsertedElement.insertAdjacentElement('afterend', emptyModSpan);
        lastInsertedElement = emptyModSpan;
    }

    // Display blue unmodified result
    if (activeModifiers.length > 0) {
        blueResultEl.textContent = baseResult;
        blueResultEl.classList.add('visible');
        setTimeout(() => blueResultEl.classList.add('fade-out'), 2000);
    } else {
        blueResultEl.textContent = '';
        blueResultEl.classList.add('empty-unmodified-cell');
    }
}

/**
 * Attaches event listeners to all attribute roll buttons.
 */
function attachAttributeRollListeners() {
    document.querySelectorAll('.attribute-roll').forEach(btn => {
        btn.addEventListener('click', function() {
            const assignment = this.closest('.attribute-row');
            const attributeName = assignment.getAttribute('data-attribute');
            const dieType = assignment.getAttribute('data-dice');
            let baseResult = Math.floor(Math.random() * parseInt(dieType.substring(1))) + 1;

            // Cost Deduction Logic - only abilities can have costs
            // Now checks for 'ability' sourceType specifically
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

            // Apply modifiers (uses the already updated EffectHandler.activeEffects)
            const activeModifiers = EffectHandler.getEffectsForAttribute(attributeName, "modifier");
            let totalModifier = activeModifiers.reduce((sum, mod) => sum + mod.modifier, 0);

            const modifiedResult = baseResult + totalModifier; // Apply modifier to the result

            // Update the display for this specific attribute-row
            updateAttributeRollDisplay(assignment, baseResult, modifiedResult, activeModifiers);
        });
    });
}

/**
 * Renders the abilities section, separating active and passive abilities.
 * @param {object} character - The character object with abilities.
 * @returns {string} HTML string for abilities section.
 */
function renderAbilities(character) {
    if (!character.abilities || character.abilities.length === 0) {
        return '';
    }

    const activeAbilitiesHtml = [];
    const passiveAbilitiesHtml = [];

    character.abilities.forEach(abilityState => {
        const abilityDef = abilityData[abilityState.id];
        if (!abilityDef) {
            console.warn(`Ability definition not found for ID: ${abilityState.id}`);
            return;
        }

        let description = abilityDef.description;

        // Replace template variables in the description (e.g., ${cost.gold})
        description = description.replace(/\${([^}]+)}/g, (match, p1) => {
            let value;
            try {
                const path = p1.split('.');
                let current = abilityDef;
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
            const isOn = activeAbilityStates.has(abilityState.id) ? 'selected' : '';
            activeAbilitiesHtml.push(`
                <li class="ability-list-item">
                    <button class="ability-button ability-card ${isOn}" data-ability-id="${abilityState.id}">
                        <strong>${abilityDef.name}</strong> <span class="ability-type-tag active">ACTIVE</span>
                        <p>${description}</p>
                        ${optionsHtml}
                    </button>
                </li>
            `);
        } else { // Passive ability
            passiveAbilitiesHtml.push(`
                <li class="ability-card passive-ability-item">
                    <strong>${abilityDef.name}</strong> <span class="ability-type-tag passive">PASSIVE</span>
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

/**
 * Highlights the active navigation link based on the page name.
 * @param {string} pageName - The name of the current page (e.g., 'play.html').
 */
function highlightActiveNav(pageName) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').includes(pageName)) {
            link.classList.add('active');
        }
    });
}


/**
 * Renders the character's health display, including health bar and adjustment controls.
 * @param {object} character - The character object (with applied effects) to render health for.
 */
function renderHealthDisplay(character) {
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

    // Calculate health percentage and determine health class for styling
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
        if (newCurrentHealth < 0) {
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

/**
 * Renders the character's resources.
 * @param {object} character - The character object with resources.
 * @returns {string} HTML string for resources section.
 */
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

/**
 * Renders the character's languages.
 * @param {object} character - The character object with languages.
 * @returns {string} HTML string for languages section.
 */
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

/**
 * Renders the character's active statuses.
 * @param {object} character - The character object with statuses.
 * @returns {string} HTML string for statuses section.
 */
function renderStatuses(character) {
    if (!character.statuses || character.statuses.length === 0) {
        return '';
    }
    return `
        <div class="character-statuses">
            <h4>Active Statuses</h4>
            <ul>
                ${character.statuses.map(status => `<li>${status.name}</li>`).join('')}
            </ul>
        </div>
    `;
}

/**
 * Renders the character's flaws.
 * @param {object} character - The character object with flaws.
 * @returns {string} HTML string for flaws section.
 */
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
                    // Include nested selections if any
                    let optionsHtml = '';
                    if (flawDef.options && flawState.selections && flawState.selections.length > 0) {
                        const selectedOptionNames = flawState.selections.map(selection => {
                            const option = flawDef.options.find(opt => opt.id === selection.id);
                            return option ? option.name : selection.id;
                        }).join(', ');
                        optionsHtml = `<p class="flaw-selections">Selections: ${selectedOptionNames}</p>`;
                    }
                    return `
                        <li class="flaw-item">
                            <strong>${flawDef.name}</strong>
                            <p>${flawDef.description}</p>
                            ${optionsHtml}
                        </li>
                    `;
                }).join('')}
            </ul>
        </div>
    `;
}

/**
 * Renders the character's perks.
 * @param {object} character - The character object with perks.
 * @returns {string} HTML string for perks section.
 */
function renderPerks(character) { // ADDED: New function to render perks
    if (!character.perks || character.perks.length === 0) {
        return '';
    }
    return `
        <div class="character-perks">
            <h4>Perks</h4>
            <ul>
                ${character.perks.map(perkState => {
                    const perkDef = perkData[perkState.id];
                    if (!perkDef) {
                        console.warn(`Perk definition not found for ID: ${perkState.id}`);
                        return `<li>Unknown Perk (ID: ${perkState.id})</li>`;
                    }
                    // Include nested selections if any
                    let optionsHtml = '';
                    if (perkDef.options && perkState.selections && perkState.selections.length > 0) {
                        const selectedOptionNames = perkState.selections.map(selection => {
                            const option = perkDef.options.find(opt => opt.id === selection.id);
                            return option ? option.name : selection.id;
                        }).join(', ');
                        optionsHtml = `<p class="perk-selections">Selections: ${selectedOptionNames}</p>`;
                    }
                    return `
                        <li class="perk-item">
                            <strong>${perkDef.name}</strong>
                            <p>${perkDef.description}</p>
                            ${optionsHtml}
                        </li>
                    `;
                }).join('')}
            </ul>
        </div>
    `;
}


// Initialize play page on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async function() {
    highlightActiveNav('play.html'); // Highlight "Play" link

    const characterDetails = document.getElementById('characterDetails');

    // Delegated event listener for tooltips on modifier displays
    if (characterDetails) {
        characterDetails.addEventListener('click', function(event) {
            let targetModSpan = event.target.closest('.modifier-display');

            if (targetModSpan && !targetModSpan.classList.contains('empty-modifier-cell')) {
                // Remove any existing tooltips to prevent duplicates
                targetModSpan.querySelectorAll('.modifier-tooltip').forEach(tip => tip.remove());

                const tooltip = document.createElement('div');
                tooltip.classList.add('modifier-tooltip');
                const itemName = targetModSpan.dataset.itemName; // MODIFIED: data-ability-name to data-item-name
                const sourceType = targetModSpan.dataset.sourceType;
                tooltip.textContent = `${itemName} (Source: ${sourceType.charAt(0).toUpperCase() + sourceType.slice(1)})`;

                targetModSpan.appendChild(tooltip);

                setTimeout(() => {
                    if (targetModSpan.contains(tooltip)) {
                        targetModSpan.removeChild(tooltip);
                    }
                }, 3000);
            }
        });
    }

    // Load all game data using the new dataLoader module
    try {
        const loadedData = await loadGameData();
        abilityData = loadedData.abilityData;
        flawData = loadedData.flawData;
        perkData = loadedData.perkData; // ADDED: Assign loaded perkData
        console.log('play.js: All game data loaded successfully.');

        // Fetch and render the active character
        db.getActiveCharacter().then(function(character) {
            activeCharacter = character;
            processAndRenderCharacter(activeCharacter); // Initial render
        }).catch(function(err) {
            console.error('Error loading character:', err);
            alerter.show('Failed to load active character.', 'error');
        });

    } catch (error) {
        console.error('play.js: Error initializing data:', error);
        alerter.show('Failed to load game data. Please check the console for details.', 'error');
    }


    // Event listener for toggling active abilities
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

    // Dice roller functionality for D20 (generic for the page)
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
            alerter.show('No character selected to export.', 'info');
            return;
        }

        db.exportCharacter(activeCharacter.id, activeCharacter.info.name).then(function(exportData) {
            if (!exportData) {
                alerter.show('Selected character not found for export.', 'error');
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
            alerter.show('Export failed: ' + err, 'error');
        });
    });
});
