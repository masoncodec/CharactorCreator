// play.js (Updated)
// This file handles the main character interaction, data loading, and event handling on the play page.
// Rendering logic has been moved to play-ui.js.

import { EffectHandler } from './effectHandler.js';
import { loadGameModules, loadDataForModule } from './dataLoader.js'; //
import { alerter } from './alerter.js'; //
import { RollManager } from './RollManager.js';
import { renderTopNav, renderMainTab, renderAbilitiesTab, renderProfileTab, renderInventoryTab } from './play-ui.js';
import { aggregateAllAbilities } from './abilityAggregator.js';

// Global variables
let moduleDefinitions = {};
let abilityData = {};
let flawData = {};
let perkData = {};
let equipmentData = {};
let activeAbilityStates = new Set();
let activeCharacter = null;

/**
 * Main function to process a character's data and render the entire layout.
 * It calls the rendering functions from play-ui.js to populate the new structure.
 */
function processAndRenderAll(character) {
    if (!character) {
        document.querySelector('.play-content-scrollable').innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
        return;
    }

    // 1. Aggregate all abilities from character and equipped items
    const allAbilities = aggregateAllAbilities(character, abilityData, equipmentData);

    // 2. Process effects using the aggregated list
    EffectHandler.processActiveAbilities(allAbilities, character, flawData, perkData, activeAbilityStates, 'play');
    const effectedCharacter = EffectHandler.applyEffectsToCharacter(character, 'play', activeAbilityStates);

    // Render all components of the new UI
    renderTopNav(effectedCharacter, moduleDefinitions);
    renderMainTab(effectedCharacter, moduleDefinitions);
    // The call to renderAbilitiesTab is now simpler
    renderAbilitiesTab(allAbilities, effectedCharacter);
    renderProfileTab(effectedCharacter, flawData, perkData);
    renderInventoryTab(effectedCharacter);

    // Re-attach listeners that might be on elements inside the rendered tabs
    attachDynamicListeners(effectedCharacter);
}

/**
 * Attaches event listeners to dynamically created elements.
 */
function attachDynamicListeners(character) {
    const contentArea = document.querySelector('.play-content-scrollable');
    if (!contentArea) return;

    // Health Adjustment Listener
    const applyHealthBtn = contentArea.querySelector('#applyHealthAdjustment');
    const healthInput = contentArea.querySelector('#healthAdjustmentInput');
    if (applyHealthBtn && healthInput) {
        applyHealthBtn.onclick = () => {
            const adjustment = parseInt(healthInput.value, 10);
            if (isNaN(adjustment)) {
                alerter.show('Invalid input.', 'error'); //
                healthInput.value = '';
                return;
            }
            let newCurrentHealth = Math.max(0, character.health.current + adjustment); //
            const finalMaxHealth = character.calculatedHealth ? character.calculatedHealth.currentMax : character.health.max; //
            newCurrentHealth = Math.min(newCurrentHealth, finalMaxHealth);

            db.updateCharacterHealth(activeCharacter.id, { current: newCurrentHealth }).then(updatedCharacter => {
                activeCharacter = updatedCharacter;
                processAndRenderAll(activeCharacter);
            }).catch(err => {
                alerter.show('Error updating health.', 'error'); //
                console.error('Error updating character health:', err);
            });
        };
        healthInput.onkeypress = (e) => { if (e.key === 'Enter') { e.preventDefault(); applyHealthBtn.click(); } };
    }

    // Attribute Roll Listeners
    let systemType = 'KOB';
    const moduleId = character.module;
    if (moduleId && moduleDefinitions && moduleDefinitions[moduleId]) {
        systemType = moduleDefinitions[moduleId].type || 'KOB';
    }

    if (systemType === 'Hope/Fear') {
        attachHopeFearRollListeners(character);
    } else {
        attachKOBRollListeners(character);
    }

    // Ability Toggle Listener
    const abilitiesPanel = contentArea.querySelector('#abilities-panel');
    if (abilitiesPanel) {
        abilitiesPanel.onclick = (event) => {
            const button = event.target.closest('.ability-button');
            if (button) {
                const abilityId = button.dataset.abilityId;
                if (activeAbilityStates.has(abilityId)) {
                    activeAbilityStates.delete(abilityId);
                } else {
                    activeAbilityStates.add(abilityId);
                }
                // Re-render all content to reflect state changes
                processAndRenderAll(activeCharacter);
            }
        };
    }
}

