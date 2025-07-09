// js/play-ui.js
// This module contains all UI rendering functions for the play page.

import { EffectHandler } from './effectHandler.js';
import { RollManager } from './RollManager.js';

const MAX_MODIFIER_COLUMNS = 5;

// This new configuration object defines the layout for the equipment slots.
// You can easily add, remove, or change slots here in the future.
const EQUIPMENT_SLOT_CONFIG = {
    "Weapons": ["main-hand", "off-hand"],
    "Armor": ["head", "chest", "hands", "legs", "feet"],
    "Accessories": ["ring_1", "ring_2", "amulet"]
};

/**
 * Renders the top navigation bar with detailed character information.
 */
export function renderTopNav(character, moduleDefinitions) {
    const headerInfo = document.getElementById('character-header-info');
    if (!headerInfo || !character) return;

    const moduleName = moduleDefinitions[character.module]?.name || 'Unknown';

    headerInfo.innerHTML = `
        <h2>${character.info.name}</h2>
        <p>Level ${character.level} ${character.destiny} | ${character.purpose} | ${character.nurture} | ${moduleName}</p>
    `; //
}

/**
 * Renders the content for the 'Main' tab, including attributes, health, and resources.
 */
export function renderMainTab(character, moduleDefinitions) {
    const panel = document.getElementById('main-panel');
    if (!panel) return '';

    let systemType = 'KOB';
    const moduleId = character.module;
    if (moduleId && moduleDefinitions && moduleDefinitions[moduleId]) {
        systemType = moduleDefinitions[moduleId].type || 'KOB';
    }

    let attributesHtml = '';
    if (systemType === 'Hope/Fear') {
        attributesHtml = renderHopeFearUI(character);
    } else {
        attributesHtml = renderKOBUI(character);
    }

    panel.innerHTML = `
        <div class="panel">
            <h2>Attributes</h2>
            <div class="attributes-grid-container">${attributesHtml}</div>
        </div>
        <div class="panel health-panel">
            <h2>Health</h2>
            <div class="character-health health-display"></div>
        </div>
        <div class="panel resources-panel">
            <h2>Resources</h2>
            ${renderResources(character)}
        </div>
    `;
    renderHealthDisplay(character);
}

/**
 * Renders the content for the 'Abilities' tab using the aggregated list.
 */
export function renderAbilitiesTab(allAbilities, character) {
    const panel = document.getElementById('abilities-panel');
    if (!panel) return;
    panel.innerHTML = renderAbilities(allAbilities, character);
}

/**
 * Helper function to generate HTML for the abilities list.
 */
function renderAbilities(allAbilities, character) {
    if (!allAbilities || allAbilities.length === 0) return '<div class="panel"><p>No abilities available.</p></div>';
    
    const activeAbilitiesHtml = [];
    const passiveAbilitiesHtml = [];

    allAbilities.forEach(ability => {
        const abilityDef = ability.definition;
        if (!abilityDef) return;

        const sourceLabel = ability.sourceType === 'equipment'
            ? `<p class="ability-source">Source: ${ability.sourceName}</p>`
            : '';

        let description = abilityDef.description.replace(/\${([^}]+)}/g, (match, p1) => { /* ... description parsing ... */ });

        if (ability.itemType === "active") {
            const isOn = character.activeAbilityIds && character.activeAbilityIds.has(ability.instancedId) ? 'selected' : '';
            activeAbilitiesHtml.push(
                `<li class="ability-list-item">
                    <button class="ability-button ability-card ${isOn}" data-ability-id="${ability.instancedId}">
                        <strong>${abilityDef.name}</strong> 
                        <span class="ability-type-tag active">ACTIVE</span>
                        <p>${description}</p>
                        ${sourceLabel}
                    </button>
                </li>`
            );
        } else {
            passiveAbilitiesHtml.push(
                `<li class="ability-card passive-ability-item">
                    <strong>${abilityDef.name}</strong> 
                    <span class="ability-type-tag passive">PASSIVE</span>
                    <p>${description}</p>
                    ${sourceLabel}
                </li>`
            );
        }
    });

    const activeSection = activeAbilitiesHtml.length > 0 ? `<div class="panel"><h2>Active Abilities</h2><ul id="activeAbilitiesList">${activeAbilitiesHtml.join('')}</ul></div>` : '';
    const passiveSection = passiveAbilitiesHtml.length > 0 ? `<div class="panel"><h2>Passive Abilities</h2><ul id="passiveAbilitiesList">${passiveAbilitiesHtml.join('')}</ul></div>` : '';

    return activeSection + passiveSection;
}

/**
 * Renders the content for the 'Profile' tab, including flaws, perks, statuses, and languages.
 */
export function renderProfileTab(character, flawData, perkData) {
    const panel = document.getElementById('profile-panel');
    if (!panel) return;

    // The #traits-panel grid from the CSS is a good fit here
    panel.innerHTML = `
      <div id="traits-panel">
        <div class="panel">
          <h2>Flaws</h2>
          ${renderFlaws(character, flawData)}
        </div>
        <div class="panel">
          <h2>Perks</h2>
          ${renderPerks(character, perkData)}
        </div>
        <div class="panel">
          <h2>Active Statuses</h2>
          ${renderStatuses(character)}
        </div>
        <div class="panel">
          <h2>Languages</h2>
          ${renderLanguages(character)}
        </div>
      </div>
    `;
}

