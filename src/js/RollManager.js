// RollManager.js (Corrected and Final)

export class RollManager {
  /**
   * MODIFIED: Now accepts an onCostPaidCallback.
   */
  constructor(rollDefinitions, initialToggledStates = new Set(), onCostPaidCallback = null, onRollCompleteCallback = null) {
    this.rollDefinitions = rollDefinitions;
    this.modalElement = null;
    this.tooltipElement = null;
    this.critOccurred = false;
    this.onCostPaid = onCostPaidCallback;
    this.onRollComplete = onRollCompleteCallback; // NEW: Callback for after a roll is executed.
    this.selectedCosts = {}; 

    this.hopeFearGroup = this.rollDefinitions.find(def => def.groupType === 'hope_fear');
    if (this.hopeFearGroup) {
        this.toggledStates = new Set(initialToggledStates); 
        this.characterResources = this.hopeFearGroup.characterResources || [];
        this.activeEffects = this.hopeFearGroup.activeEffects || [];
        this.allToggleableAbilities = [
            ...(this.hopeFearGroup.availableActives || []),
            ...(this.hopeFearGroup.availableConditionals || [])
        ];
    }
    
    this._boundClose = this.close.bind(this);
    this._boundHandleClick = this._handleClick.bind(this);
    this._boundCloseOnEscape = (e) => { if (e.key === "Escape") this.close(); };
  }

  show() {
    document.body.insertAdjacentHTML('beforeend', this._createModalHTML());
    this.modalElement = document.getElementById('roll-manager-modal');
    this.tooltipElement = document.getElementById('roll-manager-tooltip');
    this._attachEventListeners();
    
    if (this.hopeFearGroup) {
        this._updateModifierDisplay();
    }
  }

  close() {
    if (this.modalElement) {
      this.modalElement.remove();
    }
    document.removeEventListener('keydown', this._boundCloseOnEscape);
  }

  _attachEventListeners() {
    this.modalElement.addEventListener('click', this._boundHandleClick);
    document.addEventListener('keydown', this._boundCloseOnEscape);
  }

  async _handleClick(e) {
    const target = e.target;

    if (!target.closest('.roll-manager-tooltip') && !target.closest('[data-action="show-info-tooltip"]') && !target.closest('[data-action="show-breakdown-tooltip"]')) {
        this._hideTooltip();
    }

    const closeButton = target.closest('.roll-modal-close');
    const backdrop = target.classList.contains('roll-modal-backdrop');
    if (closeButton || backdrop) {
        this.close();
        return;
    }

    // NEW: Handle selection of an OR cost from a radio button
    if (target.matches('[data-action="select-or-cost"]')) {
      const abilityId = target.dataset.abilityId;
      const costIndex = parseInt(target.value, 10);
      const ability = this.allToggleableAbilities.find(a => a.instancedId === abilityId);
      if (ability && ability.definition.cost.or) {
          this.selectedCosts[abilityId] = ability.definition.cost.or[costIndex];
          this._updateModifierDisplay(); // Recalculate costs and update UI
      }
      return;
    }

    const rollButton = target.closest('.roll-group-btn');
    if (rollButton) {
      const groupId = parseInt(rollButton.dataset.groupId, 10);
      
      const totalCosts = this._calculateCurrentCosts();
      if (Object.keys(totalCosts).length > 0 && typeof this.onCostPaid === 'function') {
        const updatedResources = await this.onCostPaid(totalCosts);
        if (updatedResources) {
            this.characterResources = updatedResources;
        } else {
            console.error("Cost payment failed, aborting roll.");
            return;
        }
      }
      
      this._executeRoll(groupId);

      // Refreshes page on roll
      if (this.onRollComplete) {
        this.onRollComplete();
      }

      return;
    }
    
    if (target.matches('[data-action="show-info-tooltip"]')) {
        e.stopPropagation(); 
        const abilityId = target.dataset.abilityId;
        const ability = this.allToggleableAbilities.find(a => a.instancedId === abilityId || a.definition.id === abilityId);
        if (ability) {
            const content = `<h5>${ability.definition.name}</h5><p>${ability.definition.description}</p>`;
            this._showTooltip(content, target);
        }
        return;
    }
    
    const abilityToggler = target.closest('[data-action="toggle-ability"]');
    if (abilityToggler) {
      if (abilityToggler.classList.contains('unaffordable')) {
        // alerter is not defined here, using console.warn as a fallback.
        console.warn("You cannot afford to toggle this ability.");
        return;
      }
      const abilityId = abilityToggler.dataset.abilityId;
      if (this.toggledStates.has(abilityId)) {
          this.toggledStates.delete(abilityId);
          abilityToggler.classList.remove('toggled-on');
      } else {
          this.toggledStates.add(abilityId);
          abilityToggler.classList.add('toggled-on');
      }
      this._updateModifierDisplay();
      return;
    }

    const breakdownDisplayer = target.closest('[data-action="show-breakdown-tooltip"]');
    if(breakdownDisplayer) {
        e.stopPropagation();
        this._showBreakdownTooltip(breakdownDisplayer);
        return;
    }
  }
  
