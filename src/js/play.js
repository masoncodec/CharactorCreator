// play.js (Updated)
// This file handles the main character display and interaction on the play page.
// REFACTORED: To use the new on-demand, module-based data loading system.

// Import shared modules
import { EffectHandler } from './effectHandler.js';
// UPDATED: Importing the new data loader functions.
import { loadGameModules, loadDataForModule } from './dataLoader.js';
import { alerter } from './alerter.js';
import { RollManager } from './RollManager.js';

const MAX_MODIFIER_COLUMNS = 5;

// Global variables
let moduleDefinitions = {};
let abilityData = {};
let flawData = {};
let perkData = {};
let activeAbilityStates = new Set();
let activeCharacter = null;

// This function remains the same, but now depends on the data loaded on-demand.
function processAndRenderCharacter(character) {
    if (!character) {
        document.getElementById('characterDetails').innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
        return;
    }

    EffectHandler.processActiveAbilities(character, abilityData, flawData, perkData, activeAbilityStates, 'play');
    const effectedCharacter = EffectHandler.applyEffectsToCharacter(character, 'play');

    const characterDetails = document.getElementById('characterDetails');
    const characterNameHeader = document.getElementById('characterNameHeader');

    if (characterNameHeader) {
        characterNameHeader.innerHTML = `
            ${effectedCharacter.info.name}
            <span class="character-subheader">Destiny: ${effectedCharacter.destiny} | Class: ${effectedCharacter.module || 'Crescendo'}</span>
        `;
    }

    let systemType = 'KOB';
    const moduleId = effectedCharacter.module;
    if (moduleId && moduleDefinitions && moduleDefinitions[moduleId]) {
        const moduleInfo = moduleDefinitions[moduleId];
        systemType = moduleInfo.type || 'KOB';
    }

    let attributesHtml = '';
    if (systemType === 'Hope/Fear') {
        attributesHtml = renderHopeFearUI(effectedCharacter);
    } else {
        attributesHtml = renderKOBUI(effectedCharacter);
    }

    characterDetails.innerHTML = `
        <div class="character-stats">
            <h4>Attributes</h4>
            <div class="attributes-grid-container">${attributesHtml}</div>
        </div>
        <div class="character-health health-display"></div>
        ${renderResources(effectedCharacter)}
        ${renderLanguages(effectedCharacter)}
        ${renderStatuses(effectedCharacter)}
        ${renderFlaws(effectedCharacter)}
        ${renderPerks(effectedCharacter)}
        ${effectedCharacter.inventory && effectedCharacter.inventory.length > 0 ? `...` : ''}
        ${renderAbilities(effectedCharacter)}
        <div class="character-info">...</div>
    `;

    renderHealthDisplay(effectedCharacter);

    if (systemType === 'Hope/Fear') {
        attachHopeFearRollListeners(effectedCharacter);
    } else {
        attachAttributeRollListeners();
    }
}

