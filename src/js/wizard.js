class CharacterWizard {
    constructor(db) {
      this.currentPage = 0;
      this.pages = ['module', 'destiny', 'attributes', 'info'];
      this.state = {
        module: null,
        moduleChanged: false, // This flag is still used for resetting destiny/attributes when module *truly* changes
        destiny: null,
        attributes: {},
        info: { name: '', bio: '' }
      };
      this.db = db;
      this.navItems = document.querySelectorAll('.nav-item');
      
      console.log('CharacterWizard: Initializing wizard.');
      this.init();
    }
  
    // Module system data
    MODULE_SYSTEM = {
      'high-fantasy': {
        name: 'High Fantasy',
        destinies: ['Wizard', 'Knight', 'Rogue', 'Cleric'],
        attributes: ['Strength', 'Dexterity', 'Constitution', 'Wisdom', 'Intelligence', 'Charisma'],
        descriptions: {
          module: 'Classic medieval fantasy adventuring with swords, sorcery, and epic quests.',
          destinies: {
            wizard: 'Arcane spellcaster who manipulates magical energies through rigorous study.',
            knight: 'Noble warrior sworn to protect the realm with martial prowess.',
            rogue: 'Stealthy opportunist who thrives in shadows and urban environments.',
            cleric: 'Divine agent who channels holy power to heal and smite.'
          }
        }
      },
      'crescendo': {
        name: 'Crescendo',
        destinies: ['Pianist', 'Guitarist', 'Singer', 'Drummer'],
        attributes: ['Passion', 'Rhythm', 'Stamina', 'Fame', 'Style', 'Harmony'],
        descriptions: {
          module: 'Musical storytelling game about fame, artistry, and creative struggles.',
          destinies: {
            pianist: 'Keyboard virtuoso with technical precision and emotional depth.',
            guitarist: 'String instrument master who commands the stage with riffs and solos.',
            singer: 'Vocal artist who connects with audiences through raw emotion.',
            drummer: 'Rhythmic backbone who drives the band\'s energy and tempo.'
          }
        }
      }
    };
  
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
      this.navItems.forEach((item, index) => {
        const page = this.pages[index];
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
                  console.log(`CharacterWizard.setupPageEvents (module): Module changed from ${oldModule} to ${this.state.module}. Resetting destiny and attributes.`);
                  this.state.destiny = null; // Reset dependent choices
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
          const roleSelect = document.getElementById('characterRole');
          roleSelect.innerHTML = '<option value="">Select a Role</option>';
          console.log(`CharacterWizard.setupPageEvents (destiny): Populating destiny options for module: ${this.state.module}`);
          
          if (this.state.module) {
            this.MODULE_SYSTEM[this.state.module].destinies.forEach(destiny => {
              const option = document.createElement('option');
              option.value = destiny.toLowerCase();
              option.textContent = destiny;
              roleSelect.appendChild(option);
            });
            
            if (this.state.destiny) {
              roleSelect.value = this.state.destiny;
              console.log(`CharacterWizard.setupPageEvents (destiny): Restored destiny selection: ${this.state.destiny}`);
            }
          }
          
          roleSelect.addEventListener('change', (e) => {
            this.state.destiny = e.target.value;
            console.log(`CharacterWizard.setupPageEvents (destiny): Destiny selected: ${this.state.destiny}`);
            this.updateInformer(page);
            this.updateNav();
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
                    this.MODULE_SYSTEM[this.state.module].attributes.forEach(attr => {
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
  
    // Informer updates
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
                 <h3>${this.MODULE_SYSTEM[this.state.module].name}</h3>
                 <p>${this.MODULE_SYSTEM[this.state.module].descriptions.module}</p>
                 <h4>Available Destinies:</h4>
                 <ul>
                   ${this.MODULE_SYSTEM[this.state.module].destinies.map(d => `<li>${d}</li>`).join('')}
                 </ul>
               </div>`
            : '<div class="module-info"><p>Select a module to begin your journey</p></div>';
            console.log(`CharacterWizard.updateInformer (module): Informer content updated for module: ${this.state.module || 'None selected'}`);
          break;
  
        case 'destiny':
          informer.innerHTML = this.state.destiny
            ? `<div class="destiny-info">
                 <h3>${this.state.destiny.charAt(0).toUpperCase() + this.state.destiny.slice(1)}</h3>
                 <p>${this.MODULE_SYSTEM[this.state.module]?.descriptions.destinies[this.state.destiny] || 'No description available'}</p>
               </div>`
            : '<div class="destiny-info"><p>Select your destiny to see details</p></div>';
            console.log(`CharacterWizard.updateInformer (destiny): Informer content updated for destiny: ${this.state.destiny || 'None selected'}`);
          break;
  
        case 'attributes':
          informer.innerHTML = `
            <div class="attributes-info">
              <h3>${this.MODULE_SYSTEM[this.state.module]?.name || 'Module'} Attributes</h3>
              <p>Assign dice to your attributes:</p>
              <ul>
                ${this.state.module 
                  ? this.MODULE_SYSTEM[this.state.module].attributes.map(a => 
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
  
    // New method to check if a page is truly completed
    isPageCompleted(page) {
        let completed = false;
        switch(page) {
            case 'module':
                completed = !!this.state.module;
                break;
            case 'destiny':
                completed = !!this.state.module && !!this.state.destiny;
                break;
            case 'attributes':
                if (!this.state.module) {
                    completed = false;
                } else {
                    const requiredAttrs = this.MODULE_SYSTEM[this.state.module].attributes;
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
  
    showPageError() {
      const errorMap = {
        module: { 
          element: '.module-options', 
          message: 'Please select a module to continue' 
        },
        destiny: { 
          element: '#characterRole', 
          message: 'Please select a destiny for your character' 
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
        }
        
        const requiredAttrs = this.MODULE_SYSTEM[this.state.module].attributes;
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
        name: this.state.info.name,
        module: this.state.module,
        destiny: this.state.destiny,
        attributes: this.state.attributes,
        bio: this.state.info.bio,
        //TODO: figure this shit out lol
        health: { current: 10, max: 10, temporary: 0 },
        inventory: [],
        abilities: [],
        createdAt: new Date().toISOString()
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
                if (this.state.destiny) {
                    const roleSelect = document.getElementById('characterRole');
                    if (roleSelect) {
                        roleSelect.value = this.state.destiny;
                        console.log(`CharacterWizard.restoreState (destiny): Destiny dropdown set to "${this.state.destiny}".`);
                    }
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
}
  
document.addEventListener('DOMContentLoaded', () => {
    if (typeof db === 'undefined') {
      console.error("CharacterWizard: Database module 'db' not loaded! Ensure db.js is included before wizard.js.");
      return;
    }
    console.log('CharacterWizard: DOMContentLoaded event fired. Initializing CharacterWizard with db.');
    new CharacterWizard(db);
});