// Function to highlight the active navigation link
function highlightActiveNav(pageName) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').includes(pageName)) {
            link.classList.add('active');
        }
    });
}

// Function to attach attribute roll event listeners
function attachAttributeRollListeners() {
    document.querySelectorAll('.attribute-roll').forEach(btn => {
        btn.addEventListener('click', function() {
            const assignment = this.closest('.dice-assignment');
            const dieType = assignment.getAttribute('data-dice');
            const result = Math.floor(Math.random() * parseInt(dieType.substring(1))) + 1;
            
            const resultEl = assignment.querySelector('.roll-result');
            resultEl.textContent = result;
            resultEl.classList.add('visible');
            
            setTimeout(() => resultEl.classList.remove('visible'), 2000);
        });
    });
}

// Global variable to hold ability data
let abilityData = {}; // Initialize as empty object

// Global variable to hold the state of active toggleable abilities
// Resets on page refresh as requested.
let activeAbilityStates = new Set(); 

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

        if (abilityDef.type === "active") { //
            const isOn = activeAbilityStates.has(abilityState.id) ? 'toggled-red' : '';
            activeAbilitiesHtml.push(`
                <li class="ability-list-item"> <button class="ability-button ability-item ${isOn}" data-ability-id="${abilityState.id}">
                        <strong>${abilityDef.name}</strong> (Tier ${abilityState.tier})
                        <p>${description}</p>
                        ${optionsHtml}
                    </button>
                </li>
            `);
        } else { // Passive ability
            passiveAbilitiesHtml.push(`
                <li class="ability-item passive-ability-item">
                    <strong>${abilityDef.name}</strong> (Tier ${abilityState.tier})
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

// Initialize play page
document.addEventListener('DOMContentLoaded', function() {
    highlightActiveNav('play.html'); // Highlight "Play" link

    let activeCharacter = null; // Variable to store the active character

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
                                        <div class="roll-result"></div>
                                    </div>
                                `).join('')}
                                <div class="dice-assignment" data-dice="d100">
                                    <label>Luck</label>
                                    <div class="die-type">D100</div>
                                    <button class="btn-roll attribute-roll">Roll</button>
                                    <div class="roll-result"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="character-health">
                            <h4>Health</h4>
                            <div class="health-bar">
                                <div class="health-current" style="width: ${(character.health.current / character.health.max) * 100}%"></div>
                            </div>
                            <div class="health-numbers">
                                ${character.health.current} / ${character.health.max}
                                ${character.health.temporary ? `(+${character.health.temporary} temp)` : ''}
                            </div>
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
                    attachAttributeRollListeners(); // Attach listeners after content is loaded

                    // Attach event listener for active ability buttons
                    document.getElementById('activeAbilitiesList').addEventListener('click', function(event) {
                        const button = event.target.closest('.ability-button');
                        if (button) {
                            const abilityId = button.dataset.abilityId;
                            
                            // Check if the ability is currently active
                            if (activeAbilityStates.has(abilityId)) {
                                activeAbilityStates.delete(abilityId); // Turn off
                                button.classList.remove('toggled-red'); //
                                console.log(`Ability ${abilityId} turned OFF.`);
                                // TODO: Add logic for deactivating ability effects (e.g., remove buffs)
                            } else {
                                activeAbilityStates.add(abilityId); // Turn on
                                button.classList.add('toggled-red'); //
                                console.log(`Ability ${abilityId} turned ON.`);
                                // TODO: Add logic for activating ability effects (e.g., apply buffs, check resource costs)
                                // TODO: Implement cooldowns here
                            }
                            // You might want to update some character property here
                            // For now, it's local persistence only.
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
    document.getElementById('exportSingleCharacterBtn').addEventListener('click', function() { // Changed ID
        if (!activeCharacter) {
            alert('No character selected to export.');
            return;
        }

        db.exportCharacter(activeCharacter.id, activeCharacter.info.name).then(function(exportData) { // Pass ID and name
            if (!exportData) {
                alert('Selected character not found for export.');
                return;
            }
            
            // Log the exported data for debugging
            console.log('Exporting character:', exportData.data);
            
            const a = document.createElement('a');
            a.href = exportData.url;
            a.download = exportData.filename;
            document.body.appendChild(a); // Append to body to make it clickable in all browsers
            a.click();
            document.body.removeChild(a); // Clean up
            setTimeout(function() {
                URL.revokeObjectURL(exportData.url);
            }, 100);
        }).catch(function(err) {
            console.error('Export failed:', err);
            alert('Export failed: ' + err);
        });
    });
});