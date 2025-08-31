// js/play-ui.js
// This module contains all UI rendering functions for the play page.

import { EffectHandler } from './effectHandler.js';
import { RollManager } from './RollManager.js';

const MAX_MODIFIER_COLUMNS = 5;

const UI_NAME_MAP = {
    // Categories
    "weapons": "Weapons",
    "armor": "Armor",
    "accessories": "Accessories",
  
    // Slot Types
    "main-hand": "Main-Hand",
    "off-hand": "Off-Hand",
    "head": "Head",
    "chest": "Chest",
    "hands": "Hands",
    "legs": "Legs",
    "feet": "Feet",
    "ring": "Ring",
    "amulet": "Amulet",
    "two-hand": "Two-Hand",

    "implants": "Implants",
    "optic_implant": "Optic Implant",
    "neuro_link": "Neuro-Link",

    "staff_gems": "Staff Gems",
    "gem": "Gem",
};

export const EQUIPMENT_SLOT_CONFIG = {
    categories: {
        "weapons": ["main-hand", "off-hand"],
        "armor": ["head", "chest", "hands", "legs", "feet"],
        "accessories": ["ring", "ring", "amulet"]
    },
    combined_slots: {
        "two-hand": {
          replaces: ["main-hand", "off-hand"],
          label: "two-hand"
        }
    }
};

// --- NEW/MODIFIED FUNCTIONS ---

/**
 * NEW: Renders the complete HTML for the ability information modal.
 * @param {object} ability - The full, aggregated ability object.
 * @param {object} character - The active character object (for selections).
 * @returns {string} The inner HTML for the modal's content area.
 */
export function renderAbilityInfoModal(ability, character) {
    if (!ability || !ability.definition) return '';

    const def = ability.definition;
    let description = def.description.replace(/\${([^}]+)}/g, (match, p1) => def[p1] || p1);

    // --- Source Section ---
    const sourceHtml = ability.sourceType === 'equipment'
        ? `<p class="ability-source-text">Source: ${ability.sourceName}</p>`
        : `<p class="ability-source-text">Source: ${ability.sourceType.charAt(0).toUpperCase() + ability.sourceType.slice(1)}</p>`;

    // --- Cost Section ---
    let costHtml = '';
    if (def.cost) {
        const costValue = Array.isArray(def.cost) ? def.cost.map(c => `${c.value} ${c.resource}`).join(' and ') : `${def.cost.value} ${def.resource}`;
        costHtml = `<div class="ability-modal-section">
                        <h5>Cost</h5>
                        <p>${costValue}</p>
                    </div>`;
    }

    // --- Effects Section ---
    let effectsHtml = '';
    if (def.effect && def.effect.length > 0) {
        const effectItems = def.effect.map(eff => {
            let effectText = `<strong>${eff.name || eff.type}:</strong> `;
            switch (eff.type) {
                case 'modifier':
                    effectText += `Grants ${eff.modifier > 0 ? '+' : ''}${eff.modifier} to ${eff.attribute}.`;
                    break;
                case 'die_num':
                    effectText += `Grants ${eff.modifier > 0 ? '+' : ''}${eff.modifier} dice to ${eff.attribute} rolls.`;
                    break;
                case 'language':
                    effectText += `Learn the "${eff.name}" language.`;
                    break;
                case 'attack':
                    effectText += `Attack roll using ${eff.attribute_bonus}.`;
                    break;
                // Add more cases here for other effect types as needed
                default:
                    effectText += `Unknown effect type.`;
            }
            if (eff.cost) {
                effectText += ` (Cost: ${eff.cost.value} ${eff.cost.resource})`;
            }
            return `<li>${effectText}</li>`;
        }).join('');
        effectsHtml = `<div class="ability-modal-section"><h5>Effects</h5><ul>${effectItems}</ul></div>`;
    }
    
    // --- Options/Selections Section ---
    let optionsHtml = '';
    if (def.options && def.options.length > 0) {
        // Find the character's selections for this ability
        const abilityState = character.abilities.find(a => a.id === def.id);
        const selections = new Set(abilityState?.selections || []);
        
        const optionItems = def.options.map(opt => {
            const isSelected = selections.has(opt.id) ? '<strong>(Selected)</strong> ' : '';
            return `<li><strong>${opt.name}:</strong> ${isSelected}${opt.description}</li>`;
        }).join('');
        optionsHtml = `<div class="ability-modal-section"><h5>Options</h5><ul>${optionItems}</ul></div>`;
    }

    return `
        <h3 class="ability-modal-header">${def.name}</h3>
        <div class="ability-modal-section">
            <p>${description}</p>
            ${sourceHtml}
        </div>
        ${costHtml}
        ${effectsHtml}
        ${optionsHtml}
    `;
}