  _executeRoll(groupId) {
    const groupDef = this.rollDefinitions[groupId];
    const groupEl = this.modalElement.querySelector(`.roll-group[data-group-id="${groupId}"]`);
    if (!groupDef || !groupEl) return;

    switch (groupDef.groupType) {
      case 'hope_fear':
        this._executeHopeFearRoll(groupDef, groupEl);
        break;
      case 'damage':
        this._executeDamageRoll(groupDef, groupEl);
        break;
    }
  }
  
  _executeHopeFearRoll(groupDef, groupEl) {
    const { totalNumerical, totalDiceNum } = this._calculateCurrentModifiers();
    const finalValue = groupDef.baseValue + totalNumerical;
    
    const highestHope = Math.floor(Math.random() * 12) + 1;
    const highestFear = Math.floor(Math.random() * 12) + 1;
    let d6Modifier = 0;

    if (totalDiceNum !== 0) {
      const numD6ToRoll = Math.abs(totalDiceNum);
      const d6Rolls = [];
      for (let i = 0; i < numD6ToRoll; i++) {
        d6Rolls.push(Math.floor(Math.random() * 6) + 1);
      }
      const d6Sum = d6Rolls.reduce((sum, roll) => sum + roll, 0);
      d6Modifier = totalDiceNum > 0 ? d6Sum : -d6Sum;
      groupEl.querySelector('.d6-roll-result').textContent = `${d6Modifier >= 0 ? '+' : ''}${d6Modifier}`;
      groupEl.querySelector('.d6-roll-details').textContent = `(Rolled: ${d6Rolls.join(', ')})`;
    }

    groupEl.querySelector('.hope-roll-result').textContent = highestHope;
    groupEl.querySelector('.fear-roll-result').textContent = highestFear;
    const hopeBoxEl = groupEl.querySelector('.hope-box');
    const fearBoxEl = groupEl.querySelector('.fear-box');
    hopeBoxEl.classList.remove('hope-win');
    fearBoxEl.classList.remove('fear-win');
    const totalResultEl = groupEl.querySelector('.total-roll-result');
    totalResultEl.classList.remove('critical-text');
    totalResultEl.parentElement.classList.remove('critical-success');

    if (highestHope === highestFear) {
      this.critOccurred = true;
      totalResultEl.textContent = "CRITICAL SUCCESS!!";
      totalResultEl.classList.add('critical-text');
      totalResultEl.parentElement.classList.add('critical-success');
    } else {
      const finalTotal = highestHope + highestFear + finalValue + d6Modifier;
      totalResultEl.textContent = finalTotal;
      if (highestHope > highestFear) {
        hopeBoxEl.classList.add('hope-win');
      } else {
        fearBoxEl.classList.add('fear-win');
      }
    }
  }

