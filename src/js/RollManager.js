// RollManager.js

export class RollManager {
  /**
   * FINAL FIX: The constructor now sanitizes the incoming effects list once
   * using the correct 'itemId' property.
   */
  constructor(rollDefinitions, initialToggledStates = new Set(), onResourceUpdateCallback = null, onRollCompleteCallback = null) {
    this.rollDefinitions = rollDefinitions;
    this.modalElement = null;
    this.tooltipElement = null;
    this.critOccurred = false;
    this.onResourceUpdate = onResourceUpdateCallback; 
    this.onRollComplete = onRollCompleteCallback;
    this.selectedCosts = {};

    // CHANGE: Identify specific group types
    this.hopeFearGroup = this.rollDefinitions.find(def => def.groupType === 'hope_fear');
    this.d20Group = this.rollDefinitions.find(def => def.groupType === 'd20');
    
    // CHANGE: Determine a "Primary Group" for resource/ability initialization.
    // This allows the shared logic (costs, toggles) to work for EITHER system.
    this.primaryGroup = this.hopeFearGroup || this.d20Group;

    if (this.primaryGroup) {
        this.toggledStates = new Set(initialToggledStates);
        this.characterResources = this.primaryGroup.characterResources || [];
        this.allToggleableAbilities = [
            ...(this.primaryGroup.availableActives || []),
            ...(this.primaryGroup.availableConditionals || [])
        ];
        
        const allIncomingEffects = this.primaryGroup.activeEffects || [];
        const toggleableAbilityIds = new Set(this.allToggleableAbilities.map(a => a.instancedId));

        this.activeEffects = allIncomingEffects.filter(effect => !toggleableAbilityIds.has(effect.itemId));

        this.toggledStates.forEach(abilityId => {
            const ability = this.allToggleableAbilities.find(a => a.instancedId === abilityId);
            const costDef = ability?.definition.cost;

            if (costDef?.or && costDef.or.length > 0) {
                this.selectedCosts[abilityId] = costDef.or[0];
            }
        });
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
    
    // CHANGE: Check primaryGroup instead of just hopeFearGroup
    if (this.primaryGroup) {
        this._updateModifierDisplay();
    }
  }

  close() {
    if (this.modalElement) {
      this.modalElement.remove();
    }
    document.removeEventListener('keydown', this._boundCloseOnEscape);
  }

  _getAllActiveEffects() {
    const allEffects = [...this.activeEffects]; 
    this.toggledStates.forEach(abilityId => {
        const toggledAbility = this.allToggleableAbilities.find(a => a.instancedId === abilityId);
        if (toggledAbility?.definition.effect) {
            const effectsWithName = toggledAbility.definition.effect.map(eff => ({
                ...eff,
                itemName: toggledAbility.definition.name,
                itemId: toggledAbility.instancedId
            }));
            allEffects.push(...effectsWithName);
        }
    });
    return allEffects;
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

    if (target.matches('[data-action="select-or-cost"]')) {
      const abilityId = target.dataset.abilityId;
      const costIndex = parseInt(target.value, 10);
      const ability = this.allToggleableAbilities.find(a => a.instancedId === abilityId);
      if (ability && ability.definition.cost.or) {
          this.selectedCosts[abilityId] = ability.definition.cost.or[costIndex];
          this._updateModifierDisplay();
      }
      return;
    }

    const rollButton = target.closest('.roll-group-btn');
    if (rollButton) {
      const groupId = parseInt(rollButton.dataset.groupId, 10);
      
      const costs = this._calculateCurrentCosts();
      const groupDef = this.rollDefinitions[groupId];
      let gains = {};
      let rollData = {};

      // CHANGE: Route logic based on groupType
      if (groupDef.groupType === 'hope_fear') {
          rollData = this._calculateHopeFearRoll(groupDef);
          gains = rollData.gains;
          this.critOccurred = rollData.crit; 
      } else if (groupDef.groupType === 'd20') {
          // CHANGE: Execute D20 Logic
          rollData = this._calculateD20Roll(groupDef);
          // D20 typically doesn't have built-in resource gains on roll, but we can add if needed later
          this.critOccurred = rollData.isCritSuccess; 
      }

      const finalDeltas = {};
      for (const resourceId in costs) {
          finalDeltas[resourceId] = (finalDeltas[resourceId] || 0) - costs[resourceId];
      }
      for (const resourceId in gains) {
          finalDeltas[resourceId] = (finalDeltas[resourceId] || 0) + gains[resourceId];
      }

      if (Object.keys(finalDeltas).length > 0 && typeof this.onResourceUpdate === 'function') {
        const updatedResources = await this.onResourceUpdate(finalDeltas);
        if (updatedResources) {
            this.characterResources = updatedResources;
        } else {
            console.error("Resource update failed, aborting roll.");
            return; 
        }
      }
      
      this._executeRoll(groupId, rollData);
      this._updateModifierDisplay();

      if (this.onRollComplete) {
        this.onRollComplete();
      }
      return;
    }
    
    // ... (Tooltip and toggle logic remains unchanged) ...
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
        console.warn("You cannot afford to toggle this ability.");
        return;
      }
      const abilityId = abilityToggler.dataset.abilityId;
      if (this.toggledStates.has(abilityId)) {
          this.toggledStates.delete(abilityId);
      } else {
          this.toggledStates.add(abilityId);
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
  
  _executeRoll(groupId, rollData = {}) {
    const groupDef = this.rollDefinitions[groupId];
    const groupEl = this.modalElement.querySelector(`.roll-group[data-group-id="${groupId}"]`);
    if (!groupDef || !groupEl) return;

    switch (groupDef.groupType) {
      case 'hope_fear':
        this._renderHopeFearRoll(groupDef, groupEl, rollData);
        break;
      case 'd20':
        // CHANGE: Render D20
        this._renderD20Roll(groupDef, groupEl, rollData);
        break;
      case 'damage':
        this._executeDamageRoll(groupDef, groupEl);
        break;
    }
  }

  // --- D20 LOGIC START ---

  /**
   * Calculates D20 roll mechanics:
   * Nat 1 = Auto Fail. Nat 20 = Auto Success.
   */
  _calculateD20Roll(groupDef) {
    // Pass groupDef so modifiers know which attribute to check
    const { totalNumerical, totalDiceNum } = this._calculateCurrentModifiers(groupDef);
    
    const d20Roll = Math.floor(Math.random() * 20) + 1;
    let d6Modifier = 0;
    let d6Rolls = [];

    // Handle optional extra dice (e.g., Bardic Inspiration or Bless logic if mapped to dice_num)
    if (totalDiceNum !== 0) {
      const numD6ToRoll = Math.abs(totalDiceNum);
      for (let i = 0; i < numD6ToRoll; i++) {
        d6Rolls.push(Math.floor(Math.random() * 6) + 1);
      }
      const d6Sum = d6Rolls.reduce((sum, roll) => sum + roll, 0);
      d6Modifier = totalDiceNum > 0 ? d6Sum : -d6Sum;
    }

    const isCritSuccess = d20Roll === 20;
    const isCritFail = d20Roll === 1;
    const baseValue = groupDef.baseValue || 0;

    // Total ignores modifiers on Nat 1/20 conceptually in D&D for hit/miss logic,
    // but usually you still display the math. We will display the math but highlight the result.
    const totalValue = d20Roll + baseValue + totalNumerical + d6Modifier;

    return {
        d20Roll,
        totalNumerical,
        d6Modifier,
        d6Rolls,
        isCritSuccess,
        isCritFail,
        totalValue
    };
  }

  _renderD20Roll(groupDef, groupEl, rollData) {
    const { d20Roll, d6Modifier, d6Rolls, totalValue, isCritSuccess, isCritFail } = rollData;

    // Handle D6 display if applicable
    if (d6Rolls.length > 0) {
        const d6ResultEl = groupEl.querySelector('.d6-roll-result');
        const d6DetailsEl = groupEl.querySelector('.d6-roll-details');
        if(d6ResultEl) d6ResultEl.textContent = `${d6Modifier >= 0 ? '+' : ''}${d6Modifier}`;
        if(d6DetailsEl) d6DetailsEl.textContent = `(Rolled: ${d6Rolls.join(', ')})`;
    }

    const d20ResultEl = groupEl.querySelector('.d20-roll-result');
    const totalResultEl = groupEl.querySelector('.total-roll-result');
    const resultBox = totalResultEl.closest('.result-box');

    d20ResultEl.textContent = d20Roll;
    totalResultEl.textContent = totalValue;

    // Reset classes
    d20ResultEl.classList.remove('nat-20', 'nat-1');
    resultBox.classList.remove('critical-success', 'critical-fail');
    totalResultEl.textContent = totalValue;

    if (isCritSuccess) {
        d20ResultEl.classList.add('nat-20');
        resultBox.classList.add('critical-success');
        totalResultEl.textContent = "CRIT!"; 
    } else if (isCritFail) {
        d20ResultEl.classList.add('nat-1');
        resultBox.classList.add('critical-fail');
        totalResultEl.textContent = "FAIL!";
    }
  }

  // --- D20 LOGIC END ---

  _calculateHopeFearRoll(groupDef) {
    // CHANGE: Explicitly pass groupDef to modifiers
    const { totalNumerical, totalDiceNum } = this._calculateCurrentModifiers(groupDef);
    const finalValue = groupDef.baseValue + totalNumerical;
    
    const highestHope = Math.floor(Math.random() * 12) + 1;
    const highestFear = Math.floor(Math.random() * 12) + 1;
    let d6Modifier = 0;
    let d6Rolls = [];

    if (totalDiceNum !== 0) {
      const numD6ToRoll = Math.abs(totalDiceNum);
      for (let i = 0; i < numD6ToRoll; i++) {
        d6Rolls.push(Math.floor(Math.random() * 6) + 1);
      }
      const d6Sum = d6Rolls.reduce((sum, roll) => sum + roll, 0);
      d6Modifier = totalDiceNum > 0 ? d6Sum : -d6Sum;
    }

    const crit = highestHope === highestFear;
    const hopeWin = highestHope > highestFear;
    let gains = {};

    if (hopeWin && groupDef.hopeBonus) {
        const { resourceId, maxProperty, percentage } = groupDef.hopeBonus;
        const resource = this.characterResources.find(r => r.id === resourceId);
        if (resource && resource[maxProperty] !== undefined) {
            const amountToRestore = Math.ceil(resource[maxProperty] * (percentage / 100));
            gains[resourceId] = amountToRestore;
        }
    }

    return {
        highestHope,
        highestFear,
        d6Modifier,
        d6Rolls,
        finalValue,
        crit,
        hopeWin,
        gains
    };
  }
  
  _renderHopeFearRoll(groupDef, groupEl, rollData) {
    const { highestHope, highestFear, d6Modifier, d6Rolls, finalValue, crit, hopeWin } = rollData;

    if (d6Rolls.length > 0) {
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

    if (crit) {
      totalResultEl.textContent = "CRITICAL SUCCESS!!";
      totalResultEl.classList.add('critical-text');
      totalResultEl.parentElement.classList.add('critical-success');
    } else {
      const finalTotal = highestHope + highestFear + finalValue + d6Modifier;
      totalResultEl.textContent = finalTotal;
      if (hopeWin) {
        hopeBoxEl.classList.add('hope-win');
      } else {
        fearBoxEl.classList.add('fear-win');
      }
    }
  }

  _executeDamageRoll(groupDef, groupEl) {
    let totalDamage = 0;
    const allActiveEffects = this._getAllActiveEffects();

    groupDef.rolls.forEach((rollDef, index) => {
      let baseDice = [rollDef.dice];
      let baseValue = rollDef.baseValue || 0;
      
      if (this.critOccurred) {
        baseDice = baseDice.flatMap(d => [d, d]);
      }

      allActiveEffects.forEach(eff => {
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
  
  // CHANGE: Added `groupDef` parameter to allow context-aware calculation
  _calculateCurrentModifiers(groupDef = null) {
    let totalNumerical = 0;
    let totalDiceNum = 0;
    
    // If no groupDef passed, try to default to primary (fallback)
    const targetGroup = groupDef || this.primaryGroup;
    const relevantAttribute = targetGroup?.attributeName;

    const allActiveEffects = this._getAllActiveEffects();

    allActiveEffects.forEach(eff => {
      // Only apply modifiers if the attribute matches the current roll's attribute
      if (relevantAttribute && eff.attribute === relevantAttribute) {
          if (eff.type === 'modifier') totalNumerical += eff.modifier;
          if (eff.type === 'die_num') totalDiceNum += eff.modifier;
      }
      // We could add a 'global' modifier type here later if needed
    });
    
    return { totalNumerical, totalDiceNum };
  }

  _calculateCurrentCosts() {
    const totalCosts = {};
    const activeCostSources = [];

    // CHANGE: Use primaryGroup for base costs
    if (this.primaryGroup && this.primaryGroup.cost) {
        activeCostSources.push({
            costDef: this.primaryGroup.cost,
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

    activeCostSources.forEach(source => {
        let costPackage = [];
        if (source.costDef.or) {
            costPackage = this.selectedCosts[source.id] || [];
        } else {
            costPackage = this._normalizeCost(source.costDef);
        }

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

    const allActiveEffects = this._getAllActiveEffects();

    allActiveEffects.forEach(eff => {
        if (eff.type === 'cost_mod' && totalCosts[eff.resource] !== undefined) {
            totalCosts[eff.resource] += eff.value;
        }
    });
    
    return totalCosts;
  }

  _renderCostCalculator(totalCosts) {
    const container = this.modalElement.querySelector('#roll-cost-calculator');
    if (!container) return;

    if (Object.keys(totalCosts).length === 0) {
        container.innerHTML = '';
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

  _normalizeCost(cost) {
    if (!cost) return [];
    if (Array.isArray(cost)) return cost;
    if (cost.resource) return [cost];
    return [];
  }

  _shouldIgnoreCost(cost) {
    if (!cost) return false;

    if (this.activeEffects.some(eff => eff.type === 'ignore_resource' && eff.resource === cost.resource)) {
        return true;
    }

    for (const abilityId of this.toggledStates) {
        const toggledAbility = this.allToggleableAbilities.find(a => a.instancedId === abilityId);
        if (toggledAbility?.definition.effect) {
            if (toggledAbility.definition.effect.some(eff => eff.type === 'ignore_resource' && eff.resource === cost.resource)) {
                return true;
            }
        }
    }

    return false;
  }

  _updateAbilityAffordability(totalCosts) {
    if (!this.allToggleableAbilities) return;
    
    this.allToggleableAbilities.forEach(ability => {
        const buttonWrapper = this.modalElement.querySelector(`[data-ability-id="${ability.instancedId}"]`)?.closest('.ability-toggle-wrapper');
        if (!buttonWrapper) return;
        
        const button = buttonWrapper.querySelector('.ability-toggle-btn');
        button.classList.toggle('toggled-on', this.toggledStates.has(ability.instancedId));

        const costDef = ability.definition.cost;
        
        const remainingResources = this.characterResources.reduce((acc, res) => ({...acc, [res.id]: res.value }), {});
        for (const resourceId in totalCosts) {
            if (remainingResources[resourceId] !== undefined) remainingResources[resourceId] -= totalCosts[resourceId];
        }

        if (!this.toggledStates.has(ability.instancedId) && costDef) {
            let canAffordAbility = true;
            if (costDef.or) {
                canAffordAbility = costDef.or.some(pkg => pkg.every(item => this._shouldIgnoreCost(item) || (remainingResources[item.resource] || 0) >= item.value));
            } else {
                canAffordAbility = this._normalizeCost(costDef).every(item => this._shouldIgnoreCost(item) || (remainingResources[item.resource] || 0) >= item.value);
            }
            button.classList.toggle('unaffordable', !canAffordAbility);
        } else {
            button.classList.remove('unaffordable');
        }
        
        if (costDef && costDef.or) {
            const radioContainer = buttonWrapper.querySelector('.or-cost-options');
            if(!radioContainer) return;

            const currentSelectedPackage = this.selectedCosts[ability.instancedId];
            
            const costOfOtherThings = { ...totalCosts };
            if (this.toggledStates.has(ability.instancedId) && currentSelectedPackage) {
                currentSelectedPackage.forEach(costItem => {
                    if (costOfOtherThings[costItem.resource] !== undefined) {
                        costOfOtherThings[costItem.resource] -= costItem.value;
                    }
                });
            }

            const resourcesLeftForThisAbility = this.characterResources.reduce((acc, res) => ({...acc, [res.id]: res.value }), {});
            for (const resourceId in costOfOtherThings) {
                if (resourcesLeftForThisAbility[resourceId] !== undefined) {
                    resourcesLeftForThisAbility[resourceId] -= costOfOtherThings[resourceId];
                }
            }

            costDef.or.forEach((costPackage, index) => {
                const radio = radioContainer.querySelector(`input[value="${index}"]`);
                if (!radio) return;
                
                const isOptionAffordable = costPackage.every(item => this._shouldIgnoreCost(item) || (resourcesLeftForThisAbility[item.resource] || 0) >= item.value);
                
                radio.disabled = !isOptionAffordable;
                radio.parentElement.classList.toggle('unaffordable-option', !isOptionAffordable);
                
                const isThisPackageSelected = JSON.stringify(this.selectedCosts[ability.instancedId]) === JSON.stringify(costPackage);
                if (isThisPackageSelected) {
                    radio.checked = true;
                }
            });
        }
    });
  }

  _updateRollButtonState(totalCosts) {
    // CHANGE: Find the index of the primary active roll group (HopeFear OR D20)
    const primaryGroupIndex = this.rollDefinitions.findIndex(def => def.groupType === 'hope_fear' || def.groupType === 'd20');
    if (primaryGroupIndex === -1) return;
    const rollButton = this.modalElement.querySelector(`#roll-group-${primaryGroupIndex} .roll-group-btn`);
    if (!rollButton) return;

    let isUnaffordable = false;
    for (const resourceId in totalCosts) {
        const costValue = totalCosts[resourceId];
        const resource = this.characterResources.find(r => r.id === resourceId);
        const availableAmount = resource ? resource.value : 0;

        if (costValue > availableAmount) {
            isUnaffordable = true;
            break;
        }
    }
    
    rollButton.disabled = isUnaffordable;
  }

  _updateModifierDisplay() {
    if (!this.primaryGroup) return;

    while (true) {
        const totalCosts = this._calculateCurrentCosts();
        const deficientResources = new Set();

        for (const resourceId in totalCosts) {
            const resource = this.characterResources.find(r => r.id === resourceId);
            if (!resource || resource.value < totalCosts[resourceId]) {
                deficientResources.add(resourceId);
            }
        }

        if (deficientResources.size === 0) {
            break; 
        }

        let switchedCost = false;
        const abilitiesToRecheck = this.allToggleableAbilities.filter(
            ab => this.toggledStates.has(ab.instancedId) && ab.definition.cost?.or
        );

        for (const ability of abilitiesToRecheck) {
            const currentCostPackage = this.selectedCosts[ability.instancedId] || [];
            const isProblematic = currentCostPackage.some(item => deficientResources.has(item.resource));

            if (isProblematic) {
                const costOfOtherThings = { ...totalCosts };
                currentCostPackage.forEach(costItem => {
                    if (costOfOtherThings[costItem.resource] !== undefined) {
                        costOfOtherThings[costItem.resource] -= costItem.value; 
                    }
                });

                const resourcesLeftForThisAbility = this.characterResources.reduce((acc, res) => ({...acc, [res.id]: res.value }), {});
                for (const resourceId in costOfOtherThings) {
                    if (resourcesLeftForThisAbility[resourceId] !== undefined) {
                        resourcesLeftForThisAbility[resourceId] -= costOfOtherThings[resourceId];
                    }
                }
                
                let bestAlternative = null;
                for (const alternativePackage of ability.definition.cost.or) {
                    if (alternativePackage === currentCostPackage) continue;

                    const isAlternativeAffordable = alternativePackage.every(item => 
                        this._shouldIgnoreCost(item) || (resourcesLeftForThisAbility[item.resource] || 0) >= item.value
                    );

                    if (isAlternativeAffordable) {
                        bestAlternative = alternativePackage;
                        break; 
                    }
                }
                
                if (bestAlternative) {
                    this.selectedCosts[ability.instancedId] = bestAlternative;
                    switchedCost = true;
                    break; 
                }
            }
        }

        if (switchedCost) {
            continue; 
        }
        
        let victimFoundAndDisabled = false;
        const toggledAbilityIds = Array.from(this.toggledStates);

        for (let i = toggledAbilityIds.length - 1; i >= 0; i--) {
            const potentialVictimId = toggledAbilityIds[i];
            const ability = this.allToggleableAbilities.find(a => a.instancedId === potentialVictimId);
            if (!ability?.definition.cost) continue;

            const costDef = ability.definition.cost;
            const costPackage = costDef.or ? (this.selectedCosts[potentialVictimId] || []) : this._normalizeCost(costDef);
            const contributesToDeficit = costPackage.some(item => deficientResources.has(item.resource));
            
            if (contributesToDeficit) {
                this.toggledStates.delete(potentialVictimId);
                victimFoundAndDisabled = true;
                break;
            }
        }

        if (!victimFoundAndDisabled) {
            break; 
        }
    }

    // CHANGE: Pass primaryGroup to calculate modifiers for display
    const { totalNumerical, totalDiceNum } = this._calculateCurrentModifiers(this.primaryGroup);
    const finalValue = this.primaryGroup.baseValue + totalNumerical;
    
    this.modalElement.querySelector('#mod-total-numerical').textContent = `${finalValue >= 0 ? '+' : ''}${finalValue}`;
    this.modalElement.querySelector('#mod-total-dice').textContent = `${totalDiceNum >= 0 ? '+' : ''}${totalDiceNum}d6`;

    const finalCosts = this._calculateCurrentCosts();
    this._renderCostCalculator(finalCosts);
    this._updateAbilityAffordability(finalCosts);
    this._updateRollButtonState(finalCosts);

    const d6Box = this.modalElement.querySelector('.d6-box');
    const resultsGrid = this.modalElement.querySelector('.results-grid');
    if (d6Box && resultsGrid) {
        const hasDiceMods = totalDiceNum !== 0;
        d6Box.style.display = hasDiceMods ? 'flex' : 'none';
        // Logic to handle grid classes might need slight adjustment if mixing systems, 
        // but works for single primary group view.
        resultsGrid.classList.toggle('three-col', hasDiceMods);
        resultsGrid.classList.toggle('two-col', !hasDiceMods);
    }
  }

  _showBreakdownTooltip(targetElement) {
    const relevantAttribute = this.primaryGroup?.attributeName;
    let content = '<h5>Applied Effects</h5><ul>';
    content += `<li><strong>Base Value:</strong> ${this.primaryGroup.baseValue}</li>`;

    const allActiveEffects = this._getAllActiveEffects();

    allActiveEffects.forEach(eff => {
        if (eff.attribute === relevantAttribute && (eff.type === 'modifier' || eff.type === 'die_num')) {
            const displayName = eff.itemName || eff.name || 'Effect';
            const sourceInfo = this.toggledStates.has(eff.itemId) ? ' (Toggled)' : '';
            content += `<li><strong>${displayName}${sourceInfo}:</strong> ${eff.modifier > 0 ? '+' : ''}${eff.modifier} ${eff.type === 'die_num' ? 'dice' : ''}</li>`;
        }
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
        case 'd20':
          // CHANGE: Add case for d20
          return this._createD20GroupHTML(groupDef, index);
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

  // CHANGE: New HTML generator for D20 layout
  _createD20GroupHTML(groupDef, groupId) {
    const allPotentialAbilities = [
        ...(groupDef.passiveAbilities || []),
        ...(groupDef.availableActives || []),
        ...(groupDef.availableConditionals || [])
    ];
    const hasPotentialDiceMods = allPotentialAbilities.some(ab => 
        ab.definition.effect?.some(eff => eff.type === 'die_num')
    );
    
    let d6BoxHTML = '';
    // We include the D6 box hidden by default, toggle it if modifiers appear
    d6BoxHTML = `<div class="result-box d6-box" style="display: none;">
      <span class="result-label">Bonus Dice</span>
      <span class="result-value d6-roll-result">--</span>
      <span class="result-details d6-roll-details"></span>
    </div>`;

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

    let baseAttributeHtml = '';
    if (groupDef.attributeName) {
        const capitalizedAttribute = groupDef.attributeName.charAt(0).toUpperCase() + groupDef.attributeName.slice(1);
        baseAttributeHtml = `
            <div class="base-attribute-display">
                <span>Attribute:</span>
                <strong>${capitalizedAttribute}</strong>
            </div>
        `;
    }

    return `
      <div class="roll-group" id="roll-group-${groupId}" data-group-id="${groupId}">
        <h2 class="roll-modal-header">${groupDef.label}</h2>
        <div class="roll-modal-section modifiers-section">
          <h4>Modifiers</h4>
          ${baseAttributeHtml} 
          <div class="modifier-totals" data-action="show-breakdown-tooltip" title="Click to see breakdown">
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
          <div class="results-grid two-col">
            <div class="result-box d20-box">
              <span class="result-label">d20 Roll</span>
              <span class="result-value d20-roll-result">--</span>
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
        const packageDisplayString = costPackage.map(costItem => {
            const resource = this.characterResources.find(r => r.id === costItem.resource);
            const displayName = resource ? resource.displayName.substring(0, 4) : '???';
            return `${costItem.value} ${displayName}`;
        }).join(' + ');

        const isSelected = JSON.stringify(this.selectedCosts[abilityId]) === JSON.stringify(costPackage);
        
        return `
          <label class="or-cost-label" title="${packageDisplayString}">
            <input type="radio" name="or-cost-${abilityId}" value="${index}" data-action="select-or-cost" data-ability-id="${abilityId}" ${isSelected ? 'checked' : ''}>
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
      </div>
    `;
  }
}