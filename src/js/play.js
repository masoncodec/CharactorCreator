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

// Helper function to render modifier display elements
function renderModifierDisplays(modifiers, containerElement) {
    containerElement.innerHTML = ''; // Clear previous modifiers
    if (modifiers.length > 0) {
        modifiers.forEach(mod => {
            const modSpan = document.createElement('span');
            modSpan.classList.add('modifier-display');
            modSpan.textContent = (mod.value > 0 ? '+' : '') + mod.value;
            modSpan.style.color = mod.value > 0 ? '#03AC13' : '#FF0000'; // Apply colors
            modSpan.dataset.abilityName = mod.abilityName; // Store ability name for tooltip

            // Add click listener for tooltip
            modSpan.addEventListener('click', function(event) {
                const tooltip = document.createElement('div');
                tooltip.classList.add('modifier-tooltip');
                tooltip.textContent = this.dataset.abilityName;
                // Position the tooltip over the number
                tooltip.style.left = `${event.clientX}px`;
                tooltip.style.top = `${event.clientY - 20}px`; // Adjust for vertical positioning
                document.body.appendChild(tooltip);

                // Remove tooltip after a few seconds
                setTimeout(() => {
                    if (document.body.contains(tooltip)) { // Check if it still exists before removing
                        document.body.removeChild(tooltip);
                    }
                }, 3000); // Visible for 3 seconds
            });
            containerElement.appendChild(modSpan);
        });
    }
}


// Function to attach attribute roll event listeners
function attachAttributeRollListeners() {
    document.querySelectorAll('.attribute-roll').forEach(btn => {
        btn.addEventListener('click', function() {
            const assignment = this.closest('.dice-assignment');
            const attributeName = assignment.getAttribute('data-attribute');
            const dieType = assignment.getAttribute('data-dice');
            const baseResult = Math.floor(Math.random() * parseInt(dieType.substring(1))) + 1;

            const activeModifiers = getActiveModifiersForAttribute(attributeName);
            let totalModifier = activeModifiers.reduce((sum, mod) => sum + mod.value, 0);

            const modifiedResult = baseResult + totalModifier; // Apply modifier to the result

            const blueResultEl = assignment.querySelector('.unmodified-roll-result'); // Blue unmodified result
            const yellowResultEl = assignment.querySelector('.roll-result'); // Yellow modified result
            const modifiersContainer = assignment.querySelector('.modifiers-container'); // Container for modifiers

            // Reset visibility
            blueResultEl.textContent = '';
            yellowResultEl.textContent = '';
            blueResultEl.classList.remove('visible', 'fade-out');
            yellowResultEl.classList.remove('visible', 'fade-out');

            // Display blue unmodified result if there are mods
            if (activeModifiers.length > 0) {
                blueResultEl.textContent = baseResult;
                blueResultEl.classList.add('visible');
                setTimeout(() => blueResultEl.classList.add('fade-out'), 2000); // Fade out after 2 seconds
            }

            // Display yellow modified result
            yellowResultEl.textContent = modifiedResult;
            yellowResultEl.classList.add('visible');
            setTimeout(() => yellowResultEl.classList.add('fade-out'), 2000); // Fade out after 2 seconds

            // Re-render modifiers explicitly on roll
            renderModifierDisplays(activeModifiers, modifiersContainer);
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
                    characterDetails.innerHTML = `
                        <div class="character-header">
                            <h3>${character.info.name}</h3>
                            <p class="character-module">${character.module || 'Crescendo'}</p>
                            <p class="character-role">${character.destiny}</p>
                        </div>

                        <div class="character-stats">
                            <h4>Attributes</h4>
                            <div class="dice-assignments">
                                ${Object.entries(character.attributes).map(([attr, die]) => `
                                    <div class="dice-assignment" data-attribute="${attr}" data-dice="${die}">
                                        <label>${attr.charAt(0).toUpperCase() + attr.slice(1)}</label>
                                        <div class="die-type">${die.toUpperCase()}</div>
                                        <button class="btn-roll attribute-roll">Roll</button>
                                        <div class="unmodified-roll-result"></div>
                                        <div class="modifiers-container"></div>
                                        <div class="roll-result"></div>
                                    </div>
                                `).join('')}
                                <div class="dice-assignment" data-attribute="luck" data-dice="d100">
                                    <label>Luck</label>
                                    <div class="die-type">D100</div>
                                    <button class="btn-roll attribute-roll">Roll</button>
                                    <div class="unmodified-roll-result"></div>
                                    <div class="modifiers-container"></div>
                                    <div class="roll-result"></div>
                                </div>
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

                        ${renderAbilities(character)}  <div class="character-info">
                            <h4>Info</h4>
                            <p><strong>Name:</strong> ${character.info.name}</p>
                            <p><strong>Bio:</strong> ${character.info.bio || 'N/A'}</p>
                        </div>
                    `;
                    // Render initial health display
                    renderHealthDisplay(activeCharacter); // Call the new function here

                    // After character details are rendered, initialize modifier displays
                    document.querySelectorAll('.dice-assignment').forEach(assignment => {
                        const attributeName = assignment.getAttribute('data-attribute');
                        const modifiersContainer = assignment.querySelector('.modifiers-container');
                        const activeModifiers = getActiveModifiersForAttribute(attributeName);
                        renderModifierDisplays(activeModifiers, modifiersContainer);
                    });

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
                            // Re-render all modifier displays across attributes
                            document.querySelectorAll('.dice-assignment').forEach(assignment => {
                                const attributeName = assignment.getAttribute('data-attribute');
                                const modifiersContainer = assignment.querySelector('.modifiers-container');
                                const activeModifiers = getActiveModifiersForAttribute(attributeName);
                                renderModifierDisplays(activeModifiers, modifiersContainer);
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