  _executeDamageRoll(groupDef, groupEl) {
    let totalDamage = 0;
    const appliedEffects = [];

    (this.hopeFearGroup.passiveAbilities || []).forEach(ab => {
        if(ab.definition.effect) appliedEffects.push(...ab.definition.effect);
    });
    this.toggledStates.forEach(abilityId => {
        const ability = this.allToggleableAbilities.find(a => a.instancedId === abilityId || a.definition.id === abilityId);
        if (ability?.definition.effect) {
            appliedEffects.push(...ability.definition.effect);
        }
    });

    groupDef.rolls.forEach((rollDef, index) => {
      let baseDice = [rollDef.dice];
      let baseValue = rollDef.baseValue || 0;
      
      if (this.critOccurred) {
        baseDice = baseDice.flatMap(d => [d, d]);
      }

      appliedEffects.forEach(eff => {
          if (eff.type === 'damage_mod' && (eff.damage_type === 'all' || eff.damage_type === rollDef.label)) baseValue += eff.value;
          if (eff.type === 'damage_dice_mod' && (eff.damage_type === 'all' || eff.damage_type === rollDef.label)) baseDice.push(eff.dice);
      });
      
      let rollSum = 0;
      const individualRolls = [];
      baseDice.forEach(diceString => {
          const [num, type] = diceString.split('d').map(Number);
          for(let i=0; i<num; i++){
              const roll = Math.floor(Math.random() * type) + 1;
              rollSum += roll;
              individualRolls.push(roll);
          }
      });

      const finalValue = rollSum + baseValue;
      totalDamage += finalValue;
      
      const valueEl = groupEl.querySelector(`#damage-value-${index}`);
      const detailsEl = groupEl.querySelector(`#damage-details-${index}`);
      if (valueEl) valueEl.textContent = finalValue;
      if (detailsEl) detailsEl.textContent = `(${baseDice.join(' + ')} [${individualRolls.join(', ')}] + ${baseValue})`;
    });

    const totalValueEl = groupEl.querySelector('.damage-total-value');
    if (totalValueEl) totalValueEl.textContent = totalDamage;
  }
  
  _calculateCurrentModifiers() {
    let totalNumerical = 0;
    let totalDiceNum = 0;
    const relevantAttribute = this.hopeFearGroup.attributeName;

    const processAbilityEffects = (ability) => {
        if (!ability?.definition.effect) return;
        ability.definition.effect.forEach(eff => {
            if (eff.attribute === relevantAttribute) {
                if (eff.type === 'modifier') totalNumerical += eff.modifier;
                if (eff.type === 'die_num') totalDiceNum += eff.modifier;
            }
        });
    };

    (this.hopeFearGroup.passiveAbilities || []).forEach(processAbilityEffects);
    this.toggledStates.forEach(abilityId => {
        const ability = this.allToggleableAbilities.find(a => a.instancedId === abilityId || a.definition.id === abilityId);
        processAbilityEffects(ability);
    });
    
    return { totalNumerical, totalDiceNum };
  }