/**
 * Renders the content for the 'Abilities' tab.
 * REWORKED: Now renders a minimalist card with a name and buttons, including the new info button.
 * @param {Array<object>} allAbilities - The aggregated list of all character abilities.
 * @param {object} character - The character object.
 */
export function renderAbilitiesTab(allAbilities, character) {
    const panel = document.getElementById('abilities-panel');
    if (!panel) return;
    
    if (!allAbilities || allAbilities.length === 0) {
        panel.innerHTML = '<div class="panel"><p>No abilities available.</p></div>';
        return;
    }
    
    const activeAbilitiesHtml = [];
    const passiveAbilitiesHtml = [];

    allAbilities.forEach(ability => {
        const abilityDef = ability.definition;
        if (!abilityDef) return;

        // The info button is always present
        const infoButtonHtml = `<i class="info-btn" data-action="show-ability-info" data-ability-id="${ability.instancedId}" title="View Details">i</i>`;

        let actionButtonHTML = '';
        if (ability.itemType === "active") {
            const hasAttackEffect = abilityDef.effect?.some(e => e.type === 'attack');
            if (hasAttackEffect) {
                actionButtonHTML = `<button class="btn btn-primary btn-ability-roll" data-ability-id="${ability.instancedId}">Roll</button>`;
            } else {
                const isOn = character.activeAbilityIds && character.activeAbilityIds.has(ability.instancedId) ? 'selected' : '';
                actionButtonHTML = `<button class="ability-toggle ${isOn}" data-ability-id="${ability.instancedId}">Toggle</button>`;
            }
        }

        const cardContent = `
            <li class="ability-card">
                <div class="ability-card-main">
                    <span class="ability-name">${abilityDef.name}</span>
                    ${infoButtonHtml}
                </div>
                <div class="ability-card-actions">
                    ${actionButtonHTML}
                </div>
            </li>`;

        if (ability.itemType === "active") {
            activeAbilitiesHtml.push(cardContent);
        } else {
            passiveAbilitiesHtml.push(cardContent);
        }
    });

    const activeSection = activeAbilitiesHtml.length > 0 ? `<div class="panel"><h2>Active Abilities</h2><ul id="activeAbilitiesList" class="ability-list">${activeAbilitiesHtml.join('')}</ul></div>` : '';
    const passiveSection = passiveAbilitiesHtml.length > 0 ? `<div class="panel"><h2>Passive Abilities</h2><ul id="passiveAbilitiesList" class="ability-list">${passiveAbilitiesHtml.join('')}</ul></div>` : '';

    panel.innerHTML = activeSection + passiveSection;
}


// --- UNCHANGED FUNCTIONS (Included for context) ---

function renderHealthComponent(current, max, entityId, entityType) {
    const healthPercentage = max > 0 ? (current / max) * 100 : 0;
    let healthClass = healthPercentage > 60 ? 'health-full' : healthPercentage > 30 ? 'health-medium' : 'health-low';
    
    return `
        <div class="health-controls">
            <input type="number" id="health-adj-${entityId}" class="form-control health-adj-input" placeholder="e.g. -5, +10" />
            <button id="health-apply-${entityId}" class="btn btn-primary btn-apply-health" data-entity-id="${entityId}" data-entity-type="${entityType}">Apply</button>
        </div>
        <div class="health-bar-container">
            <div class="health-bar ${healthClass}" style="width: ${healthPercentage}%"></div>
        </div>
        <div class="health-numbers">${current} / ${max}</div>
    `;
}