// Renders the equipment table. This is now a reusable component.
function renderEquipmentTableComponent(equipmentItems) {
    if (equipmentItems.length === 0) {
        return '<h2>Equipment</h2><p>No equipment.</p>';
    }

    const tableRows = equipmentItems.map(item => {
        const itemDef = item.definition;
        const actionButton = `<button class="btn btn-secondary btn-sm btn-equip" data-item-id="${item.id}">
                                ${item.equipped ? 'Unequip' : 'Equip'}
                              </button>`;
        return `
            <tr>
                <td>${itemDef.name}</td>
                <td>${itemDef.category.charAt(0).toUpperCase() + itemDef.category.slice(1)}</td>
                <td>${itemDef.rarity.charAt(0).toUpperCase() + itemDef.rarity.slice(1)}</td>
                <td>${item.equipped ? 'Yes' : 'No'}</td>
                <td>${actionButton}</td>
            </tr>
        `;
    }).join('');

    return `
        <h2>Equipment</h2>
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Rarity</th>
                    <th>Equipped</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    `;
}

// Renders the Loot & Items table.
function renderLootTableComponent(lootItems) {
    if (lootItems.length === 0) {
        return '<h2>Loot & Items</h2><p>No other items.</p>';
    }

    const tableRows = lootItems.map(item => {
        const itemDef = item.definition;
        const quantity = item.quantity || 1;
        const totalValue = (itemDef.value || 0) * quantity;
        
        let actionButton = '—';
        if (itemDef.category === 'potion') {
            actionButton = `<button class="btn btn-info btn-sm btn-use" data-item-id="${item.id}" data-item-name="${itemDef.name}">Use</button>`;
        } else if (itemDef.category === 'material') {
            actionButton = `<button class="btn btn-warning btn-sm btn-craft" data-item-id="${item.id}" data-item-name="${itemDef.name}">Craft</button>`;
        }

        return `
            <tr>
                <td>${itemDef.name}</td>
                <td>${quantity}</td>
                <td>${totalValue}</td>
                <td>${actionButton}</td>
            </tr>
        `;
    }).join('');

    return `
        <h2>Loot & Items</h2>
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Quantity</th>
                    <th>Total Value</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    `;
}

// Helper function to render the visual equipment slots UI.
function renderEquipmentSlotsComponent() {
    let slotsHtml = '';
    // Loop through each category in the configuration (Armor, Weapons, etc.)
    for (const category in EQUIPMENT_SLOT_CONFIG) {
        slotsHtml += `<div class="equipment-category"><h3>${category}</h3><div class="slots-container">`;
        
        // Loop through each slot in the category (head, chest, etc.)
        const slots = EQUIPMENT_SLOT_CONFIG[category];
        slots.forEach(slotId => {
            // Sanitize the label for display (e.g., "main-hand" becomes "Main-Hand")
            const slotLabel = slotId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            slotsHtml += `
                <div class="equipment-slot" data-slot-id="${slotId}">
                    <div class="slot-label">${slotLabel}</div>
                    <div class="slot-item-name">Empty</div>
                </div>
            `;
        });

        slotsHtml += `</div></div>`;
    }
    return slotsHtml;
}


/**
 * Renders the content for the 'Equipment' tab.
 * UPDATED: Now renders the visual slots based on the configuration.
 * @param {Array} equipmentItems - A list of the character's equipment.
 */
export function renderEquipmentTab(equipmentItems) {
    const panel = document.getElementById('equipment-panel');
    if (!panel) return;

    // The placeholder div is now replaced with a call to our new component renderer.
    panel.innerHTML = `
        <div class="panel">
             <h2>Equipped Items</h2>
             <div id="equipment-slots-panel">
                ${renderEquipmentSlotsComponent()}
             </div>
        </div>
        <div class="panel">
            ${renderEquipmentTableComponent(equipmentItems)}
        </div>
    `;
}

/**
 * Renders the content for the 'Inventory' tab.
 * @param {object} character - The character object.
 * @param {object} equipmentData - A map of all equipment and loot definitions.
 */
export function renderInventoryTab(character, equipmentData) {
    const panel = document.getElementById('inventory-panel');
    if (!panel) return;

    if (!character.inventory || character.inventory.length === 0) {
        panel.innerHTML = '<div class="panel"><p>Inventory is empty.</p></div>';
        return;
    }

    const equipmentItems = [];
    const lootItems = [];

    // Separate items based on their definition type
    character.inventory.forEach(item => {
        const itemDef = equipmentData ? equipmentData[item.id] : null;
        if (itemDef) {
            // We create a single object that includes both the instance data (item)
            // and the definition data (itemDef) for easier processing.
            const fullItemData = { ...item, definition: itemDef };
            if (itemDef.type === 'equipment') {
                equipmentItems.push(fullItemData);
            } else if (itemDef.type === 'loot') {
                lootItems.push(fullItemData);
            }
        }
    });

    // The inventory tab continues to render both tables
    panel.innerHTML = `
        <div class="panel">
            ${renderEquipmentTableComponent(equipmentItems)}
        </div>
        <div class="panel">
            ${renderLootTableComponent(lootItems)}
        </div>
    `;
}