  /**
   * MODIFIED: Completely refactored to handle AND/OR costs, cost modifiers, and cost ignores.
   * @returns {object} An object summarizing the total cost per resource (e.g., { mana: -5 }).
   */
  _calculateCurrentCosts() {
    // 1. Start with a completely empty object for the final totals.
    const totalCosts = {};

    // 2. Create a list of all abilities/actions that currently have a cost.
    const activeCostSources = [];
    if (this.hopeFearGroup.cost) {
        activeCostSources.push({
            costDef: this.hopeFearGroup.cost,
            id: 'base'
        });
    }
    this.toggledStates.forEach(abilityId => {
        const ability = this.allToggleableAbilities.find(a => a.instancedId === abilityId);
        if (ability?.definition.cost) {
            activeCostSources.push({
                costDef: ability.definition.cost,
                id: ability.instancedId
            });
        }
    });

    // 3. Process each source to determine its base cost package (handling AND/OR).
    activeCostSources.forEach(source => {
        let costPackage = [];
        if (source.costDef.or) {
            costPackage = this.selectedCosts[source.id] || [];
        } else {
            costPackage = this._normalizeCost(source.costDef);
        }

        // Add the base costs from this ability's package to the main total.
        costPackage.forEach(costItem => {
            if (this._shouldIgnoreCost(costItem)) return;
            const resource = costItem.resource;
            const value = costItem.value;
            if (!totalCosts[resource]) {
                totalCosts[resource] = 0;
            }
            totalCosts[resource] += value;
        });
    });

    // --- FIX: This section is now corrected ---
    // 4. Create a complete list of ALL active effects from both passives AND toggled abilities.
    const allActiveEffects = [...this.activeEffects]; // Start with passive effects from perks/equipment.
    this.toggledStates.forEach(abilityId => {
        const toggledAbility = this.allToggleableAbilities.find(a => a.instancedId === abilityId);
        if (toggledAbility?.definition.effect) {
            // Add the effects from the toggled ability itself to the list.
            allActiveEffects.push(...toggledAbility.definition.effect);
        }
    });

    // 5. Apply all cost_mod effects from the complete list to the summed totals.
    allActiveEffects.forEach(eff => {
        if (eff.type === 'cost_mod' && totalCosts[eff.resource] !== undefined) {
            totalCosts[eff.resource] += eff.value;
        }
    });
    
    return totalCosts;
  }

  /**
   * NEW: A modular function to render the cost calculator UI.
   * @param {object} totalCosts - The calculated costs from _calculateCurrentCosts.
   */
  _renderCostCalculator(totalCosts) {
    const container = this.modalElement.querySelector('#roll-cost-calculator');
    if (!container) return;

    if (Object.keys(totalCosts).length === 0) {
        container.innerHTML = ''; // Hide if there's no cost
        return;
    }

    let content = '<h5>Projected Cost</h5><div class="cost-breakdown">';
    for (const resourceId in totalCosts) {
        const costValue = totalCosts[resourceId];
        const resource = this.characterResources.find(r => r.id === resourceId);
        if (resource) {
            const newValue = resource.value - costValue;
            content += `
                <div class="cost-item">
                    <span class="cost-resource-name">${resource.displayName}:</span>
                    <span class="cost-values">${resource.value} → <strong class="${newValue < 0 ? 'unaffordable-text' : ''}">${newValue}</strong> (-${costValue})</span>
                </div>
            `;
        }
    }
    content += '</div>';
    container.innerHTML = content;
  }

  /**
   * NEW: Helper to ensure an ability's cost is always an array for consistent processing.
   * Handles old single-object costs and new array-based AND costs.
   * @param {object|Array} cost - The cost property from an ability definition.
   * @returns {Array<object>}
   */
  _normalizeCost(cost) {
    if (!cost) return [];
    if (Array.isArray(cost)) return cost;
    if (cost.resource) return [cost]; // Handles the old format { resource: 'x', value: y }
    return [];
  }

  /**
   * FINAL CORRECTED VERSION
   * Fixes a bug where ignore_resource effects from toggled abilities were not being applied.
   * @param {object} cost - A single cost object, e.g., { resource: 'mana', value: 10 }.
   * @returns {boolean} - True if the cost should be ignored.
   */
  _shouldIgnoreCost(cost) {
    if (!cost) return false;

    // 1. Check for passive ignore effects (from perks, items, etc.)
    // This looks at the effects that are always on.
    if (this.activeEffects.some(eff => eff.type === 'ignore_resource' && eff.resource === cost.resource)) {
        return true;
    }

    // 2. Check for ignore effects from currently toggled abilities.
    // This loops through your toggled abilities to see if THEY provide an ignore effect.
    for (const abilityId of this.toggledStates) {
        const toggledAbility = this.allToggleableAbilities.find(a => a.instancedId === abilityId);
        if (toggledAbility?.definition.effect) {
            // Check if this specific toggled ability has the ignore_resource effect.
            if (toggledAbility.definition.effect.some(eff => eff.type === 'ignore_resource' && eff.resource === cost.resource)) {
                return true;
            }
        }
    }

    // 3. If no ignore effect was found from any source, return false.
    return false;
  }