function renderAttributeGridComponent({ attributes, entityType, entityId }) {
    if (!attributes) return '';

    const attributeItems = Object.entries(attributes).map(([attr, finalValue]) => {
        const isSummon = entityType === 'summon';
        const buttonClass = isSummon ? 'summon-attribute-roll-btn' : 'hope-fear-roll-btn';
        const dataAttributes = isSummon 
            ? `data-instance-id="${entityId}" data-attribute="${attr}"`
            : `data-attribute="${attr}"`;

        return `
            <div class="attribute-box">
                <span class="attribute-name-display">${attr}</span>
                <span class="attribute-value-display">${finalValue >= 0 ? '+' : ''}${finalValue}</span>
                <button class="btn btn-sm btn-roll ${buttonClass}" ${dataAttributes}>Roll</button>
            </div>
        `;
    }).join('');

    return `<div class="attributes-grid">${attributeItems}</div>`;
}

function renderAbilitiesComponent(abilitiesDef, instanceId) {
    if (!abilitiesDef) return '';

    const renderList = (abilities, type) => {
        if (!abilities || abilities.length === 0) return '';
        return abilities.map(ability => `
            <li class="summon-ability">
                <strong>${ability.name} <span class="ability-type-tag ${type}">${type.toUpperCase()}</span></strong>
                <p>${ability.description}</p>
                ${type === 'active' ? `<button class="btn btn-sm btn-action" data-instance-id="${instanceId}" data-ability-id="${ability.id}">Roll</button>` : ''}
            </li>
        `).join('');
    };

    const passiveHtml = renderList(abilitiesDef.passive, 'passive');
    const activeHtml = renderList(abilitiesDef.active, 'active');

    let finalHtml = '';
    if (passiveHtml) {
        finalHtml += `<h6>Passive</h6><ul class="summon-ability-list">${passiveHtml}</ul>`;
    }
    if (activeHtml) {
        finalHtml += `<h6>Active</h6><ul class="summon-ability-list">${activeHtml}</ul>`;
    }
    
    return finalHtml || '<p>No special abilities.</p>';
}

function renderSummonAttributesComponent(attributes, instanceId) {
    if (!attributes) return '';

    const attributeButtons = Object.entries(attributes).map(([attr, value]) => `
        <div class="summon-attribute">
            <span class="summon-attribute-name">${attr.charAt(0).toUpperCase() + attr.slice(1)}</span>
            <span class="summon-attribute-value">${value >= 0 ? '+' : ''}${value}</span>
            <button class="btn btn-sm btn-roll summon-attribute-roll-btn" data-instance-id="${instanceId}" data-attribute="${attr}">Roll</button>
        </div>
    `).join('');

    return `
        <div class="summon-attributes-section">
            <h4>Attributes</h4>
            <div class="summon-attributes-grid">${attributeButtons}</div>
        </div>
    `;
}

