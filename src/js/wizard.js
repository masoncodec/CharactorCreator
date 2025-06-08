class CharacterWizard {
  constructor(moduleSystem, flawData, destinyData, abilityData, db) {
    this.currentPage = 0;
    this.pages = ['module', 'destiny', 'attributes', 'info'];
    this.state = {
      module: null,
      moduleChanged: false, // This flag is still used for resetting destiny/attributes when module *truly* changes
      destiny: null,
      flaws: [], // Track {id, destiny: boolean}
      abilities: [], // Track {id, selections, tier}
      attributes: {},
      info: { name: '', bio: '' }
    };
    // Assign the loaded data to instance properties
    this.moduleSystem = moduleSystem; // This will now be an object where keys are module IDs
    this.flawData = flawData;
    this.destinyData = destinyData; // This will now be an object where keys are destiny IDs
    this.abilityData = abilityData;

    this.db = db;
    this.navItems = document.querySelectorAll('.nav-item');
    
    console.log('CharacterWizard: Initializing wizard.');
    this.init();

    // Add validation call
    this.validateData();
  }

  init() {
    console.log('CharacterWizard.init: Setting up global event listeners.');
    this.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        if (item.classList.contains('disabled')) {
          console.log(`CharacterWizard.init: Navigation to page ${item.dataset.page} is disabled.`);
          return;
        }
        this.goToPage(item.dataset.page);
      });
    });

    document.getElementById('prevBtn').addEventListener('click', () => this.prevPage());
    document.getElementById('nextBtn').addEventListener('click', () => this.nextPage());

    this.loadPage(this.pages[0]);
    console.log(`CharacterWizard.init: Initial page loaded: ${this.pages[0]}`);
  }

  loadPage(page) {
    this.currentPage = this.pages.indexOf(page);
    console.log(`CharacterWizard.loadPage: Loading page: ${page} (Index: ${this.currentPage})`);
    
    // Load selector content
    fetch(`partials/${page}-selector.html`)
      .then(r => {
          console.log(`CharacterWizard.loadPage: Fetched selector HTML for ${page}. Status: ${r.status}`);
          return r.text();
      })
      .then(html => {
        document.getElementById('selectorPanel').innerHTML = html;
        console.log(`CharacterWizard.loadPage: Selector panel for ${page} updated.`);
        // IMPORTANT: setupPageEvents must be called AFTER innerHTML is set to ensure DOM is ready.
        // For 'attributes', setupPageEvents will then call diceManager.init() which handles state restoration.
        this.setupPageEvents(page); 
        // restoreState is now primarily for other pages; attributes is handled by diceManager.init()
        this.restoreState(page); 
      })
      .catch(error => console.error(`CharacterWizard.loadPage: Error fetching selector partial for ${page}:`, error));

    // Load informer content
    fetch(`partials/${page}-informer.html`)
      .then(r => {
          console.log(`CharacterWizard.loadPage: Fetched informer HTML for ${page}. Status: ${r.status}`);
          return r.text();
      })
      .then(html => {
        document.getElementById('informerPanel').innerHTML = html;
        console.log(`CharacterWizard.loadPage: Informer panel for ${page} updated.`);
        this.updateInformer(page);
      })
      .catch(error => console.error(`CharacterWizard.loadPage: Error fetching informer partial for ${page}:`, error));

    this.updateNav();
  }

  // Navigation control
  updateNav() {
    console.log('CharacterWizard.updateNav: Updating navigation state and buttons.');
    this.navItems.forEach(item => {
      const page = item.dataset.page;
      const index = this.pages.indexOf(page);
      const canAccess = this.canAccessPage(index);
      const isCompleted = this.isPageCompleted(page);

      item.classList.toggle('disabled', !canAccess);
      item.classList.toggle('active', index === this.currentPage);
      item.classList.toggle('completed', isCompleted); 
      
      if (!canAccess) {
        const reason = this.getNavigationBlockReason(index);
        item.title = reason;
        console.log(`CharacterWizard.updateNav: Page ${page} disabled. Reason: ${reason}`);
      } else {
        item.removeAttribute('title');
      }
    });

    document.getElementById('prevBtn').disabled = this.currentPage === 0;
    document.getElementById('nextBtn').textContent = 
      this.currentPage === this.pages.length - 1 ? 'Finish' : 'Next';
      console.log(`CharacterWizard.updateNav: Prev button disabled: ${document.getElementById('prevBtn').disabled}, Next button text: ${document.getElementById('nextBtn').textContent}`);
  }

  canAccessPage(index) {
      // Always allow access to the first page (module) and last page (info)
      if (index === 0 || index === this.pages.length - 1) {
          console.log(`CharacterWizard.canAccessPage: Page index ${index} is always accessible.`);
          return true;
      }
      
      // For other pages, require module selection
      if (!this.state.module) {
          console.log(`CharacterWizard.canAccessPage: Page index ${index} requires module selection. Current module: ${this.state.module}`);
          return false;
      }
      
      console.log(`CharacterWizard.canAccessPage: Page index ${index} is accessible.`);
      return true;
  }

  getNavigationBlockReason(index) {
      if (index === this.pages.length - 1) return "Enter basic details anytime"; 
      if (!this.state.module) return "Select a module first";
      return "";
  }

  // Page event setup
  setupPageEvents(page) {
    console.log(`CharacterWizard.setupPageEvents: Setting up events for page: ${page}`);
    switch(page) {
      case 'module':
        document.querySelectorAll('.module-option').forEach(opt => {
          opt.addEventListener('click', () => {
            document.querySelectorAll('.module-option').forEach(o => 
              o.classList.remove('selected'));
            opt.classList.add('selected');
            const oldModule = this.state.module;
            this.state.module = opt.dataset.value;
            this.state.moduleChanged = (oldModule !== this.state.module);
            if (this.state.moduleChanged) {
                console.log(`CharacterWizard.setupPageEvents (module): Module changed from ${oldModule} to ${this.state.module}. Resetting destiny, flaw, and attributes.`);
                this.state.destiny = null; // Reset dependent choices
                this.state.flaws = []; //Reset flaws
                this.state.abilities = []; // Reset abilities
                this.state.attributes = {};
            } else {
                console.log(`CharacterWizard.setupPageEvents (module): Module re-selected: ${this.state.module}. No change.`);
            }
            this.updateInformer(page);
            this.updateNav(); 
          });
        });
        break;
        
        case 'destiny':
          const destinyOptionsContainer = document.getElementById('destiny-options-container');
          destinyOptionsContainer.innerHTML = ''; // Clear previous options

          if (this.state.module) {
            const destiniesForModule = this.moduleSystem[this.state.module].destinies || [];
            destiniesForModule.forEach(destinyId => {
              const destiny = this.destinyData[destinyId];
              if (!destiny) {
                  console.error(`Missing destiny data for: ${destinyId}`);
                  return;
              }
              const isSelected = this.state.destiny === destinyId;
              const destinyOptionDiv = document.createElement('div');
              destinyOptionDiv.classList.add('destiny-option');
              if (isSelected) {
                  destinyOptionDiv.classList.add('selected');
              }
              destinyOptionDiv.dataset.destinyId = destinyId;
              destinyOptionDiv.innerHTML = `
                <span class="destiny-name">${destiny.displayName}</span>
              `;
              destinyOptionsContainer.appendChild(destinyOptionDiv);
            });
          }

          // Listener for dynamically created destiny option divs
          destinyOptionsContainer.addEventListener('click', (e) => {
            const destinyOptionDiv = e.target.closest('.destiny-option');
            if (destinyOptionDiv) {
              const selectedDestinyId = destinyOptionDiv.dataset.destinyId;
              
              // Remove 'selected' class from all other destiny options
              document.querySelectorAll('.destiny-option').forEach(opt => {
                opt.classList.remove('selected');
              });

              // Add the newly selected destiny to the state
              this.state.destiny = selectedDestinyId;
              this.state.abilities = []; // Reset on destiny change
              this.state.flaws = this.state.flaws.filter(f => !f.destiny); // Clear only 'destiny' flaws
              
              // Add 'selected' to the clicked one
              destinyOptionDiv.classList.add('selected');
              
              console.log(`CharacterWizard.setupPageEvents (destiny): Destiny selected: ${selectedDestinyId}. Current destiny:`, this.state.destiny);
              
              this.renderDestinyDetails();
              this.renderAbilitiesSection();
              this.updateInformer(page);
              this.updateNav();
            }
          });

          // Existing flaw selection listener remains as is
          document.querySelector('#selectorPanel').addEventListener('click', (e) => {
            const flawOptionDiv = e.target.closest('.flaw-option');
            if (flawOptionDiv) {
              const selectedFlawId = flawOptionDiv.dataset.flawId;

              this.state.flaws = this.state.flaws.filter(f => !f.destiny);
              document.querySelectorAll('.flaw-option').forEach(opt => {
                opt.classList.remove('selected');
              });
              this.state.flaws.push({ id: selectedFlawId, destiny: true });
              flawOptionDiv.classList.add('selected');
              
              console.log(`CharacterWizard.setupPageEvents (destiny): Flaw selected: ${selectedFlawId}. Current flaws:`, this.state.flaws);
              
              this.updateInformer(page);
              this.updateNav();
            }
          });
          break;
        
      case 'attributes':
          const tableContainer = document.getElementById('selectorPanel'); 
          let currentTable = tableContainer.querySelector('.dice-assignment-table');
          
          const previouslyRenderedModule = currentTable ? currentTable.dataset.renderedModule : null;
          const needsTableRefresh = !currentTable || (this.state.module && previouslyRenderedModule !== this.state.module);

          console.log(`CharacterWizard.setupPageEvents (attributes): Needs table refresh: ${needsTableRefresh}. Current Module: ${this.state.module}, Previously Rendered: ${previouslyRenderedModule}`);

          if (needsTableRefresh) {
              console.log('CharacterWizard.setupPageEvents (attributes): Re-rendering attribute table.');
              
              const newTable = document.createElement('table');
              newTable.classList.add('dice-assignment-table');
              newTable.dataset.renderedModule = this.state.module; 
              newTable.innerHTML = `
                  <thead>
                      <tr>
                          <th>Attribute</th>
                          <th colspan="6">Assign Die</th>
                      </tr>
                  </thead>
                  <tbody></tbody>
              `;
              
              const newTableBody = newTable.querySelector('tbody');
              
              if (this.state.module) {
                  this.moduleSystem[this.state.module].attributes.forEach(attr => {
                      const row = document.createElement('tr');
                      row.dataset.attribute = attr.toLowerCase();
                      row.innerHTML = `
                      <td>${attr}</td>
                      <td><button type="button" data-die="d4">D4</button></td>
                      <td><button type="button" data-die="d6">D6</button></td>
                      <td><button type="button" data-die="d8">D8</button></td>
                      <td><button type="button" data-die="d10">D10</button></td>
                      <td><button type="button" data-die="d12">D12</button></td>
                      <td><button type="button" data-die="d20">D20</button></td>
                      `;
                      newTableBody.appendChild(row);
                  });
                  console.log(`CharacterWizard.setupPageEvents (attributes): Attribute rows generated for module: ${this.state.module}`);
              } else {
                  console.log('CharacterWizard.setupPageEvents (attributes): No module selected, cannot generate attributes table.');
              }

              if (currentTable) {
                  currentTable.replaceWith(newTable);
                  console.log('CharacterWizard.setupPageEvents (attributes): Replaced existing table with new one.');
              } else {
                  tableContainer.appendChild(newTable); 
                  console.log('CharacterWizard.setupPageEvents (attributes): Appended new table to selector panel.');
              }
              currentTable = newTable; 
              
              this.state.moduleChanged = false; 
          } else {
              console.log('CharacterWizard.setupPageEvents (attributes): Attribute table does not need re-rendering. Module is unchanged or table exists.');
          }
          
          const diceManager = {
              wizard: this,
              selectedDice: new Map(), 
              assignedAttributes: new Map(), 
              tableElement: currentTable, // Crucial: Pass the reference to the current table
              
              init() {
                  console.log('diceManager.init: Initializing/re-initializing dice manager.');
                  this.selectedDice.clear();
                  this.assignedAttributes.clear();
      
                  this.tableElement.querySelectorAll('button').forEach(btn => { // Use this.tableElement
                      btn.classList.remove('selected');
                      btn.disabled = false;
                      btn.textContent = btn.dataset.die.toUpperCase(); 
                  });
                  
                  console.log('diceManager.init: Restoring previous attribute assignments from wizard state:', this.wizard.state.attributes);
                  Object.entries(this.wizard.state.attributes).forEach(([attr, die]) => {
                      this.selectedDice.set(die, attr);
                      this.assignedAttributes.set(attr, die);
                      const btn = this.tableElement.querySelector(`tr[data-attribute="${attr}"] button[data-die="${die}"]`); // Use this.tableElement
                      if (btn) {
                          btn.classList.add('selected');
                          console.log(`diceManager.init: Restored UI selection for ${attr} with ${die}.`);
                      }
                  });
              
                  // Ensure only one event listener is active on the correct table
                  if (this.boundProcessSelection) {
                      this.tableElement.removeEventListener('click', this.boundProcessSelection);
                  }
                  // Bind 'this' context for the event listener
                  this.boundProcessSelection = this.handleTableClick.bind(this);
                  this.tableElement.addEventListener('click', this.boundProcessSelection);
                  console.log('diceManager.init: Event listener attached to dice assignment table.');
              
                  this.updateDieStates();
                  console.log('diceManager.init: Dice manager initialized.');
              },

              // New method to handle the click event from the table
              handleTableClick(e) {
                  const button = e.target.closest('button[data-die]');
                  if (!button) return;
          
                  const row = button.closest('tr');
                  const attribute = row.dataset.attribute;
                  const die = button.dataset.die;
                  
                  this.processSelection(attribute, die, button);
              },
      
              processSelection(attribute, die, button) {
                  const currentAssignmentForAttribute = this.assignedAttributes.get(attribute);
                  console.log(`diceManager.processSelection: Processing selection for attribute '${attribute}'. Current assignment: ${currentAssignmentForAttribute || 'None'}. New selection: ${die}.`);
                  
                  if (currentAssignmentForAttribute === die) {
                      console.log(`diceManager.processSelection: Unassigning ${die} from ${attribute}.`);
                      this.clearAssignment(attribute, die);
                      button.classList.remove('selected');
                  } else {
                      if (this.selectedDice.has(die)) {
                          const assignedToAttr = this.selectedDice.get(die);
                          console.warn(`diceManager.processSelection: Die ${die} is already assigned to ${assignedToAttr}. Blocking selection.`);
                          alert(`This die type (${die.toUpperCase()}) is already assigned to ${assignedToAttr.charAt(0).toUpperCase() + assignedToAttr.slice(1)}`);
                          return;
                      }
      
                      if (currentAssignmentForAttribute) {
                          console.log(`diceManager.processSelection: Clearing previous assignment (${currentAssignmentForAttribute}) for attribute ${attribute}.`);
                          this.clearAssignment(attribute, currentAssignmentForAttribute);
                      }
      
                      console.log(`diceManager.processSelection: Assigning ${die} to ${attribute}.`);
                      this.selectedDice.set(die, attribute);
                      this.assignedAttributes.set(attribute, die);
                      button.classList.add('selected');
                  }
      
                  this.updateDieStates();
                  this.updateState();
                  this.wizard.updateNav();
              },
      
              clearAssignment(attribute, die) {
                  console.log(`diceManager.clearAssignment: Clearing assignment of die ${die} from attribute ${attribute}.`);
                  this.selectedDice.delete(die);
                  this.assignedAttributes.delete(attribute);
                  const btn = this.tableElement.querySelector(`tr[data-attribute="${attribute}"] button[data-die="${die}"]`); // Use this.tableElement
                  if (btn) btn.classList.remove('selected');
              },
      
              updateDieStates() {
                  console.log('diceManager.updateDieStates: Updating disabled states of die buttons.');
                  this.tableElement.querySelectorAll('button[data-die]').forEach(button => { // Use this.tableElement
                      const die = button.dataset.die;
                      const rowAttribute = button.closest('tr').dataset.attribute;
                      const currentAssignment = this.assignedAttributes.get(rowAttribute);
                      
                      const shouldBeDisabled = !(currentAssignment === die || !this.selectedDice.has(die));
                      button.disabled = shouldBeDisabled;
                      button.textContent = die.toUpperCase();
                  });
              },
      
              updateState() {
                  this.wizard.state.attributes = Object.fromEntries(this.assignedAttributes);
                  console.log('diceManager.updateState: Wizard state attributes updated:', this.wizard.state.attributes);
              }
          };
          
          diceManager.init();
          break;
        
      case 'info':
        document.getElementById('characterName').addEventListener('input', (e) => {
          this.state.info.name = e.target.value;
          console.log(`CharacterWizard.setupPageEvents (info): Character name updated: "${this.state.info.name}"`);
          this.updateNav(); 
        });
        document.getElementById('characterBio').addEventListener('input', (e) => {
          this.state.info.bio = e.target.value;
          console.log(`CharacterWizard.setupPageEvents (info): Character bio updated: "${this.state.info.bio}"`);
          this.updateNav(); 
        });
        break;
    }
  }

  // Informer updates (Sub-change 1.4: Refactor Destiny Information Display in Informer)
  updateInformer(page) {
    const informer = document.getElementById('informerPanel');
    if (!informer) {
      console.warn('CharacterWizard.updateInformer: Informer panel not found.');
      return;
    }
    console.log(`CharacterWizard.updateInformer: Updating informer for page: ${page}`);

    switch(page) {
      case 'module':
        informer.innerHTML = this.state.module 
          ? `<div class="module-info">
               <h3>${this.moduleSystem[this.state.module].name}</h3>
               <p>${this.moduleSystem[this.state.module].descriptions.module}</p>
               <h4>Available Destinies:</h4>
               <ul>
                 ${(this.moduleSystem[this.state.module]?.destinies || []).map(d => `<li>${this.destinyData[d]?.displayName || d}</li>`).join('')}
               </ul>
             </div>`
          : '<div class="module-info"><p>Select a module to begin your journey</p></div>';
          console.log(`CharacterWizard.updateInformer (module): Informer content updated for module: ${this.state.module || 'None selected'}`);
        break;

        case 'destiny':
          if (!this.state.destiny) {
            informer.innerHTML = '<p>Select your destiny</p>';
            return;
          }
          
          const destiny = this.destinyData[this.state.destiny];
          // Find the destiny-specific selected flaw from the flaws array
          const selectedDestinyFlaw = this.state.flaws.find(f => f.destiny === true); 
          const selectedFlawDetails = selectedDestinyFlaw ? this.flawData[selectedDestinyFlaw.id] : null;

          informer.innerHTML = `
            <div class="destiny-info">
              <h3>${destiny.displayName}</h3>
              <p>${destiny.description}</p>
              <div class="stats">
                <div><strong>Health:</strong> ${destiny.health.title} (${destiny.health.value})</div>
              </div>
              <div class="tags">${this.renderTags(destiny.tags)}</div>
              ${selectedFlawDetails ? `
                <div class="flaw-info">
                  <h4>Selected Flaw: ${selectedFlawDetails.name}</h4>
                  <p>${selectedFlawDetails.description}</p>
                  <p>Effect: ${selectedFlawDetails.effect}</p>
                </div>
              ` : '<p>Select a flaw for your character from the options on the left.</p>'}
            </div>
          `;
          break;

      case 'attributes':
        informer.innerHTML = `
          <div class="attributes-info">
            <h3>${this.moduleSystem[this.state.module]?.name || 'Module'} Attributes</h3>
            <p>Assign dice to your attributes:</p>
            <ul>
              ${this.state.module 
                ? this.moduleSystem[this.state.module].attributes.map(a => 
                    `<li><strong>${a}</strong>: ${this.state.attributes[a.toLowerCase()] || 'Unassigned'}</li>`
                  ).join('')
                : 'Select a module first'}
            </ul>
          </div>`;
          console.log(`CharacterWizard.updateInformer (attributes): Informer content updated. Current assignments:`, this.state.attributes);
        break;

      case 'info':
        // Keep existing info informer - assuming it's static HTML content
        console.log('CharacterWizard.updateInformer (info): Informer content for info page is static.');
        break;
    }
  }

  // === NEW METHODS FOR ABILITIES SYSTEM ===
  // Sub-change 1.3: Integrate flaws with selector code (UI & State)
  renderDestinyDetails() {
      if (!this.state.destiny) {
          const existing = document.querySelector('.destiny-details');
          if (existing) existing.remove(); // Remove if no destiny selected
          return;
      }
      const destiny = this.destinyData[this.state.destiny];
      
      const container = document.createElement('div');
      container.className = 'destiny-details';
      // Check if the current flaw in the loop is the 'destiny' selected one
      const isFlawSelected = (flawId) => this.state.flaws.some(f => f.id === flawId && f.destiny === true);

      container.innerHTML = `
        <div class="flaw-selection">
          <h4>Choose your Flaw:</h4>
          <div class="flaw-options-container">
            ${destiny.flaws.map(flawId => {
              const flaw = this.flawData[flawId]; // Access flaw data directly by ID (key)
              if (!flaw) {
                  console.warn(`Missing flaw data for ID: ${flawId}`);
                  return '';
              }
              return `
                <div class="flaw-option ${isFlawSelected(flawId) ? 'selected' : ''}" 
                     data-flaw-id="${flawId}">
                  <span class="flaw-name">${flaw.name}</span>
                  <span class="flaw-description">${flaw.description}</span>
                </div>`;
            }).join('')}
          </div>
        </div>
      `;

      let existing = document.querySelector('.destiny-details');
      if (existing) {
          existing.replaceWith(container);
      } else {
          // Find the location where destiny-details should be appended.
          // This is usually below the destiny role selection.
          const roleSelect = document.getElementById('characterRole');
          if (roleSelect) {
              roleSelect.parentNode.insertBefore(container, roleSelect.nextSibling);
          } else {
              document.querySelector('#selectorPanel').appendChild(container); // Fallback
          }
      }
      // No specific event listener attachment here for flaws, as it's handled by delegated listener in setupPageEvents
  }

  renderTags(tags) {
      return tags.map(tag => `
        <span class="tag" style="background: ${tag.color}">
          ${tag.icon} ${tag.display}
        </span>
      `).join('');
  }

  renderAbilitiesSection() {
      if (!this.state.destiny) {
          const existing = document.querySelector('.abilities-section');
          if (existing) existing.remove();
          return;
      }

      const destiny = this.destinyData[this.state.destiny];
      
      const container = document.createElement('div');
      container.className = 'abilities-section';
      container.innerHTML = '<h4>Abilities</h4>';

      const abilitiesByTier = {};
      destiny.levelUnlocks.forEach(unlock => {
        if (!abilitiesByTier[unlock.level]) {
          abilitiesByTier[unlock.level] = [];
        }
        abilitiesByTier[unlock.level].push(unlock.ability);
      });

      Object.entries(abilitiesByTier).forEach(([tier, abilityIds]) => {
        container.innerHTML += `<h5 class="tier-header">Tier ${tier} (Choose 1)</h5>`;
        
        abilityIds.forEach(abilityId => { // abilityId is the correct string ID, e.g., 'spellcaster'
          const ability = this.abilityData[abilityId]; // This is the definition object
          if (!ability) {
            console.warn(`Missing ability: ${abilityId}`);
            return;
          }

          const abilityState = this.state.abilities.find(a => a.id === abilityId);
          const isSelected = !!abilityState; // Check if the ability itself is selected

          container.innerHTML += `
            <div class="ability ${isSelected ? 'selected' : ''}" data-ability-id="${abilityId}">
              <div class="ability-header">
                <label>
                  <input type="radio" name="tier-${tier}" 
                         ${isSelected ? 'checked' : ''}
                         data-tier="${tier}" 
                         data-ability="${abilityId}">
                  <span class="ability-name">${ability.name}</span>
                </label>
                <div class="ability-types">
                  <span class="type-tag">${this.getTypeIcon(ability.type)} ${ability.type}</span>
                </div>
              </div>
              <div class="ability-description">${this.renderAbilityDescription(ability)}</div>
              ${ability.options ? this.renderAbilityOptions(ability, abilityId) : ''}
            </div>
          `;
        });
      });

      const existing = document.querySelector('.abilities-section');
      existing ? existing.replaceWith(container) : document.querySelector('#selectorPanel').appendChild(container);
      
      container.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          this.handleTierSelection(
            e.target.dataset.tier, 
            e.target.dataset.ability
          );
        });
      });

      container.querySelectorAll('.ability-option input').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          this.handleAbilityOptionSelection(
            e.target.dataset.ability, // This will now be the correct abilityId
            e.target.dataset.option,
            e.target.checked,
            e.target // Pass the checkbox element itself
          );
        });
      });

      // Ensure all ability option states are refreshed after rendering
      this.refreshAbilityOptionStates(); 
  }

  getTypeIcon(type) {
      const icons = {
        'Combat': '⚔️',
        'Spell': '🔮',
        'Support': '🛡️',
        'Social': '💬',
        'Holy': '✨',
        'Healing': '❤️',
        'Performance': '🎤',
        'Utility': '🛠️',
        'Passive': '⭐',
        'Active': '⚡'
      };
      return icons[type] || '✨';
  }

  renderAbilityDescription(ability) {
      let desc = ability.description;
      // Replace template variables like ${attribute} or ${cost.gold} etc.
      desc = desc.replace(/\${([^}]+)}/g, (match, p1) => {
          let value;
          try {
              // Attempt to resolve nested properties (e.g., 'cost.gold')
              const path = p1.split('.');
              let current = ability;
              for (let i = 0; i < path.length; i++) {
                  if (current === null || current === undefined) {
                      current = undefined; // Path does not exist
                      break;
                  }
                  current = current[path[i]];
              }
              value = current;
  
              // If the value is still undefined, try direct property (e.g., 'bonus')
              if (value === undefined && typeof ability[p1] !== 'undefined') {
                  value = ability[p1];
              }
          } catch (e) {
              console.error(`Error resolving template variable ${p1}:`, e);
              value = undefined;
          }
  
          if (value !== undefined) {
              // --- NEW LOGIC TO APPEND UNITS ---
              if (p1 === 'cost.gold' && typeof value === 'number') {
                  return `${value} gold`; // Appends " gold" if it's a numeric cost.gold
              }
              // --- END NEW LOGIC ---
  
              // If value is a string (e.g., 'INT', '5 + STR'), return it as is.
              // Otherwise, return the interpolated value.
              return value;
          }
          return match; // Return original placeholder if value not found
      });
      return desc;
  }

  renderAbilityOptions(ability, abilityId) {
      if (!ability.options) return '';
      
      const abilityState = this.state.abilities.find(a => a.id === abilityId);
      const currentSelections = abilityState ? abilityState.selections : [];
      const isParentAbilityCurrentlySelected = !!abilityState; // Check if the parent ability is in the state

      return `
      <div class="ability-options">
          <p>Choose ${ability.maxChoices || 'any'}:</p>
          ${ability.options.map(option => `
          <label class="ability-option">
              <input type="checkbox"
                  ${currentSelections.some(s => s.id === option.id) ? 'checked' : ''}
                  data-ability="${abilityId}"
                  data-option="${option.id}"
                  ${!isParentAbilityCurrentlySelected ? 'disabled' : ''} // Initially disable if parent is not selected
              >
              ${option.name}: ${this.renderAbilityDescription(option)}
          </label>
          `).join('')}
      </div>
      `;
  }

  handleTierSelection(tier, abilityId) {
      console.log(`CharacterWizard.handleTierSelection: Handling selection for Tier ${tier}, Ability: ${abilityId}`);
      // First, create a new array excluding any existing ability from this specific tier.
      // This ensures only one ability per tier is active in the state.
      this.state.abilities = this.state.abilities.filter(ability => {
          return ability.tier !== parseInt(tier); // Keep abilities that are NOT from the current tier
      });

      // Now, add the newly selected ability for this tier.
      this.state.abilities.push({
          id: abilityId,
          tier: parseInt(tier),
          selections: [] // Reset selections for the newly chosen ability in this tier
      });
      console.log(`CharacterWizard.handleTierSelection: State after update:`, this.state.abilities);
      
      // After updating state, refresh all ability option states globally to reflect changes
      this.refreshAbilityOptionStates(); 

      this.updateNav();
  }
  
  // Modified handleAbilityOptionSelection function
  handleAbilityOptionSelection(abilityId, optionId, isSelected, checkboxElement) {
      const abilityState = this.state.abilities.find(a => a.id === abilityId);
      if (!abilityState) {
          console.warn(`CharacterWizard.handleAbilityOptionSelection: Parent ability '${abilityId}' not found in state.`);
          // If parent ability is not selected, this option should ideally be disabled anyway.
          // As a fallback for direct interaction, ensure it's unchecked if clicked
          checkboxElement.checked = false;
          this.refreshAbilityOptionStates(); // Re-sync UI
          return;
      }
  
      const abilityDef = this.abilityData[abilityId];
      
      if (isSelected) {
          // Check maxChoices before adding
          if (abilityDef.maxChoices !== undefined && abilityDef.maxChoices !== null && abilityState.selections.length >= abilityDef.maxChoices) {
              checkboxElement.checked = false; // Revert checkbox state
              alert(`You can only select up to ${abilityDef.maxChoices} option(s) for ${abilityDef.name}.`);
              this.refreshAbilityOptionStates(); // Ensure UI is consistent after alert
              return; 
          }
          // Add option if not already present
          if (!abilityState.selections.some(s => s.id === optionId)) {
              abilityState.selections.push({ id: optionId });
          }
      } else {
          // Remove option
          abilityState.selections = abilityState.selections.filter(s => s.id !== optionId);
      }
  
      // After state update, refresh the disabled status of ALL checkboxes globally
      this.refreshAbilityOptionStates(); 
      this.updateInformer('destiny'); 
  }

  // validateDestinyCompletion to check for one 'destiny' flaw
  validateDestinyCompletion() {
      if (!this.state.destiny) return false;
      const destiny = this.destinyData[this.state.destiny];
      
      // Check if exactly one flaw with destiny: true is selected
      const selectedDestinyFlaws = this.state.flaws.filter(f => f.destiny === true);
      if (selectedDestinyFlaws.length !== 1) {
        console.log("Validation: Exactly one destiny flaw must be selected. Current count:", selectedDestinyFlaws.length);
        return false;
      }

      // Check at least one ability per tier is selected
      const tiers = [...new Set(destiny.levelUnlocks.map(u => u.level))];
      const tierComplete = tiers.every(tier => {
        return this.state.abilities.some(a => 
          destiny.levelUnlocks.some(u => u.level == tier && u.ability === a.id)
        );
      });
      console.log("Validation: All tiers completed:", tierComplete);

      // Check ability option requirements
      const optionsComplete = this.state.abilities.every(abilityState => {
        const abilityDef = this.abilityData[abilityState.id];
        if (!abilityDef.options) return true; // No options to choose from
        if (abilityDef.maxChoices === undefined || abilityDef.maxChoices === null) return true; // No explicit maxChoices, so any number is fine
        
        return abilityState.selections.length === abilityDef.maxChoices;
      });
      console.log("Validation: All ability options complete:", optionsComplete);

      return tierComplete && optionsComplete && selectedDestinyFlaws.length === 1;
  }

  // New method to check if a page is truly completed
  isPageCompleted(page) {
      let completed = false;
      switch(page) {
          case 'module':
              completed = !!this.state.module;
              break;
          case 'destiny':
              return this.validateDestinyCompletion();
          case 'attributes':
              if (!this.state.module) {
                  completed = false;
              } else {
                  const requiredAttrs = this.moduleSystem[this.state.module].attributes;
                  // A page is completed if all required attributes have a die assigned
                  completed = requiredAttrs.every(attr => 
                      this.state.attributes[attr.toLowerCase()]
                  );
              }
              break;
          case 'info':
              completed = !!this.state.info.name?.trim(); 
              break;
          default:
              completed = false;
      }
      console.log(`CharacterWizard.isPageCompleted: Page '${page}' is completed: ${completed}. State:`, JSON.parse(JSON.stringify(this.state)));
      return completed;
  }

  // Navigation methods
  goToPage(page) {
    const pageIndex = this.pages.indexOf(page);
    if (pageIndex !== -1) { 
      console.log(`CharacterWizard.goToPage: Navigating to page: ${page}`);
      this.loadPage(page);
    } else {
      console.warn(`CharacterWizard.goToPage: Attempted to go to unknown page: ${page}`);
    }
  }

  nextPage() {
    if (this.currentPage < this.pages.length - 1) {
      const nextPageName = this.pages[this.currentPage + 1];
      console.log(`CharacterWizard.nextPage: Moving to next page: ${nextPageName}`);
      this.loadPage(nextPageName);
    } else {
      console.log('CharacterWizard.nextPage: End of wizard, attempting to finish.');
      this.finishWizard();
    }
  }

  prevPage() {
    if (this.currentPage > 0) {
      const prevPageName = this.pages[this.currentPage - 1];
      console.log(`CharacterWizard.prevPage: Moving to previous page: ${prevPageName}`);
      this.loadPage(prevPageName);
    } else {
      console.log('CharacterWizard.prevPage: Already on the first page, cannot go back further.');
    }
  }

  // Validation system (kept for final submission, but not enforced during navigation)
  validateCurrentPage() {
    // This method is now only called by finishWizard() to provide a final summary of missing fields.
    // It no longer prevents navigation.
    console.log('CharacterWizard.validateCurrentPage: This method is deprecated for navigation control, only for final validation summary.');
    return true;
  }

  validateData() {
      // Loop through all module IDs defined in the moduleSystem (which now comes from module_list.json)
      Object.keys(this.moduleSystem).forEach(moduleId => {
        // Get the destinies associated with this module directly from its module.json
        const destiniesForModule = this.moduleSystem[moduleId].destinies || [];
        
        destiniesForModule.forEach(destinyId => {
          if (!this.destinyData[destinyId]) {
            console.error(`Missing destiny data for: ${destinyId} (from module ${moduleId})`);
          } else {
            // Validate flaws
            this.destinyData[destinyId].flaws.forEach(flawId => {
              if (!this.flawData[flawId]) {
                console.error(`Missing flaw data: ${flawId} for destiny ${destinyId}`);
              }
            });

            this.destinyData[destinyId].levelUnlocks.forEach(unlock => {
              if (!this.abilityData[unlock.ability]) {
                console.error(`Missing ability data: ${unlock.ability} for destiny ${destinyId}`);
              }
            });
          }
        });
      });
  }

  showPageError() {
    const errorMap = {
      module: { 
        element: '.module-options', 
        message: 'Please select a module to continue' 
      },
      destiny: { 
        element: '#characterRole', 
        message: 'Please select a destiny and a flaw for your character, and ensure all ability options are selected.' 
      },
      attributes: { 
        element: '.dice-assignment-table', 
        message: 'Please assign dice to all attributes' 
      },
      info: { 
        element: '#characterName', 
        message: 'Please enter your character\'s name' 
      }
    };

    const currentPageName = this.pages[this.currentPage];
    const { element, message } = errorMap[currentPageName];
    const el = document.querySelector(element);
    if (el) {
      el.classList.add('error-highlight');
      setTimeout(() => {
          el.classList.remove('error-highlight');
          console.log(`CharacterWizard.showPageError: Removed error highlight from ${element}`);
      }, 2000);
    }
    console.error(`CharacterWizard.showPageError: Displaying error for page '${currentPageName}': ${message}`);
    alert(message);
  }

  // Final validation and completion
  validateAllPages() {
    console.log('CharacterWizard.validateAllPages: Running final validation across all pages.');
    const errors = [];
    
    if (!this.state.module) {
      errors.push("• Please select a Module");
      console.log('  - Validation error: Module not selected.');
    } else {
      if (!this.state.destiny) {
        errors.push("• Please select a Destiny");
        console.log('  - Validation error: Destiny not selected.');
      } else {
          // Validate exactly one 'destiny' flaw
          const selectedDestinyFlaws = this.state.flaws.filter(f => f.destiny === true);
          if (selectedDestinyFlaws.length !== 1) {
              errors.push("• Please select exactly one Flaw for your character from the Destiny page.");
              console.log('  - Validation error: Destiny flaw not selected or multiple selected.');
          }

          // Validate ability selections and their options
          const destiny = this.destinyData[this.state.destiny];
          const tiers = [...new Set(destiny.levelUnlocks.map(u => u.level))];
          tiers.forEach(tier => {
              const tierAbilities = destiny.levelUnlocks.filter(u => u.level === tier).map(u => u.ability);
              const selectedAbilityInTier = this.state.abilities.find(a => tierAbilities.includes(a.id));
              if (!selectedAbilityInTier) {
                  errors.push(`• Please select an Ability for Tier ${tier}.`);
                  console.log(`  - Validation error: No ability selected for Tier ${tier}.`);
              } else {
                  const abilityDef = this.abilityData[selectedAbilityInTier.id];
                  if (abilityDef.options && abilityDef.maxChoices !== undefined && abilityDef.maxChoices !== null) {
                      if (selectedAbilityInTier.selections.length !== abilityDef.maxChoices) {
                          errors.push(`• Please select exactly ${abilityDef.maxChoices} option(s) for the ability "${abilityDef.name}".`);
                          console.log(`  - Validation error: Incorrect number of options for ability "${abilityDef.name}".`);
                      }
                  }
              }
          });
      }
      
      const requiredAttrs = this.moduleSystem[this.state.module].attributes;
      const missingAttrs = requiredAttrs.filter(attr => 
        !this.state.attributes[attr.toLowerCase()]
      );
      
      if (missingAttrs.length > 0) {
        errors.push(`• Assign dice to: ${missingAttrs.join(', ')}`);
        console.log('  - Validation error: Missing attribute assignments:', missingAttrs);
      }
    }
    
    if (!this.state.info.name?.trim()) {
      errors.push("• Please enter a Character Name");
      console.log('  - Validation error: Character name is empty.');
    }
    
    return {
      isValid: errors.length === 0,
      message: errors.join("\n")
    };
  }

  finishWizard() {
    console.log('CharacterWizard.finishWizard: Attempting to finish wizard.');
    const validation = this.validateAllPages();
    
    if (!validation.isValid) {
      console.warn('CharacterWizard.finishWizard: Validation failed. Showing errors.');
      alert("Please complete the following:\n\n" + validation.message);
      return;
    }

    const character = {
      module: this.state.module,
      destiny: this.state.destiny,
      flaws: this.state.flaws, // Store the entire flaws array
      attributes: this.state.attributes,
      health: { current: this.destinyData[this.state.destiny].health.value,
          max: this.destinyData[this.state.destiny].health.value,
          temporary: 0 },
      inventory: [],
      abilities: this.state.abilities, 
      createdAt: new Date().toISOString(),
      info: this.state.info
    };
    console.log('CharacterWizard.finishWizard: Character object prepared for saving:', character);

    this.db.saveCharacter(character)
      .then(() => {
        console.log('CharacterWizard.finishWizard: Character saved successfully. Redirecting to character-selector.html');
        window.location.href = 'character-selector.html';
      })
      .catch(err => {
        console.error('CharacterWizard.finishWizard: Failed to save character:', err);
        alert(`Failed to save character: ${err.message}`);
      });
  }

  // State restoration for elements outside diceManager's direct control
  restoreState(page) {
      console.log(`CharacterWizard.restoreState: Restoring state for page: ${page}`);
      switch(page) {
          case 'module':
              if (this.state.module) {
                  const btn = document.querySelector(`.module-option[data-value="${this.state.module}"]`);
                  if (btn) {
                      btn.classList.add('selected');
                      console.log(`CharacterWizard.restoreState (module): Module option "${this.state.module}" re-selected.`);
                  }
              }
              break;
              
          case 'destiny':
              const roleSelect = document.getElementById('characterRole');
              if (this.state.destiny) {
                  if (roleSelect) {
                      roleSelect.value = this.state.destiny;
                      console.log(`CharacterWizard.restoreState (destiny): Destiny dropdown set to "${this.state.destiny}".`);
                  }
                  this.renderDestinyDetails(); // Render the flaw options first
                  this.renderAbilitiesSection(); 
                  console.log(`CharacterWizard.restoreState (destiny): Re-rendered destiny details and abilities section to reflect stored abilities selections.`);

                  // Restore selected flaw div based on the 'destiny' flag in the flaws array
                  const selectedDestinyFlaw = this.state.flaws.find(f => f.destiny === true);
                  if (selectedDestinyFlaw) {
                      const flawDiv = document.querySelector(`.flaw-option[data-flaw-id="${selectedDestinyFlaw.id}"]`);
                      if (flawDiv) {
                          flawDiv.classList.add('selected');
                          console.log(`CharacterWizard.restoreState (destiny): Flaw option "${selectedDestinyFlaw.id}" re-selected.`);
                      }
                  }
                  this.refreshAbilityOptionStates(); 
              } else {
                  if (roleSelect) {
                      roleSelect.value = ""; 
                  }
                  const destinyDetailsContainer = document.querySelector('.destiny-details');
                  if (destinyDetailsContainer) destinyDetailsContainer.remove(); 
                  
                  const abilitiesSectionContainer = document.querySelector('.abilities-section');
                  if (abilitiesSectionContainer) abilitiesSectionContainer.remove(); 
                  console.log(`CharacterWizard.restoreState (destiny): No destiny in state. Cleared destiny details and abilities section.`);
                  this.refreshAbilityOptionStates(); 
              }
              break;
              
          case 'attributes':
              // diceManager.init() now handles full restoration for attributes
              console.log('CharacterWizard.restoreState (attributes): DiceManager handles attribute state restoration.');
              break; 
              
          case 'info':
              const charNameInput = document.getElementById('characterName');
              const charBioInput = document.getElementById('characterBio');
              if (charNameInput) {
                  charNameInput.value = this.state.info.name || '';
                  console.log(`CharacterWizard.restoreState (info): Character name input set to "${this.state.info.name}".`);
              }
              if (charBioInput) {
                  charBioInput.value = this.state.info.bio || '';
                  console.log(`CharacterWizard.restoreState (info): Character bio input set to "${this.state.info.bio}".`);
              }
              break;
      }
  }

  refreshAbilityOptionStates() {
      console.log('CharacterWizard.refreshAbilityOptionStates: Updating all ability option disabled states. Current state.abilities:', this.state.abilities);
      // CHANGE THIS LINE: Select .ability instead of .ability-container
      document.querySelectorAll('.ability').forEach(abilityContainer => {
          const abilityId = abilityContainer.dataset.abilityId;
          const abilityData = this.abilityData[abilityId];
          
          // Find if this ability is selected in the wizard's state
          const abilityState = this.state.abilities.find(a => a.id === abilityId);
          const isParentAbilityCurrentlySelected = !!abilityState; // True if abilityId is in state.abilities
          console.log(`  Ability Container: ${abilityId}, isParentAbilityCurrentlySelected: ${isParentAbilityCurrentlySelected}`);
  
          const optionsContainer = abilityContainer.querySelector('.ability-options');
          // Proceed only if options container exists and ability data defines options
          if (optionsContainer && abilityData && abilityData.options) {
              optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(optionCheckbox => {
                  const optionId = optionCheckbox.dataset.option;
                  // Check if this specific option is selected in the state
                  const isOptionSelected = abilityState ? abilityState.selections.some(s => s.id === optionId) : false;
  
                  let shouldBeDisabled = false;
  
                  if (!isParentAbilityCurrentlySelected) {
                      shouldBeDisabled = true;
                      // If the parent ability is NOT selected, ensure the option is unchecked and disabled
                      if (optionCheckbox.checked) {
                          optionCheckbox.checked = false;
                          // Also clean up the state if for some reason this option was still selected
                          if (abilityState) {
                              abilityState.selections = abilityState.selections.filter(s => s.id !== optionId);
                          }
                          console.log(`    Option '${optionId}': Unchecked and disabled because parent not selected.`);
                      } else {
                          console.log(`    Option '${optionId}': Disabled because parent not selected.`);
                      }
                  } else {
                      // Parent ability IS selected, now apply maxChoices logic
                      const currentSelectionsCount = abilityState.selections.length;
                      const maxChoices = abilityData.maxChoices;
  
                      // If maxChoices is defined and reached, disable options that are NOT currently selected
                      if (maxChoices !== undefined && maxChoices !== null && currentSelectionsCount >= maxChoices && !isOptionSelected) {
                          shouldBeDisabled = true;
                          console.log(`    Option '${optionId}': Disabling because max choices (${maxChoices}) reached and not selected.`);
                      } else {
                          // This is the case where the option should be enabled
                          console.log(`    Option '${optionId}': Enabling (parent selected, max choices not reached or is selected).`);
                      }
                  }
                  optionCheckbox.disabled = shouldBeDisabled; // Apply the final disabled state
              });
          }
      });
      this.updateNav();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof db === 'undefined') {
      console.error("CharacterWizard: Database module 'db' not loaded! Ensure db.js is included before wizard.js.");
      return;
  }

  console.log('CharacterWizard: DOMContentLoaded event fired. Loading data...');

  // Global data stores
  const moduleSystemData = {};
  const destinyData = {};
  let flawData = null;
  let abilityData = null;
  let moduleList = null; 

  try {
      // 1. Load abilities.json
      console.log('CharacterWizard: Fetching abilities.json...');
      const abilityResponse = await fetch('data/abilities.json');
      if (!abilityResponse.ok) throw new Error(`HTTP error! status: ${abilityResponse.status}`);
      abilityData = await abilityResponse.json();
      console.log('CharacterWizard: abilities.json loaded successfully.');
      console.debug('CharacterWizard: abilities.json data:', abilityData);

      // 2. Load flaws.json
      console.log('CharacterWizard: Fetching flaws.json...');
      const flawResponse = await fetch('data/flaws.json');
      if (!flawResponse.ok) throw new Error(`HTTP error! status: ${flawResponse.status}`);
      flawData = await flawResponse.json();
      console.log('CharacterWizard: flaws.json loaded successfully.');
      console.debug('CharacterWizard: flaws.json data:', flawData);

      // 3. Load module_list.json
      console.log('CharacterWizard: Fetching data/module_list.json...');
      const moduleListResponse = await fetch('data/module_list.json');
      if (!moduleListResponse.ok) throw new Error(`HTTP error! status: ${moduleListResponse.status}`);
      moduleList = await moduleListResponse.json();
      console.log('CharacterWizard: module_list.json loaded successfully.');
      console.debug('CharacterWizard: moduleList:', moduleList);

      // 4. Discover and Load all Module and Destiny data dynamically
      
      console.log('CharacterWizard: Fetching all module and destiny data...');
      const allFetches = [];

      for (const moduleId of moduleList) {
          allFetches.push(
              (async () => {
                  // Fetch module.json
                  const moduleResponse = await fetch(`data/modules/${moduleId}/module.json`);
                  if (!moduleResponse.ok) throw new Error(`HTTP error! status: ${moduleResponse.status} for module ${moduleId}`);
                  const moduleJson = await moduleResponse.json();
                  moduleSystemData[moduleId] = moduleJson;
                  console.log(`CharacterWizard: Loaded module: ${moduleId}`);

                  // Fetch associated destinies based on the 'destinies' array in module.json
                  const destiniesInModule = moduleJson.destinies || [];
                  const destinyFetches = destiniesInModule.map(async destinyId => {
                      const destinyResponse = await fetch(`data/modules/${moduleId}/destinies/${destinyId}.json`);
                      if (!destinyResponse.ok) throw new Error(`HTTP error! status: ${destinyResponse.status} for destiny ${destinyId} in module ${moduleId}`);
                      const destinyJson = await destinyResponse.json();
                      destinyData[destinyId] = destinyJson;
                      console.log(`CharacterWizard: Loaded destiny: ${destinyId} for module ${moduleId}`);
                  });
                  await Promise.all(destinyFetches);
              })()
          );
      }
      await Promise.all(allFetches);
      console.log('CharacterWizard: All module and destiny data loaded successfully.');
      console.debug('CharacterWizard: moduleSystemData:', moduleSystemData);
      console.debug('CharacterWizard: destinyData:', destinyData);

      // Initialize CharacterWizard with all loaded data
      console.log('CharacterWizard: All data loaded. Initializing CharacterWizard.');
      new CharacterWizard(moduleSystemData, flawData, destinyData, abilityData, db);

  } catch (error) {
      console.error('CharacterWizard: Error loading data:', error);
      alert('Failed to load character data. Please check the console for details.');
  }
});