  /**
   * MODIFIED: Now performs dynamic affordability checks for AND/OR costs
   * and updates the disabled state of OR cost radio buttons.
   */
  _updateAbilityAffordability(totalCosts) {
    if (!this.allToggleableAbilities) return;

    const remainingResources = this.characterResources.reduce((acc, res) => ({...acc, [res.id]: res.value }), {});
    for (const resourceId in totalCosts) {
        if (remainingResources[resourceId] !== undefined) {
            remainingResources[resourceId] -= totalCosts[resourceId];
        }
    }
    
    this.allToggleableAbilities.forEach(ability => {
        const buttonWrapper = this.modalElement.querySelector(`[data-ability-id="${ability.instancedId}"]`)?.closest('.ability-toggle-wrapper');
        if (!buttonWrapper) return;
        
        const button = buttonWrapper.querySelector('.ability-toggle-btn');
        let canAffordAbility = true;
        const costDef = ability.definition.cost;

        if (!this.toggledStates.has(ability.instancedId) && costDef) {
            if (costDef.or) {
                // MODIFICATION: Check if SOME package in the OR list is affordable.
                canAffordAbility = costDef.or.some(costPackage => 
                    // A package is affordable if EVERY cost item inside it is affordable.
                    costPackage.every(costItem => 
                        this._shouldIgnoreCost(costItem) || (remainingResources[costItem.resource] || 0) >= costItem.value
                    )
                );
            } else {
                canAffordAbility = this._normalizeCost(costDef).every(costItem => 
                    this._shouldIgnoreCost(costItem) || (remainingResources[costItem.resource] || 0) >= costItem.value
                );
            }
        }
        button.classList.toggle('unaffordable', !canAffordAbility);
        
        if (costDef && costDef.or) {
            const radioContainer = buttonWrapper.querySelector('.or-cost-options');
            if(!radioContainer) return;

            let firstAffordableIndex = -1;
            costDef.or.forEach((costPackage, index) => {
                const radio = radioContainer.querySelector(`input[value="${index}"]`);
                if (!radio) return;
                
                // MODIFICATION: Check affordability of the entire package for the radio button.
                const isOptionAffordable = costPackage.every(costItem => 
                    this._shouldIgnoreCost(costItem) || (this.characterResources.find(r => r.id === costItem.resource)?.value || 0) >= costItem.value
                );
                
                radio.disabled = !isOptionAffordable;
                radio.parentElement.classList.toggle('unaffordable-option', !isOptionAffordable);
                if(isOptionAffordable && firstAffordableIndex === -1) {
                    firstAffordableIndex = index;
                }
            });
            
            const currentlySelectedCost = this.selectedCosts[ability.instancedId];
            const selectedRadio = buttonWrapper.querySelector('input[type="radio"]:checked');
            if (!currentlySelectedCost || (selectedRadio && selectedRadio.disabled)) {
                if (firstAffordableIndex !== -1) {
                    const newDefaultRadio = buttonWrapper.querySelector(`input[value="${firstAffordableIndex}"]`);
                    newDefaultRadio.checked = true;
                    this.selectedCosts[ability.instancedId] = costDef.or[firstAffordableIndex];
                } else {
                    delete this.selectedCosts[ability.instancedId];
                }
            }
        }
    });
  }