function renderHopeFearUI(effectedCharacter) {
    if (!effectedCharacter.attributes) return '';
    
    const containerStyle = "display: flex; flex-wrap: wrap; justify-content: space-around; gap: 1rem; padding: 1rem; background: #222; border-radius: 5px;";
    const attributeStyle = "display: flex; flex-direction: column; align-items: center; gap: 0.5rem;";
    const valueStyle = "font-size: 1.2rem; font-weight: bold; color: #a0c4ff;";

    const attributeButtons = Object.keys(effectedCharacter.attributes).map(attr => {
        const baseValue = effectedCharacter.attributes[attr];
        return `
            <div class="hope-fear-attribute" style="${attributeStyle}">
                <span class="hope-fear-name">${attr.charAt(0).toUpperCase() + attr.slice(1)}</span>
                <span class="hope-fear-value" style="${valueStyle}">${baseValue >= 0 ? '+' : ''}${baseValue}</span>
                <button class="btn-roll hope-fear-roll-btn" data-attribute="${attr}">Roll</button>
            </div>
        `;
    }).join('');

    return `<div class="hope-fear-container" style="${containerStyle}">${attributeButtons}</div>`;
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

// ... All other render and helper functions (renderKOBUI, renderAbilities, etc.) remain unchanged ...
function renderKOBUI(effectedCharacter) {
    let attributesHtml = '';
    if (effectedCharacter.attributes) {
        attributesHtml = Object.entries(effectedCharacter.attributes).map(([attr, die]) => {
            const initialModifiers = EffectHandler.getEffectsForAttribute(attr, "modifier");
            let modifierSpans = '';
            for (let i = 0; i < MAX_MODIFIER_COLUMNS; i++) {
                const mod = initialModifiers[i];
                if (mod) {
                    modifierSpans += `<span class="modifier-display" style="color: ${mod.modifier > 0 ? '#03AC13' : '#FF0000'};" data-item-name="${mod.itemName}" data-source-type="${mod.sourceType}">${(mod.modifier > 0 ? '+' : '') + mod.modifier}</span>`;
                } else {
                    modifierSpans += `<span class="modifier-display empty-modifier-cell">&nbsp;</span>`;
                }
            }
            const unmodifiedResultHtml = initialModifiers.length > 0
                ? `<div class="unmodified-roll-result"></div>`
                : `<div class="unmodified-roll-result empty-unmodified-cell">&nbsp;</div>`;
            return `
                <div class="attribute-row" data-attribute="${attr}" data-dice="${die}">
                    <label>${attr.charAt(0).toUpperCase() + attr.slice(1)}</label>
                    <span class="die-type">${String(die).toUpperCase()}</span>
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
                luckModifierSpans += `<span class="modifier-display" style="color: ${mod.modifier > 0 ? '#03AC13' : '#FF0000'};" data-item-name="${mod.itemName}" data-source-type="${mod.sourceType}">${(mod.modifier > 0 ? '+' : '') + mod.modifier}</span>`;
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
    return attributesHtml;
}

function updateAttributeRollDisplay(assignmentElement, baseResult, modifiedResult, activeModifiers) {
    let yellowResultEl = assignmentElement.querySelector('.roll-result');
    let blueResultEl = assignmentElement.querySelector('.unmodified-roll-result');
    if (!yellowResultEl || !blueResultEl) return;
    yellowResultEl.classList.remove('visible', 'fade-out');
    blueResultEl.classList.remove('visible', 'fade-out');
    blueResultEl.classList.remove('empty-unmodified-cell');
    assignmentElement.querySelectorAll('.modifier-display, .empty-modifier-cell').forEach(el => el.remove());
    yellowResultEl.textContent = modifiedResult;
    yellowResultEl.classList.add('visible');
    setTimeout(() => yellowResultEl.classList.add('fade-out'), 2000);
    const modifiersToDisplay = activeModifiers.slice(0, MAX_MODIFIER_COLUMNS);
    const rollResultColumn = assignmentElement.querySelector('.roll-result');
    let lastInsertedElement = rollResultColumn;
    modifiersToDisplay.forEach(mod => {
        const modSpan = document.createElement('span');
        modSpan.classList.add('modifier-display');
        modSpan.textContent = (mod.modifier > 0 ? '+' : '') + mod.modifier;
        modSpan.style.color = mod.modifier > 0 ? '#03AC13' : '#FF0000';
        modSpan.dataset.itemName = mod.itemName;
        modSpan.dataset.sourceType = mod.sourceType;
        lastInsertedElement.insertAdjacentElement('afterend', modSpan);
        lastInsertedElement = modSpan;
    });
    for (let i = modifiersToDisplay.length; i < MAX_MODIFIER_COLUMNS; i++) {
        const emptyModSpan = document.createElement('span');
        emptyModSpan.classList.add('modifier-display', 'empty-modifier-cell');
        emptyModSpan.innerHTML = '&nbsp;';
        lastInsertedElement.insertAdjacentElement('afterend', emptyModSpan);
        lastInsertedElement = emptyModSpan;
    }
    if (activeModifiers.length > 0) {
        blueResultEl.textContent = baseResult;
        blueResultEl.classList.add('visible');
        setTimeout(() => blueResultEl.classList.add('fade-out'), 2000);
    } else {
        blueResultEl.textContent = '';
        blueResultEl.classList.add('empty-unmodified-cell');
    }
}

function attachAttributeRollListeners() {
    document.querySelectorAll('.attribute-roll').forEach(btn => {
        btn.addEventListener('click', function() {
            const assignment = this.closest('.attribute-row');
            const attributeName = assignment.getAttribute('data-attribute');
            const dieType = assignment.getAttribute('data-dice');
            let baseResult = Math.floor(Math.random() * parseInt(dieType.substring(1))) + 1;
            const relevantActiveEffects = EffectHandler.activeEffects.filter(effect =>
                effect.attribute && effect.attribute.toLowerCase() === attributeName && effect.cost && effect.sourceType === "ability"
            );
            let canAffordAll = true;
            const costsToDeduct = {};
            relevantActiveEffects.forEach(effect => {
                const costResource = effect.cost.resource;
                const costValue = parseInt(effect.cost.value, 10);
                if (!costsToDeduct[costResource]) costsToDeduct[costResource] = 0;
                costsToDeduct[costResource] += costValue;
            });
            for (const resourceType in costsToDeduct) {
                const totalCost = costsToDeduct[resourceType];
                const charResource = activeCharacter.resources.find(r => r.type === resourceType);
                if (!charResource || charResource.value < totalCost) {
                    canAffordAll = false;
                    alerter.show(`Not enough ${resourceType} to use abilities affecting ${attributeName}.`, 'error');
                    break;
                }
            }
            if (!canAffordAll) return;
            if (Object.keys(costsToDeduct).length > 0) {
                const newResources = activeCharacter.resources.map(res => {
                    if (costsToDeduct[res.type]) return { ...res, value: res.value - costsToDeduct[res.type] };
                    return res;
                });
                db.updateCharacterResources(activeCharacter.id, newResources).then(updatedChar => {
                    activeCharacter = updatedChar;
                    processAndRenderCharacter(activeCharacter);
                    alerter.show(`Costs deducted for active abilities affecting ${attributeName}.`, 'info');
                }).catch(err => {
                    alerter.show('Error deducting costs. See console.', 'error');
                    console.error('Error deducting character resources:', err);
                    return;
                });
            }
            const activeModifiers = EffectHandler.getEffectsForAttribute(attributeName, "modifier");
            let totalModifier = activeModifiers.reduce((sum, mod) => sum + (mod.modifier || 0), 0);
            const modifiedResult = baseResult + totalModifier;
            updateAttributeRollDisplay(assignment, baseResult, modifiedResult, activeModifiers);
        });
    });
}

function renderAbilities(character) {
    if (!character.abilities || character.abilities.length === 0) return '';
    const activeAbilitiesHtml = [];
    const passiveAbilitiesHtml = [];
    character.abilities.forEach(abilityState => {
        const abilityDef = abilityData[abilityState.id];
        if (!abilityDef) return;
        let description = abilityDef.description.replace(/\${([^}]+)}/g, (match, p1) => {
            try {
                const path = p1.split('.');
                let current = abilityDef;
                for (let i = 0; i < path.length; i++) { current = current?.[path[i]]; }
                return current !== undefined ? current : match;
            } catch (e) { return match; }
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
            activeAbilitiesHtml.push(`<li class="ability-list-item"><button class="ability-button ability-card ${isOn}" data-ability-id="${abilityState.id}"><strong>${abilityDef.name}</strong> <span class="ability-type-tag active">ACTIVE</span><p>${description}</p>${optionsHtml}</button></li>`);
        } else {
            passiveAbilitiesHtml.push(`<li class="ability-card passive-ability-item"><strong>${abilityDef.name}</strong> <span class="ability-type-tag passive">PASSIVE</span><p>${description}</p>${optionsHtml}</li>`);
        }
    });
    return `<div class="character-abilities"><h4>Abilities</h4><div class="abilities-section-active"><h5>Active Abilities</h5><ul id="activeAbilitiesList">${activeAbilitiesHtml.join('')}</ul></div><div class="abilities-section-passive"><h5>Passive Abilities</h5><ul id="passiveAbilitiesList">${passiveAbilitiesHtml.join('')}</ul></div></div>`;
}

function highlightActiveNav(pageName) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').includes(pageName)) {
            link.classList.add('active');
        }
    });
}

function renderHealthDisplay(character) {
    if (!character || !character.health) return;
    const healthDisplayContainer = document.querySelector('.character-health.health-display');
    if (!healthDisplayContainer) return;
    const currentMaxHealth = character.calculatedHealth ? character.calculatedHealth.currentMax : character.health.max;
    const healthPercentage = (character.health.current / currentMaxHealth) * 100;
    let healthClass = healthPercentage > 60 ? 'health-full' : healthPercentage > 30 ? 'health-medium' : 'health-low';
    healthDisplayContainer.innerHTML = `<h4>Health</h4><div class="health-controls"><input type="number" id="healthAdjustmentInput" placeholder="e.g. -5, +10" class="form-control" /><button id="applyHealthAdjustment" class="btn btn-primary">Apply</button></div><div class="health-bar-container"><div class="health-bar ${healthClass}" style="width: ${healthPercentage}%"></div></div><div class="health-numbers">${character.health.current} / ${currentMaxHealth} ${character.health.temporary ? `(+${character.health.temporary} temp)` : ''}</div>`;
    const applyButton = document.getElementById('applyHealthAdjustment');
    const inputField = document.getElementById('healthAdjustmentInput');
    applyButton.addEventListener('click', function() {
        const adjustment = parseInt(inputField.value, 10);
        if (isNaN(adjustment)) { alerter.show('Invalid input.', 'error'); inputField.value = ''; return; }
        let newCurrentHealth = Math.max(0, character.health.current + adjustment);
        const finalMaxHealth = character.calculatedHealth ? character.calculatedHealth.currentMax : character.health.max;
        newCurrentHealth = Math.min(newCurrentHealth, finalMaxHealth);
        db.updateCharacterHealth(activeCharacter.id, { current: newCurrentHealth }).then(updatedCharacter => {
            activeCharacter = updatedCharacter;
            processAndRenderCharacter(activeCharacter);
            inputField.value = '';
        }).catch(err => {
            alerter.show('Error updating health.', 'error');
            console.error('Error updating character health:', err);
        });
    });
    inputField.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyButton.click(); } });
}

function renderResources(character) {
    if (!character.resources || character.resources.length === 0) return '';
    return `<div class="character-resources"><h4>Resources</h4><ul class="resource-list">${character.resources.map(r => `<li><strong>${r.type.charAt(0).toUpperCase() + r.type.slice(1)}:</strong> ${r.value} ${r.max !== undefined ? `/ ${r.max}` : ''}</li>`).join('')}</ul></div>`;
}

function renderLanguages(character) {
    if (!character.languages || character.languages.length === 0) return '';
    return `<div class="character-languages"><h4>Languages</h4><ul>${character.languages.map(lang => `<li>${lang}</li>`).join('')}</ul></div>`;
}

function renderStatuses(character) {
    if (!character.statuses || character.statuses.length === 0) return '';
    return `<div class="character-statuses"><h4>Active Statuses</h4><ul>${character.statuses.map(s => `<li>${s.name}</li>`).join('')}</ul></div>`;
}

function renderFlaws(character) {
    if (!character.flaws || character.flaws.length === 0) return '';
    return `<div class="character-flaws"><h4>Flaws</h4><ul>${character.flaws.map(flawState => {
        const flawDef = flawData[flawState.id];
        if (!flawDef) return `<li>Unknown Flaw (ID: ${flawState.id})</li>`;
        let optionsHtml = '';
        if (flawDef.options && flawState.selections && flawState.selections.length > 0) {
            optionsHtml = `<p class="flaw-selections">Selections: ${flawState.selections.map(s => { const o = flawDef.options.find(opt => opt.id === s.id); return o ? o.name : s.id; }).join(', ')}</p>`;
        }
        return `<li class="flaw-item"><strong>${flawDef.name}</strong><p>${flawDef.description}</p>${optionsHtml}</li>`;
    }).join('')}</ul></div>`;
}

function renderPerks(character) {
    if (!character.perks || character.perks.length === 0) return '';
    return `<div class="character-perks"><h4>Perks</h4><ul>${character.perks.map(perkState => {
        const perkDef = perkData[perkState.id];
        if (!perkDef) return `<li>Unknown Perk (ID: ${perkState.id})</li>`;
        let optionsHtml = '';
        if (perkDef.options && perkState.selections && perkState.selections.length > 0) {
            optionsHtml = `<p class="perk-selections">Selections: ${perkState.selections.map(s => { const o = perkDef.options.find(opt => opt.id === s.id); return o ? o.name : s.id; }).join(', ')}</p>`;
        }
        return `<li class="perk-item"><strong>${perkDef.name}</strong><p>${perkDef.description}</p>${optionsHtml}</li>`;
    }).join('')}</ul></div>`;
}

// ** ENTIRE DOMCONTENTLOADED LISTENER IS REFACTORED **
document.addEventListener('DOMContentLoaded', async function() {
    highlightActiveNav('play.html');

    const characterDetails = document.getElementById('characterDetails');
    if (characterDetails) {
        characterDetails.addEventListener('click', function(event) {
            let targetModSpan = event.target.closest('.modifier-display');
            if (targetModSpan && !targetModSpan.classList.contains('empty-modifier-cell')) {
                targetModSpan.querySelectorAll('.modifier-tooltip').forEach(tip => tip.remove());
                const tooltip = document.createElement('div');
                tooltip.classList.add('modifier-tooltip');
                const itemName = targetModSpan.dataset.itemName;
                const sourceType = targetModSpan.dataset.sourceType;
                tooltip.textContent = `${itemName} (Source: ${sourceType.charAt(0).toUpperCase() + sourceType.slice(1)})`;
                targetModSpan.appendChild(tooltip);
                setTimeout(() => { if (targetModSpan.contains(tooltip)) targetModSpan.removeChild(tooltip); }, 3000);
            }
        });
    }

    try {
        // Step 1: Load all module definitions first. This is always needed.
        const { moduleSystemData } = await loadGameModules();
        moduleDefinitions = moduleSystemData;
        console.log('play.js: All module definitions loaded.');

        // Step 2: Get the currently active character from the database.
        activeCharacter = await db.getActiveCharacter();
        if (!activeCharacter) {
            alerter.show('No active character found.', 'info');
            characterDetails.innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
            return;
        }

        // Step 3: Check if the character has a module. If not, stop and show an error.
        if (!activeCharacter.module) {
            console.error('Active character is missing the required "module" property.');
            alerter.show('Character is from an older version and is missing a module definition.', 'error');
            characterDetails.innerHTML = `<p><strong>Error:</strong> This character cannot be loaded because it's from an older version of the game. It must be updated with a module assignment.</p>`;
            return; // Stop execution
        }

        // Step 4: Load the specific data for that character's module.
        console.log(`play.js: Loading data for module: ${activeCharacter.module}`);
        const moduleDef = moduleDefinitions[activeCharacter.module];
        const moduleSpecificData = await loadDataForModule(moduleDef);

        // Step 5: Populate the global data variables.
        abilityData = moduleSpecificData.abilityData || {};
        flawData = moduleSpecificData.flawData || {};
        perkData = moduleSpecificData.perkData || {};
        // Note: equipmentAndLootData is also available in moduleSpecificData if needed later.
        console.log('play.js: Module-specific data loaded successfully.');
        
        // Step 6: Now that all data is loaded, render the character.
        processAndRenderCharacter(activeCharacter);

    } catch (error) {
        console.error('play.js: A critical error occurred during initialization:', error);
        alerter.show('Failed to load game or character data. Please check the console.', 'error');
    }

    document.getElementById('characterDetails').addEventListener('click', function(event) {
        const button = event.target.closest('.ability-button');
        if (button) {
            const abilityId = button.dataset.abilityId;
            if (activeAbilityStates.has(abilityId)) {
                activeAbilityStates.delete(abilityId);
            } else {
                activeAbilityStates.add(abilityId);
            }
            processAndRenderCharacter(activeCharacter);
        }
    });

    document.getElementById('rollD20').addEventListener('click', function() {
        const result = Math.floor(Math.random() * 20) + 1;
        const diceResult = document.getElementById('diceResult');
        diceResult.textContent = '...';
        setTimeout(() => { diceResult.textContent = result; }, 500);
    });

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
            const a = document.createElement('a');
            a.href = exportData.url;
            a.download = exportData.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(exportData.url), 100);
        }).catch(function(err) {
            console.error('Export failed:', err);
            alerter.show('Export failed: ' + err, 'error');
        });
    });
});