function attachKOBRollListeners(character) {
    document.querySelectorAll('.attribute-roll').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('.attribute-row');
            const attributeName = row.dataset.attribute;
            const dieType = row.dataset.dice;
            let baseResult = Math.floor(Math.random() * parseInt(dieType.substring(1))) + 1;

            const activeModifiers = EffectHandler.getEffectsForAttribute(attributeName, "modifier"); //
            let totalModifier = activeModifiers.reduce((sum, mod) => sum + (mod.modifier || 0), 0);
            const modifiedResult = baseResult + totalModifier;
            
            // This function needs to be defined to update the display
            updateAttributeRollDisplay(row, baseResult, modifiedResult, activeModifiers);
        });
    });
}

function updateAttributeRollDisplay(row, baseResult, modifiedResult, activeModifiers) {
    let resultEl = row.querySelector('.roll-result');
    resultEl.textContent = modifiedResult;
    resultEl.classList.add('visible');
    setTimeout(() => resultEl.classList.add('fade-out'), 2000);

    let unmodifiedResultEl = row.querySelector('.unmodified-roll-result');
    if (activeModifiers.length > 0) {
        unmodifiedResultEl.textContent = baseResult;
        unmodifiedResultEl.classList.remove('empty-unmodified-cell');
        unmodifiedResultEl.classList.add('visible');
        setTimeout(() => unmodifiedResultEl.classList.add('fade-out'), 2000);
    }
}

function attachHopeFearRollListeners(effectedCharacter) {
    document.querySelectorAll('.hope-fear-roll-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const attributeName = this.dataset.attribute;
            
            const numericalEffects = EffectHandler.getEffectsForAttribute(attributeName, 'modifier');
            const diceNumEffects = EffectHandler.getEffectsForAttribute(attributeName, 'die_num');
            
            const baseValue = effectedCharacter.attributes[attributeName] || 0;

            const modifierData = {
                totalNumerical: numericalEffects.reduce((sum, eff) => sum + (eff.modifier || 0), 0),
                totalDiceNum: diceNumEffects.reduce((sum, eff) => sum + (eff.modifier || 0), 0),
                sources: [...numericalEffects, ...diceNumEffects]
            };

            const rollManager = new RollManager(attributeName.charAt(0).toUpperCase() + attributeName.slice(1), modifierData, baseValue);
            rollManager.show();
        });
    });
}

/**
 * Initializes the page on load: loads data, sets up listeners.
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { moduleSystemData } = await loadGameModules(); //
        moduleDefinitions = moduleSystemData;

        activeCharacter = await db.getActiveCharacter();
        if (!activeCharacter) {
            alerter.show('No active character found.', 'info'); //
            document.querySelector('.play-content-scrollable').innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
            return;
        }

        const moduleDef = moduleDefinitions[activeCharacter.module];
        const moduleSpecificData = await loadDataForModule(moduleDef); //
        abilityData = moduleSpecificData.abilityData || {};
        flawData = moduleSpecificData.flawData || {};
        perkData = moduleSpecificData.perkData || {};
        equipmentData = moduleSpecificData.equipmentAndLootData || {};

        // Initial render
        processAndRenderAll(activeCharacter);

        // --- STATIC EVENT LISTENERS ---

        // Tab Switching Logic
        const tabsNav = document.querySelector('.tabs-nav');
        tabsNav.addEventListener('click', (event) => {
            const target = event.target.closest('.tab-button');
            if (!target) return;

            // Update button states
            tabsNav.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');

            // Update panel visibility
            const tabId = target.dataset.tab;
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === tabId) {
                    panel.classList.add('active');
                }
            });
        });

        // Level Up Button
        document.getElementById('levelUpBtn')?.addEventListener('click', () => {
            if (!activeCharacter) return;
            sessionStorage.setItem('levelUpCharacterId', activeCharacter.id);
            window.location.href = 'character-creator.html';
        });

        // Export Button
        document.getElementById('exportSingleCharacterBtn').addEventListener('click', () => {
            if (!activeCharacter) return;
            db.exportCharacter(activeCharacter.id, activeCharacter.info.name).then(exportData => { //
                const a = document.createElement('a');
                a.href = exportData.url;
                a.download = exportData.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(exportData.url), 100);
            }).catch(err => alerter.show('Export failed: ' + err, 'error')); //
        });

    } catch (error) {
        console.error('A critical error occurred during initialization:', error);
        alerter.show('Failed to load game data. Check console.', 'error'); //
    }
});