  /**
   * MODIFIED: Now orchestrates the dynamic cost calculation and UI updates.
   */
  _updateModifierDisplay() {
    const { totalNumerical, totalDiceNum } = this._calculateCurrentModifiers();
    const finalValue = this.hopeFearGroup.baseValue + totalNumerical;

    this.modalElement.querySelector('#mod-total-numerical').textContent = `${finalValue >= 0 ? '+' : ''}${finalValue}`;
    this.modalElement.querySelector('#mod-total-dice').textContent = `${totalDiceNum >= 0 ? '+' : ''}${totalDiceNum}d6`;

    // --- NEW ORDER OF OPERATIONS ---
    // 1. Calculate the total cost based on current toggles.
    const totalCosts = this._calculateCurrentCosts();
    // 2. Render the cost calculator UI.
    this._renderCostCalculator(totalCosts);
    // 3. Update which abilities are affordable based on the total cost.
    this._updateAbilityAffordability(totalCosts);

    // This part is for the d6 dice box display and can run independently.
    const d6Box = this.modalElement.querySelector('.d6-box');
    const resultsGrid = this.modalElement.querySelector('.results-grid');
    if (d6Box && resultsGrid) {
        const hasDiceMods = totalDiceNum !== 0;
        d6Box.style.display = hasDiceMods ? 'flex' : 'none';
        resultsGrid.classList.toggle('three-col', hasDiceMods);
        resultsGrid.classList.toggle('two-col', !hasDiceMods);
    }
  }

  /**
   * REVISED: Now displays the ability's definition name.
   */
  _showBreakdownTooltip(targetElement) {
    const relevantAttribute = this.hopeFearGroup.attributeName;
    let content = '<h5>Applied Effects</h5><ul>';
    content += `<li><strong>Base Value:</strong> ${this.hopeFearGroup.baseValue}</li>`;

    const processAbilityEffectsForTooltip = (ability, isToggled = false) => {
        if (!ability?.definition.effect) return;
        ability.definition.effect.forEach(eff => {
            if (eff.attribute === relevantAttribute && (eff.type === 'modifier' || eff.type === 'die_num')) {
                // FIX 2: Use the ability's own name from its definition.
                const displayName = ability.definition.name;
                content += `<li><strong>${displayName}${isToggled ? ' (Toggled)' : ''}:</strong> ${eff.modifier > 0 ? '+' : ''}${eff.modifier} ${eff.type === 'die_num' ? 'dice' : ''}</li>`;
            }
        });
    };

    (this.hopeFearGroup.passiveAbilities || []).forEach(ab => processAbilityEffectsForTooltip(ab, false));
    this.toggledStates.forEach(abilityId => {
        const ability = this.allToggleableAbilities.find(a => a.instancedId === abilityId || a.definition.id === abilityId);
        processAbilityEffectsForTooltip(ability, true);
    });

    content += '</ul>';
    this._showTooltip(content, targetElement, 'below');
  }

  _showTooltip(content, targetElement, positionHint = 'right') {
    this.tooltipElement.innerHTML = content;
    this.tooltipElement.style.visibility = 'hidden';
    this.tooltipElement.style.display = 'block';

    const modalContent = this.modalElement.querySelector('.roll-modal-content');
    const modalRect = modalContent.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();

    let top, left;

    if (positionHint === 'below') {
        top = targetRect.bottom - modalRect.top + 5;
        left = (modalContent.clientWidth / 2) - (tooltipRect.width / 2);
        if (left < 0) left = 5;
        if (left + tooltipRect.width > modalContent.clientWidth) {
            left = modalContent.clientWidth - tooltipRect.width - 5;
        }
    } else {
        const spaceRight = modalRect.right - targetRect.right;
        const spaceLeft = targetRect.left - modalRect.left;
        top = targetRect.top - modalRect.top;
        if (spaceRight >= tooltipRect.width + 10) {
            left = targetRect.right - modalRect.left + 10;
        } else if (spaceLeft >= tooltipRect.width + 10) {
            left = targetRect.left - modalRect.left - tooltipRect.width - 10;
        } else {
            left = targetRect.right - modalRect.left + 10;
        }
    }
    
    this.tooltipElement.style.top = `${top}px`;
    this.tooltipElement.style.left = `${left}px`;
    this.tooltipElement.style.visibility = 'visible';
  }
  