export function renderSummonsPanel(summonInstances, bestiaryData) {
    const container = document.getElementById('summons-panel-container');
    if (!container) return;

    if (!summonInstances || summonInstances.length === 0) {
        container.innerHTML = '';
        return;
    }

    const summonCardsHtml = summonInstances.map(instance => {
        const def = bestiaryData[instance.creatureId];
        if (!def) return '';

        const attributesGridHtml = instance.calculatedAttributes 
            ? `<div class="summon-attributes-section"><h4>Attributes</h4>${renderAttributeGridComponent({
                    attributes: instance.calculatedAttributes,
                    entityType: 'summon',
                    entityId: instance.instanceId
                })}</div>`
            : '';

        return `
            <div class="summon-card panel">
                <div class="summon-header">
                    <h3>${def.name}</h3>
                    <button class="btn btn-danger btn-sm btn-dismiss-summon" data-instance-id="${instance.instanceId}">Dismiss</button>
                </div>
                <p class="summon-description"><em>${def.description}</em></p>
                <div class="summon-health">
                    ${renderHealthComponent(instance.currentHealth, def.health.max, instance.instanceId, 'summon')}
                </div>
                ${attributesGridHtml}
                <div class="summon-abilities-section">
                    <h4>Abilities</h4>
                    ${renderAbilitiesComponent(def.abilities, instance.instanceId)}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="panel">
            <h2>Summons</h2>
            <div class="summons-grid">${summonCardsHtml}</div>
        </div>
    `;
}

export function renderTopNav(character, moduleDefinitions) {
    const headerInfo = document.getElementById('character-header-info');
    if (!headerInfo || !character) return;

    const moduleName = moduleDefinitions[character.module]?.name || 'Unknown';

    headerInfo.innerHTML = `
        <h2>${character.info.name}</h2>
        <p>Level ${character.level} ${character.destiny} | ${character.purpose} | ${character.nurture} | ${moduleName}</p>
    `;
}

export function renderMainTab(character, moduleDefinitions, mainEffectHandler) {
    const panel = document.getElementById('main-panel');
    if (!panel) return;

    let systemType = moduleDefinitions[character.module]?.type || 'KOB';
    let attributesHtml = '';
    if (systemType === 'Hope/Fear') {
        attributesHtml = renderAttributeGridComponent({
            attributes: character.calculatedAttributes,
            entityType: 'character'
        });
    } else {
        attributesHtml = renderKOBUI(character, mainEffectHandler);
    }

    const healthResource = character.resources.find(r => r.id === 'health');
    const currentHealth = healthResource ? healthResource.value : 0;
    const maxHealth = healthResource ? healthResource.max : 0;

    panel.innerHTML = `
        <div class="panel">
            <h2>Attributes</h2>
            <div class="attributes-grid-container">${attributesHtml}</div>
        </div>
        <div class="panel health-panel">
            <h2>Health</h2>
            <div class="character-health">
                ${renderHealthComponent(
                    currentHealth,
                    maxHealth,
                    character.id,
                    'character'
                )}
            </div>
        </div>
        <div class="panel resources-panel">
            <h2>Resources</h2>
            ${renderResources(character)}
        </div>
        <div id="summons-panel-container"></div>
    `;
}

export function renderProfileTab(character, flawData, perkData) {
    const panel = document.getElementById('profile-panel');
    if (!panel) return;

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

export function renderEquipmentTab(equipmentItems, equipmentSlots, equipmentData, character, layoutConfig, slotMap) {
    const panel = document.getElementById('equipment-panel');
    if (!panel) return;

    panel.innerHTML = `
        <div class="equipment-container">
            <div class="equipment-column">
                <div class="panel">
                     <h2>Equipped Items</h2>
                     <div id="equipment-slots-panel">
                        ${renderEquipmentSlotsComponent(equipmentSlots, equipmentData, layoutConfig, slotMap)}
                     </div>
                </div>
            </div>
            <div class="equipment-column">
                <div class="panel">
                    ${renderEquipmentTableComponent(equipmentItems, character, equipmentData, layoutConfig, slotMap)}
                </div>
            </div>
        </div>
    `;
}

export function renderInventoryTab(character, equipmentData, layoutConfig, slotMap) {
    const panel = document.getElementById('inventory-panel');
    if (!panel) return;

    if (!character.inventory || character.inventory.length === 0) {
        panel.innerHTML = '<div class="panel"><p>Inventory is empty.</p></div>';
        return;
    }

    const equipmentItems = [];
    const lootItems = [];

    character.inventory.forEach(item => {
        const definition = equipmentData[item.id];
        if (!definition) return;
        const fullItemData = { ...item, definition };
        if (definition.type === 'equipment') {
            equipmentItems.push(fullItemData);
        } else if (definition.type === 'loot') {
            lootItems.push(fullItemData);
        }
    });

    panel.innerHTML = `
        <div class="panel">
            ${renderEquipmentTableComponent(equipmentItems, character, equipmentData, layoutConfig, slotMap)}
        </div>
        <div class="panel">
            ${renderLootTableComponent(lootItems)}
        </div>
    `;
}


function renderKOBUI(effectedCharacter, mainEffectHandler) {
    let attributesHtml = '';
    if (effectedCharacter.attributes) {
        attributesHtml = Object.entries(effectedCharacter.attributes).map(([attr, die]) => {
            const initialModifiers = mainEffectHandler.getEffectsForAttribute(attr, "modifier");
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

        const initialLuckModifiers = mainEffectHandler.getEffectsForAttribute('luck', "modifier");
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

function renderHopeFearUI(effectedCharacter, mainEffectHandler) {
    if (!effectedCharacter.attributes) return '';
    
    const containerStyle = "display: flex; flex-wrap: wrap; justify-content: space-around; gap: 1rem; padding: 1rem; background: #222; border-radius: 5px;";
    const attributeStyle = "display: flex; flex-direction: column; align-items: center; gap: 0.5rem;";
    const valueStyle = "font-size: 1.2rem; font-weight: bold; color: #a0c4ff;";

    const attributeButtons = Object.keys(effectedCharacter.attributes).map(attr => {
        const baseValue = effectedCharacter.attributes[attr];
        const finalValue = mainEffectHandler.getCombinedAttributeValue(attr, baseValue);

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

function renderResources(character) {
    if (!character.resources || character.resources.length === 0) return '<p>No resources.</p>';
    return `<ul class="resource-list">${character.resources.map(r => `<li><strong>${r.displayName}:</strong> ${r.value} ${r.max !== undefined ? `/ ${r.max}` : ''}</li>`).join('')}</ul>`;
}

function renderLanguages(character) {
    if (!character.languages || character.languages.length === 0) return '<p>No languages known.</p>';
    return `<ul>${character.languages.map(lang => `<li>${lang}</li>`).join('')}</ul>`;
}

function renderStatuses(character) {
    if (!character.statuses || character.statuses.length === 0) return '<p>No active statuses.</p>';
    return `<ul>${character.statuses.map(s => `<li>${s.name}</li>`).join('')}</ul>`;
}

function renderFlaws(character, flawData) {
    if (!character.flaws || character.flaws.length === 0) return '<p>No flaws.</p>';
    return `<ul class="description-list">${character.flaws.map(flawState => {
        const flawDef = flawData[flawState.id];
        if (!flawDef) return `<li>Unknown Flaw (ID: ${flawState.id})</li>`;
        return `<li class="item"><strong>${flawDef.name}</strong><p>${flawDef.description}</p></li>`;
    }).join('')}</ul>`;
}

function renderPerks(character, perkData) {
    if (!character.perks || character.perks.length === 0) return '<p>No perks.</p>';
    return `<ul class="description-list">${character.perks.map(perkState => {
        const perkDef = perkData[perkState.id];
        if (!perkDef) return `<li>Unknown Perk (ID: ${perkState.id})</li>`;
        return `<li class="item"><strong>${perkDef.name}</strong><p>${perkDef.description}</p></li>`;
    }).join('')}</ul>`;
}

function renderEquipmentTableComponent(equipmentItems, character, equipmentData, layoutConfig, slotMap) {
    if (equipmentItems.length === 0) {
        return '<h2>Equipment</h2><p>No equipment.</p>';
    }

    const tableRows = equipmentItems.map(item => {
        const itemDef = item.definition;
        
        let nameCell = itemDef.name;
        if (item.equippedCount !== undefined) {
            nameCell += ` <span class="item-count-display">(${item.equippedCount} of ${item.quantity} Equipped)</span>`;
        }
        
        let actionButtonsHtml = '';

        if (item.quantity > 1) {
            const availableSlots = findTargetSlots(itemDef, character.equipmentSlots, item.id, layoutConfig, slotMap, equipmentData);
            
            if (item.equippedCount < item.quantity && availableSlots.length > 0) {
                actionButtonsHtml += `<button class="btn btn-success btn-sm btn-equip-stack" data-item-id="${item.id}">Equip</button>`;
            }

            if (item.equippedCount > 0) {
                actionButtonsHtml += `<button class="btn btn-warning btn-sm btn-unequip-stack" data-item-id="${item.id}">Unequip</button>`;
            }
        } else {
            actionButtonsHtml = `<button class="btn btn-secondary btn-sm btn-equip" data-item-id="${item.id}">
                                    ${item.equipped ? 'Unequip' : 'Equip'}
                                 </button>`;
        }

        return `
            <tr>
                <td>${nameCell}</td>
                <td>${itemDef.category.charAt(0).toUpperCase() + itemDef.category.slice(1)}</td>
                <td>${itemDef.rarity.charAt(0).toUpperCase() + itemDef.rarity.slice(1)}</td>
                <td>${item.equipped ? 'Yes' : 'No'}</td>
                <td class="actions-cell">${actionButtonsHtml}</td>
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

function getDynamicSlotLayout(equipmentSlots, equipmentData, layoutConfig, slotMap) {
    const dynamicCategories = {};
    const allPossibleSlots = new Set(Object.values(slotMap).flat());
    const combinedInstances = new Map();

    for (const slotId in equipmentSlots) {
        const slotValue = equipmentSlots[slotId];
        if (slotValue && typeof slotValue === 'object' && slotValue.instanceId) {
            if (!combinedInstances.has(slotValue.instanceId)) {
                combinedInstances.set(slotValue.instanceId, {
                    itemId: slotValue.itemId,
                    slots: []
                });
            }
            combinedInstances.get(slotValue.instanceId).slots.push(slotId);
            allPossibleSlots.delete(slotId);
        }
    }

    for (const categoryName in layoutConfig.categories) {
        const renderedSlots = [];

        combinedInstances.forEach((instance, instanceId) => {
            const itemDef = equipmentData[instance.itemId];
            const combinedConfig = layoutConfig.combined_slots[itemDef.equip_slot];
            const representativeSlotId = instance.slots[0];
            const slotBaseType = representativeSlotId.split('_')[0];

            if (layoutConfig.categories[categoryName].includes(slotBaseType)) {
                renderedSlots.push({
                    id: instanceId,
                    label: combinedConfig.label,
                    span: instance.slots.length,
                    representativeSlotId: representativeSlotId
                });
                combinedInstances.delete(instanceId);
            }
        });

        const uniqueSlotTypes = [...new Set(layoutConfig.categories[categoryName])];
        uniqueSlotTypes.forEach(slotType => {
            const instanceIds = slotMap[slotType] || [];
            instanceIds.forEach(instanceId => {
                if (allPossibleSlots.has(instanceId)) {
                    const label = slotType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    renderedSlots.push({ id: instanceId, label: label, span: 1 });
                }
            });
        });
        
        if (renderedSlots.length > 0) {
            renderedSlots.sort((a, b) => a.id.localeCompare(b.id));
            dynamicCategories[categoryName] = renderedSlots;
        }
    }
    
    return dynamicCategories;
}

export function findTargetSlots(itemDef, equipmentSlots, itemIdToEquip, layoutConfig, slotMap, equipmentData) {
    const slotType = itemDef.equip_slot;
    const combinedConfig = layoutConfig.combined_slots[slotType];

    if (!combinedConfig) {
        const instanceSlots = slotMap[slotType] || [];
        const emptySlot = instanceSlots.find(id => !equipmentSlots[id]);
        if (emptySlot) return [emptySlot];
        
        const replaceableSlot = instanceSlots.find(id => equipmentSlots[id] !== itemIdToEquip);
        if (replaceableSlot) return [replaceableSlot];
        
        return [];
    }

    if (combinedConfig) {
        const requiredTypes = combinedConfig.replaces;
        const potentialPrimarySlots = slotMap[requiredTypes[0]] || [];
        const potentialSecondarySlots = slotMap[requiredTypes[1]] || [];
        const occupiedByCombined = new Set();

        for (const slotId in equipmentSlots) {
            const slotValue = equipmentSlots[slotId];
            if (!slotValue) continue;
            const realItemId = typeof slotValue === 'object' ? slotValue.itemId : slotValue;
            const equippedItemDef = equipmentData[realItemId];
            if (equippedItemDef && layoutConfig.combined_slots[equippedItemDef.equip_slot]) {
                occupiedByCombined.add(slotId);
            }
        }

        const availablePrimary = potentialPrimarySlots.filter(id => !occupiedByCombined.has(id));
        const availableSecondary = potentialSecondarySlots.filter(id => !occupiedByCombined.has(id));
        let bestPair = [];
        let lowestCost = Infinity;

        for (const p of availablePrimary) {
            for (const s of availableSecondary) {
                const pIsFilled = !!equipmentSlots[p];
                const sIsFilled = !!equipmentSlots[s];
                const currentCost = (pIsFilled ? 1 : 0) + (sIsFilled ? 1 : 0);

                if (currentCost < lowestCost) {
                    lowestCost = currentCost;
                    bestPair = [p, s];
                    if (lowestCost === 0) return bestPair;
                }
            }
        }
        return bestPair;
    }

    return [];
}

function renderEquipmentSlotsComponent(equipmentSlots, equipmentData, layoutConfig, slotMap) {
    const dynamicLayout = getDynamicSlotLayout(equipmentSlots, equipmentData, layoutConfig, slotMap);
    let slotsHtml = '';

    for (const categoryKey in dynamicLayout) {
        const categoryDisplayName = UI_NAME_MAP[categoryKey] || categoryKey;
        slotsHtml += `<div class="equipment-category"><h3>${categoryDisplayName}</h3><div class="slots-container">`;
        
        const slots = dynamicLayout[categoryKey];
        slots.forEach(slotInfo => {
            const slotId = slotInfo.id;
            const representativeSlotId = slotInfo.representativeSlotId || slotId;
            const slotValue = equipmentSlots[representativeSlotId];
            const equippedItemId = slotValue?.itemId || slotValue;
            const itemDef = equippedItemId ? equipmentData[equippedItemId] : null;

            const slotDisplayName = UI_NAME_MAP[slotInfo.label] || slotInfo.label;
            const itemName = itemDef ? itemDef.name : "Empty";
            
            const spanClass = slotInfo.span > 1 ? `slot-spans-${slotInfo.span}` : '';
            const slotClass = itemDef ? "equipment-slot filled" : "equipment-slot";
            const rarityClass = itemDef ? `rarity-${itemDef.rarity}` : '';
            const dataAttribute = `data-slot-id="${representativeSlotId}"`;

            slotsHtml += `
                <div class="${slotClass} ${spanClass} ${rarityClass}" ${dataAttribute}>
                    <div class="slot-label">${slotDisplayName}</div>
                    <div class="slot-item-name">${itemName}</div>
                </div>
            `;
        });
        slotsHtml += `</div></div>`;
    }
    return slotsHtml;
}

export function getEquippedCount(baseItemId, character, equipmentData, layoutConfig) {
    const itemDef = equipmentData[baseItemId];
    const equipmentSlots = character.equipmentSlots;
    if (!itemDef || !itemDef.equip_slot || !equipmentSlots) {
        return 0;
    }

    if (layoutConfig.combined_slots[itemDef.equip_slot]) {
        const instances = new Set();
        for (const slotId in equipmentSlots) {
            const slotValue = equipmentSlots[slotId];
            if (slotValue && typeof slotValue === 'object' && slotValue.itemId === baseItemId) {
                instances.add(slotValue.instanceId);
            }
        }
        return instances.size;
    } else {
        let count = 0;
        for (const slotId in equipmentSlots) {
            if (equipmentSlots[slotId] === baseItemId) {
                count++;
            }
        }
        return count;
    }
}