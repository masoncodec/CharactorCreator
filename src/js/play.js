// play.js

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

// Global variable to hold the state of active toggleable abilities
// Resets on page refresh as requested.
let activeAbilityStates = new Set(); // It is a Set.

// Helper function to calculate and get active modifiers for a given attribute
function getActiveModifiersForAttribute(attributeName) {
    const activeModifiers = [];
    if (activeCharacter && activeCharacter.abilities) {
        activeCharacter.abilities.forEach(abilityState => {
            const abilityDef = abilityData[abilityState.id];
            if (abilityDef && abilityDef.effect && abilityDef.effect.type === "modifier" && abilityDef.effect.attribute) {
                const effectAttribute = abilityDef.effect.attribute.toLowerCase();

                const isActive = (abilityDef.type === "passive") || (abilityDef.type === "active" && activeAbilityStates.has(abilityState.id));

                if (isActive && effectAttribute === attributeName) {
                    activeModifiers.push({
                        value: abilityDef.effect.modifier,
                        abilityName: abilityDef.name
                    });
                }
            }
        });
    }
    return activeModifiers;
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
        modSpan.textContent = (mod.value > 0 ? '+' : '') + mod.value;
        modSpan.style.color = mod.value > 0 ? '#03AC13' : '#FF0000';
        modSpan.dataset.abilityName = mod.abilityName;

        modSpan.addEventListener('click', function(event) {
            // Remove any existing tooltips on this element before creating a new one
            // This prevents multiple tooltips if clicked rapidly
            this.querySelectorAll('.modifier-tooltip').forEach(tip => tip.remove());

            const tooltip = document.createElement('div');
            tooltip.classList.add('modifier-tooltip');
            tooltip.textContent = this.dataset.abilityName;

            // NO NEED FOR JS positioning (left, top, transform) here,
            // because CSS 'bottom', 'left', 'transform' will handle it relative to 'this'.

            // Append the tooltip directly to the clicked modifier span
            this.appendChild(tooltip); // KEY CHANGE: Append to 'this' (modSpan)

            setTimeout(() => {
                if (this.contains(tooltip)) { // Check if the tooltip is still a child of 'this'
                    this.removeChild(tooltip);
                }
            }, 3000);
        });
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
            const baseResult = Math.floor(Math.random() * parseInt(dieType.substring(1))) + 1;

            const activeModifiers = getActiveModifiersForAttribute(attributeName);
            let totalModifier = activeModifiers.reduce((sum, mod) => sum + mod.value, 0);

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

    // Calculate health percentage and determine health class
    const healthPercentage = (character.health.current / character.health.max) * 100;
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
            ${character.health.current} / ${character.health.max}
            ${character.health.temporary ? `(+${character.health.temporary} temp)` : ''}
        </div>
    `;

    // Attach event listener for health adjustment after rendering
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

        // Note for future: Temporary health logic can be implemented here.
        // For now, adjustments only affect current health, and no min/max cap.

        db.updateCharacterHealth(character.id, { current: newCurrentHealth }).then(updatedCharacter => {
            activeCharacter = updatedCharacter; // Update the global activeCharacter
            renderHealthDisplay(activeCharacter); // Re-render with updated health
            // alerter.show(`Health adjusted by ${adjustment}. New health: ${activeCharacter.health.current}`, 'success'); // Removed success message
            console.log(`Health adjusted for ${activeCharacter.info.name}: ${adjustment}. New health: ${activeCharacter.health.current}`);
            inputField.value = ''; // Clear input field
        }).catch(err => {
            alerter.show('Error updating health. See console.', 'error');
            console.error('Error updating character health:', err);
        });
    });

    // Add event listener for 'Enter' key press on the input field
    inputField.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default form submission if any
            applyButton.click(); // Trigger the click event on the Apply button
        }
    });
}


// Initialize play page
document.addEventListener('DOMContentLoaded', function() {
    highlightActiveNav('play.html'); // Highlight "Play" link

    // Load abilities.json first
    fetch('data/abilities.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            abilityData = data; // Store the loaded data
            console.log('play.js: abilities.json loaded successfully.');

            // Now load active character, as abilityData is available
            db.getActiveCharacter().then(function(character) {
                const characterDetails = document.getElementById('characterDetails');
                activeCharacter = character; // Store the active character

                if (character) {
                    // Start of modified attribute rendering logic
                    let attributesHtml = '';
                    if (character.attributes) {
                        attributesHtml = Object.entries(character.attributes).map(([attr, die]) => {
                            // Get initial modifiers for the attribute
                            const initialModifiers = getActiveModifiersForAttribute(attr);
                            const hasModifiers = initialModifiers.length > 0;

                            let modifierSpans = '';
                            for (let i = 0; i < MAX_MODIFIER_COLUMNS; i++) {
                                const mod = initialModifiers[i];
                                if (mod) {
                                    modifierSpans += `<span class="modifier-display" style="color: ${mod.value > 0 ? '#03AC13' : '#FF0000'};" data-ability-name="${mod.abilityName}">${(mod.value > 0 ? '+' : '') + mod.value}</span>`;
                                } else {
                                    modifierSpans += `<span class="modifier-display empty-modifier-cell">&nbsp;</span>`; // Placeholder
                                }
                            }

                            // Render unmodified result conditionally
                            const unmodifiedResultHtml = hasModifiers
                                ? `<div class="unmodified-roll-result">${attr.unmodifiedResult !== undefined ? attr.unmodifiedResult : ''}</div>`
                                : `<div class="unmodified-roll-result empty-unmodified-cell">&nbsp;</div>`; // Placeholder

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

                        // Add Luck attribute specifically
                        const initialLuckModifiers = getActiveModifiersForAttribute('luck');
                        const hasLuckModifiers = initialLuckModifiers.length > 0;

                        let luckModifierSpans = '';
                        for (let i = 0; i < MAX_MODIFIER_COLUMNS; i++) {
                            const mod = initialLuckModifiers[i];
                            if (mod) {
                                luckModifierSpans += `<span class="modifier-display" style="color: ${mod.value > 0 ? '#03AC13' : '#FF0000'};" data-ability-name="${mod.abilityName}">${(mod.value > 0 ? '+' : '') + mod.value}</span>`;
                            } else {
                                luckModifierSpans += `<span class="modifier-display empty-modifier-cell">&nbsp;</span>`; // Placeholder
                            }
                        }

                        const unmodifiedLuckResultHtml = hasLuckModifiers
                            ? `<div class="unmodified-roll-result"></div>` // Content filled by JS on roll
                            : `<div class="unmodified-roll-result empty-unmodified-cell">&nbsp;</div>`; // Placeholder

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
                    // End of modified attribute rendering logic

                    characterDetails.innerHTML = `
                        <div class="character-header">
                            <h3>${character.info.name}</h3>
                            <p class="character-module">${character.module || 'Crescendo'}</p>
                            <p class="character-role">${character.destiny}</p>
                        </div>

                        <div class="character-stats">
                            <h4>Attributes</h4>
                            <div class="attributes-grid-container"> ${attributesHtml}
                            </div>
                        </div>

                        <div class="character-health health-display">
                        </div>

                        ${character.selectedFlaw ? `
                        <div class="character-flaw">
                            <h4>Selected Flaw</h4>
                            <p>${character.selectedFlaw.charAt(0).toUpperCase() + character.selectedFlaw.slice(1)}</p>
                        </div>
                        ` : ''}

                        ${character.inventory && character.inventory.length > 0 ? `
                        <div class="character-inventory">
                            <h4>Inventory</h4>
                            <ul>
                                ${character.inventory.map(item => `<li>${item.name}</li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}

                        ${renderAbilities(character)}
                        <div class="character-info">
                            <h4>Info</h4>
                            <p><strong>Name:</strong> ${character.info.name}</p>
                            <p><strong>Bio:</strong> ${character.info.bio || 'N/A'}</p>
                        </div>
                    `;

                    // AFTER characterDetails.innerHTML is set, attach listeners to the *newly created* modifier spans
                    document.querySelectorAll('.modifier-display').forEach(modSpan => {
                        modSpan.addEventListener('click', function(event) {
                             // Remove any existing tooltips on this element before creating a new one
                            this.querySelectorAll('.modifier-tooltip').forEach(tip => tip.remove());

                            const tooltip = document.createElement('div');
                            tooltip.classList.add('modifier-tooltip');
                            tooltip.textContent = this.dataset.abilityName;

                            // Append the tooltip directly to the clicked modifier span
                            this.appendChild(tooltip); // KEY CHANGE: Append to 'this' (modSpan)

                            setTimeout(() => {
                                if (this.contains(tooltip)) {
                                    this.removeChild(tooltip);
                                }
                            }, 3000);
                        });
                    });

                    // Render initial health display
                    renderHealthDisplay(activeCharacter); // Call the new function here

                    // After character details are rendered, attach event listeners
                    attachAttributeRollListeners(); // Attach listeners after content is loaded

                    // Attach event listener for active ability buttons
                    document.getElementById('activeAbilitiesList').addEventListener('click', function(event) {
                        const button = event.target.closest('.ability-button');
                        if (button) {
                            const abilityId = button.dataset.abilityId;

                            // Check if the ability is currently active
                            if (activeAbilityStates.has(abilityId)) {
                                activeAbilityStates.delete(abilityId); // Turn off
                                button.classList.remove('toggled-red');
                                console.log(`Ability ${abilityId} turned OFF.`);
                            } else {
                                activeAbilityStates.add(abilityId); // Turn on
                                button.classList.add('toggled-red');
                                console.log(`Ability ${abilityId} turned ON.`);
                            }
                            // Re-render all attribute displays to update modifiers
                            // This is a comprehensive re-render of attributes section
                            const currentCharacter = activeCharacter; // Use the current active character
                            // Temporarily remove and re-add the entire character display to force re-render
                            // More efficient would be to only re-render attributes, but this ensures consistency
                            // For a full page re-render, reload the active character and then render
                            db.getActiveCharacter().then(updatedChar => {
                                activeCharacter = updatedChar; // Update global active character
                                // Instead of full innerHTML replace, target the attributes section
                                // Need to get the parent of .attributes-grid-container and re-render that specific section.
                                // For now, the existing full refresh of characterDetails will work.
                                // If renderCharacterAttributes was a separate function, we'd call it here
                                // For this example, we re-load and replace the relevant section:
                                const attributesSection = document.querySelector('.character-stats');
                                if (attributesSection) {
                                    // Construct the HTML for just the attributes section again
                                    let newAttributesHtml = '';
                                    if (updatedChar.attributes) {
                                        newAttributesHtml = Object.entries(updatedChar.attributes).map(([attr, die]) => {
                                            const initialModifiers = getActiveModifiersForAttribute(attr);
                                            const hasModifiers = initialModifiers.length > 0;

                                            let modifierSpans = '';
                                            for (let i = 0; i < MAX_MODIFIER_COLUMNS; i++) {
                                                const mod = initialModifiers[i];
                                                if (mod) {
                                                    modifierSpans += `<span class="modifier-display" style="color: ${mod.value > 0 ? '#03AC13' : '#FF0000'};" data-ability-name="${mod.abilityName}">${(mod.value > 0 ? '+' : '') + mod.value}</span>`;
                                                } else {
                                                    modifierSpans += `<span class="modifier-display empty-modifier-cell">&nbsp;</span>`;
                                                }
                                            }

                                            const unmodifiedResultHtml = hasModifiers
                                                ? `<div class="unmodified-roll-result">${attr.unmodifiedResult !== undefined ? attr.unmodifiedResult : ''}</div>`
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

                                        const initialLuckModifiers = getActiveModifiersForAttribute('luck');
                                        const hasLuckModifiers = initialLuckModifiers.length > 0;

                                        let luckModifierSpans = '';
                                        for (let i = 0; i < MAX_MODIFIER_COLUMNS; i++) {
                                            const mod = initialLuckModifiers[i];
                                            if (mod) {
                                                luckModifierSpans += `<span class="modifier-display" style="color: ${mod.value > 0 ? '#03AC13' : '#FF0000'};" data-ability-name="${mod.abilityName}">${(mod.value > 0 ? '+' : '') + mod.value}</span>`;
                                            } else {
                                                luckModifierSpans += `<span class="modifier-display empty-modifier-cell">&nbsp;</span>`;
                                            }
                                        }

                                        const unmodifiedLuckResultHtml = hasLuckModifiers
                                            ? `<div class="unmodified-roll-result"></div>`
                                            : `<div class="unmodified-roll-result empty-unmodified-cell">&nbsp;</div>`;

                                        newAttributesHtml += `
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

                                    attributesSection.innerHTML = `
                                        <h4>Attributes</h4>
                                        <div class="attributes-grid-container">
                                            ${newAttributesHtml}
                                        </div>
                                    `;
                                    attachAttributeRollListeners(); // Re-attach listeners for new buttons
                                }
                            });
                        }
                    });

                } else {
                    characterDetails.innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
                }
            }).catch(function(err) {
                console.error('Error loading character:', err);
            });
        })
        .catch(error => {
            console.error('play.js: Error loading abilities.json:', error);
            alert('Failed to load ability data. Please check the console for details.');
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