  _hideTooltip() {
      if (this.tooltipElement) {
        this.tooltipElement.style.display = 'none';
      }
  }

  _createModalHTML() {
    const groupHTML = this.rollDefinitions.map((groupDef, index) => {
      switch (groupDef.groupType) {
        case 'hope_fear':
          return this._createHopeFearGroupHTML(groupDef, index);
        case 'damage':
          return this._createDamageGroupHTML(groupDef, index);
        default:
          return '';
      }
    }).join('');
    return `
      <div id="roll-manager-modal">
        <div class="roll-modal-backdrop"></div>
        <div class="roll-modal-content">
          <button class="roll-modal-close">&times;</button>
          ${groupHTML}
          <div id="roll-manager-tooltip" class="roll-manager-tooltip" style="display: none;"></div>
        </div>
      </div>
    `;
  }

  _createHopeFearGroupHTML(groupDef, groupId) {
    const allPotentialAbilities = [
        ...(groupDef.passiveAbilities || []),
        ...(groupDef.availableActives || []),
        ...(groupDef.availableConditionals || [])
    ];
    const hasPotentialDiceMods = allPotentialAbilities.some(ab => 
        ab.definition.effect?.some(eff => eff.type === 'die_num')
    );
    let d6BoxHTML = '';
    if (hasPotentialDiceMods) {
        d6BoxHTML = `<div class="result-box d6-box" style="display: none;">
          <span class="result-label">Dice Roll</span>
          <span class="result-value d6-roll-result">--</span>
          <span class="result-details d6-roll-details"></span>
        </div>`;
    }
    const gridClass = hasPotentialDiceMods ? 'three-col' : 'two-col';

    let activesHTML = '';
    if (groupDef.availableActives && groupDef.availableActives.length > 0) {
        activesHTML = `<div class="roll-modal-section interactive-modifiers">
              <h5>Active Abilities</h5>
              <div class="ability-toggle-grid">
                ${groupDef.availableActives.map(ab => this._createToggleButtonHTML(ab)).join('')}
              </div>
            </div>`;
    }
    let conditionalsHTML = '';
    if (groupDef.availableConditionals && groupDef.availableConditionals.length > 0) {
        conditionalsHTML = `<div class="roll-modal-section interactive-modifiers">
              <h5>Conditional Abilities</h5>
              <div class="ability-toggle-list">
                 ${groupDef.availableConditionals.map(ab => this._createToggleButtonHTML(ab, true)).join('')}
              </div>
            </div>`;
    }

    // Conditionally create the HTML for the base attribute display.
    let baseAttributeHtml = '';
    if (groupDef.isAttackRoll && groupDef.attributeName) {
        const capitalizedAttribute = groupDef.attributeName.charAt(0).toUpperCase() + groupDef.attributeName.slice(1);
        baseAttributeHtml = `
            <div class="base-attribute-display">
                <span>Base Attribute:</span>
                <strong>${capitalizedAttribute}</strong>
            </div>
        `;
    }

    return `
      <div class="roll-group" id="roll-group-${groupId}" data-group-id="${groupId}">
        <h2 class="roll-modal-header">${groupDef.label}</h2>
        <div class="roll-modal-section modifiers-section">
          <h4>Modifiers Breakdown</h4>
          ${baseAttributeHtml} <div class="modifier-totals" data-action="show-breakdown-tooltip" title="Click to see breakdown">
            <span>Total Mod: <strong id="mod-total-numerical">+0</strong></span>
            <span>Dice Num: <strong id="mod-total-dice">+0d6</strong></span>
          </div>
        </div>

        ${activesHTML}
        ${conditionalsHTML}

        <div id="roll-cost-calculator" class="roll-modal-section"></div>

        <div class="roll-modal-section roll-button-section">
          <button class="roll-modal-roll-btn roll-group-btn" data-group-id="${groupId}">${groupDef.buttonLabel}</button>
        </div>
        <div class="roll-modal-section results-section">
          <h4>Results</h4>
          <div class="results-grid ${gridClass}">
            <div class="result-box hope-box">
              <span class="result-label">Hope</span>
              <span class="result-value hope-roll-result">--</span>
            </div>
            <div class="result-box fear-box">
              <span class="result-label">Fear</span>
              <span class="result-value fear-roll-result">--</span>
            </div>
            ${d6BoxHTML}
            <div class="result-box total-box">
              <span class="result-label">Total</span>
              <span class="result-value total-roll-result">--</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  _createToggleButtonHTML(ability, isConditional = false) {
    const abilityId = ability.instancedId || ability.definition.id;
    const toggledClass = this.toggledStates.has(abilityId) ? 'toggled-on' : '';
    const costDef = ability.definition.cost;
    let orCostHtml = '';

    if (costDef && costDef.or) {
      const optionsHtml = costDef.or.map((costPackage, index) => {
        // MODIFICATION: Generate a display string for the entire cost package.
        const packageDisplayString = costPackage.map(costItem => {
            const resource = this.characterResources.find(r => r.id === costItem.resource);
            const displayName = resource ? resource.displayName.substring(0, 4) : '???';
            return `${costItem.value} ${displayName}`;
        }).join(' + ');

        return `
          <label class="or-cost-label" title="${packageDisplayString}">
            <input type="radio" name="or-cost-${abilityId}" value="${index}" data-action="select-or-cost" data-ability-id="${abilityId}">
            <span>${packageDisplayString}</span>
          </label>
        `;
      }).join('');
      orCostHtml = `<div class="or-cost-options">${optionsHtml}</div>`;
    }
    
    const buttonContent = `
        <span>${ability.definition.name}</span>
        <i class="info-btn" data-action="show-info-tooltip" data-ability-id="${abilityId}">i</i>
    `;
    
    const buttonHTML = `<button class="ability-toggle-btn ${toggledClass}" data-action="toggle-ability" data-ability-id="${abilityId}">${buttonContent}</button>`;
    const toggleWrapper = `<div class="ability-toggle-wrapper">${buttonHTML}${orCostHtml}</div>`;

    if(isConditional) {
        return `
            <div class="conditional-toggle-item">
                <p class="condition-text"><strong>IF:</strong> ${ability.definition.condition}</p>
                ${toggleWrapper}
            </div>
        `;
    } else {
        return toggleWrapper;
    }
  }

  _createDamageGroupHTML(groupDef, groupId) {
    const damageBoxesHTML = groupDef.rolls.map((rollDef, index) => `
        <div class="result-box">
          <span class="result-label">${rollDef.label.charAt(0).toUpperCase() + rollDef.label.slice(1)}</span>
          <span class="result-value" id="damage-value-${index}">--</span>
          <span class="result-details" id="damage-details-${index}"></span>
        </div>`).join('');
    const numDamageTypes = groupDef.rolls.length;
    let gridClass = numDamageTypes === 1 ? '' : (numDamageTypes === 3 ? 'three-col' : (numDamageTypes >= 4 ? 'four-col' : 'two-col'));
    return `
      <div class="roll-group" id="roll-group-${groupId}" data-group-id="${groupId}">
        <h2 class="roll-modal-header">${groupDef.label}</h2>
        <div class="roll-modal-section roll-button-section">
          <button class="roll-modal-roll-btn roll-group-btn" data-group-id="${groupId}">${groupDef.buttonLabel}</button>
        </div>
        <div class="roll-modal-section results-section">
          <h4>Results</h4>
          <div class="results-grid ${gridClass}">
            ${damageBoxesHTML}
            <div class="result-box total-box">
              <span class="result-label">Total Damage</span>
              <span class="result-value damage-total-value">--</span>
            </div>
          </div>
        </div>
      </div>`;
  }
}