// --- HELPER RENDERING FUNCTIONS (from original play.js) ---

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

/**
 * Renders the UI for the Hope/Fear attribute system.
 * UPDATED: Now uses EffectHandler.getCombinedAttributeValue to display the final modified value.
 * @param {object} effectedCharacter - The character object after effects have been processed.
 */
function renderHopeFearUI(effectedCharacter) {
    if (!effectedCharacter.attributes) return '';
    
    const containerStyle = "display: flex; flex-wrap: wrap; justify-content: space-around; gap: 1rem; padding: 1rem; background: #222; border-radius: 5px;";
    const attributeStyle = "display: flex; flex-direction: column; align-items: center; gap: 0.5rem;";
    const valueStyle = "font-size: 1.2rem; font-weight: bold; color: #a0c4ff;";

    const attributeButtons = Object.keys(effectedCharacter.attributes).map(attr => {
        const baseValue = effectedCharacter.attributes[attr];
        // Call the new centralized function to get the final value for display.
        const finalValue = EffectHandler.getCombinedAttributeValue(attr, baseValue);

        return `
            <div class="hope-fear-attribute" style="${attributeStyle}">
                <span class="hope-fear-name">${attr.charAt(0).toUpperCase() + attr.slice(1)}</span>
                <span class="hope-fear-value" style="${valueStyle}">${finalValue >= 0 ? '+' : ''}${finalValue}</span>
                <button class="btn-roll hope-fear-roll-btn" data-attribute="${attr}">Roll</button>
            </div>
        `;
    }).join('');

    return `<div class="hope-fear-container" style="${containerStyle}">${attributeButtons}</div>`;
}

function renderHealthDisplay(character) {
    if (!character || !character.health) return; //
    const healthDisplayContainer = document.querySelector('.character-health.health-display');
    if (!healthDisplayContainer) return;
    const currentMaxHealth = character.calculatedHealth ? character.calculatedHealth.currentMax : character.health.max; //
    const healthPercentage = (character.health.current / currentMaxHealth) * 100; //
    let healthClass = healthPercentage > 60 ? 'health-full' : healthPercentage > 30 ? 'health-medium' : 'health-low';
    healthDisplayContainer.innerHTML = `<div class="health-controls"><input type="number" id="healthAdjustmentInput" placeholder="e.g. -5, +10" class="form-control" /><button id="applyHealthAdjustment" class="btn btn-primary">Apply</button></div><div class="health-bar-container"><div class="health-bar ${healthClass}" style="width: ${healthPercentage}%"></div></div><div class="health-numbers">${character.health.current} / ${currentMaxHealth} ${character.health.temporary ? `(+${character.health.temporary} temp)` : ''}</div>`; //
}

function renderResources(character) {
    if (!character.resources || character.resources.length === 0) return '<p>No resources.</p>'; //
    return `<ul class="resource-list">${character.resources.map(r => `<li><strong>${r.type.charAt(0).toUpperCase() + r.type.slice(1)}:</strong> ${r.value} ${r.max !== undefined ? `/ ${r.max}` : ''}</li>`).join('')}</ul>`; //
}

function renderLanguages(character) {
    if (!character.languages || character.languages.length === 0) return '<p>No languages known.</p>'; //
    return `<ul>${character.languages.map(lang => `<li>${lang}</li>`).join('')}</ul>`; //
}

function renderStatuses(character) {
    if (!character.statuses || character.statuses.length === 0) return '<p>No active statuses.</p>'; //
    return `<ul>${character.statuses.map(s => `<li>${s.name}</li>`).join('')}</ul>`; //
}

function renderFlaws(character, flawData) {
    if (!character.flaws || character.flaws.length === 0) return '<p>No flaws.</p>'; //
    return `<ul class="description-list">${character.flaws.map(flawState => { //
        const flawDef = flawData[flawState.id];
        if (!flawDef) return `<li>Unknown Flaw (ID: ${flawState.id})</li>`;
        return `<li class="item"><strong>${flawDef.name}</strong><p>${flawDef.description}</p></li>`;
    }).join('')}</ul>`;
}

function renderPerks(character, perkData) {
    if (!character.perks || character.perks.length === 0) return '<p>No perks.</p>'; //
    return `<ul class="description-list">${character.perks.map(perkState => { //
        const perkDef = perkData[perkState.id];
        if (!perkDef) return `<li>Unknown Perk (ID: ${perkState.id})</li>`;
        return `<li class="item"><strong>${perkDef.name}</strong><p>${perkDef.description}</p></li>`;
    }).join('')}</ul>`;
}
