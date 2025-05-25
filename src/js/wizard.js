class CharacterWizard {
    constructor(db) {
      this.currentPage = 0;
      this.pages = ['module', 'destiny', 'attributes', 'info'];
      this.state = {
        module: null,
        moduleChanged: false,
        destiny: null,
        attributes: {},
        info: { name: '', bio: '' }
      };
      this.db = db;
      this.navItems = document.querySelectorAll('.nav-item');
      
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
      this.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
          if (item.classList.contains('disabled')) return;
          this.goToPage(item.dataset.page);
        });
      });
  
      document.getElementById('prevBtn').addEventListener('click', () => this.prevPage());
      document.getElementById('nextBtn').addEventListener('click', () => this.nextPage());
  
      this.loadPage(this.pages[0]);
    }
  
    loadPage(page) {
      this.currentPage = this.pages.indexOf(page);
      
      // Load selector content
      fetch(`partials/${page}-selector.html`)
        .then(r => r.text())
        .then(html => {
          document.getElementById('selectorPanel').innerHTML = html;
          // IMPORTANT: setupPageEvents must be called AFTER innerHTML is set to ensure DOM is ready.
          // For 'attributes', setupPageEvents will then call diceManager.init() which handles state restoration.
          this.setupPageEvents(page); 
          // restoreState is now primarily for other pages; attributes is handled by diceManager.init()
          this.restoreState(page); 
        });
  
      // Load informer content
      fetch(`partials/${page}-informer.html`)
        .then(r => r.text())
        .then(html => {
          document.getElementById('informerPanel').innerHTML = html;
          this.updateInformer(page);
        });
  
      this.updateNav();
    }
  
    // Navigation control
    updateNav() {
      this.navItems.forEach((item, index) => {
        const page = this.pages[index];
        const canAccess = this.canAccessPage(index);
        const isCompleted = this.isPageCompleted(page);

        item.classList.toggle('disabled', !canAccess);
        item.classList.toggle('active', index === this.currentPage);
        item.classList.toggle('completed', isCompleted && index < this.currentPage); 
        
        if (!canAccess) {
          item.title = this.getNavigationBlockReason(index);
        } else {
          item.removeAttribute('title');
        }
      });
  
      document.getElementById('prevBtn').disabled = this.currentPage === 0;
      document.getElementById('nextBtn').textContent = 
        this.currentPage === this.pages.length - 1 ? 'Finish' : 'Next';
    }
  
    canAccessPage(index) {
        // Always allow access to the first page (module) and last page (info)
        if (index === 0 || index === this.pages.length - 1) return true;
        
        // For other pages, require module selection
        if (!this.state.module) return false;
        
        return true;
    }
  
    getNavigationBlockReason(index) {
        if (index === this.pages.length - 1) return "Enter basic details anytime"; 
        if (!this.state.module) return "Select a module first";
        return "";
    }
  
    // Page event setup
    setupPageEvents(page) {
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
              this.state.destiny = null; // Reset dependent choices
              this.state.attributes = {};
              this.updateInformer(page);
              this.updateNav(); 
            });
          });
          break;
          
        case 'destiny':
          const roleSelect = document.getElementById('characterRole');
          roleSelect.innerHTML = '<option value="">Select a Role</option>';
          
          if (this.state.module) {
            this.MODULE_SYSTEM[this.state.module].destinies.forEach(destiny => {
              const option = document.createElement('option');
              option.value = destiny.toLowerCase();
              option.textContent = destiny;
              roleSelect.appendChild(option);
            });
            
            if (this.state.destiny) {
              roleSelect.value = this.state.destiny;
            }
          }
          
          roleSelect.addEventListener('change', (e) => {
            this.state.destiny = e.target.value;
            this.updateInformer(page);
            this.updateNav();
          });
          break;
          
        case 'attributes':
            const tableBody = document.querySelector('.dice-assignment-table tbody');
  
            // Only re-render the table if it's empty or module changed
            if (!tableBody.innerHTML || this.state.moduleChanged) {
                tableBody.innerHTML = ''; // Clear existing content
                
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
                        tableBody.appendChild(row);
                    });
                }
                this.state.moduleChanged = false; // Reset the flag
            }
          
            // Dice Manager object
            // Define diceManager as a property of the CharacterWizard instance if it needs to persist
            // across page loads, but for now, re-initializing it each time is fine if handled correctly.
            // Let's ensure it's properly initialized every time the attributes page is loaded.
            const diceManager = {
                wizard: this, // Reference to the CharacterWizard instance
                selectedDice: new Map(), // Maps die (e.g., 'd4') to attribute (e.g., 'strength')
                assignedAttributes: new Map(), // Maps attribute (e.g., 'strength') to die (e.g., 'd4')
                _hasEventListener: false, // Flag to prevent multiple listeners
                
                init() {
                    // 1. Clear internal state
                    this.selectedDice.clear();
                    this.assignedAttributes.clear();

                    // 2. Clear all previous UI selections and disabled states
                    document.querySelectorAll('.dice-assignment-table button').forEach(btn => {
                        btn.classList.remove('selected');
                        btn.disabled = false; // Ensure all are enabled initially
                    });
                    
                    // 3. Restore selections from wizard state and apply 'selected' class
                    Object.entries(this.wizard.state.attributes).forEach(([attr, die]) => {
                        this.selectedDice.set(die, attr);
                        this.assignedAttributes.set(attr, die);
                        const btn = document.querySelector(`tr[data-attribute="${attr}"] button[data-die="${die}"]`);
                        if (btn) {
                            btn.classList.add('selected');
                        }
                    });
                
                    // 4. Attach event listener only once
                    if (!this._hasEventListener) {
                        document.querySelector('.dice-assignment-table').addEventListener('click', (e) => {
                            const button = e.target.closest('button[data-die]');
                            if (!button) return;
                    
                            const row = button.closest('tr');
                            const attribute = row.dataset.attribute;
                            const die = button.dataset.die;
                            
                            this.processSelection(attribute, die, button);
                        });
                        this._hasEventListener = true;
                    }
                
                    // 5. Update disabled states based on the restored assignments
                    this.updateDieStates(); 
                },

                processSelection(attribute, die, button) {
                    const currentAssignmentForAttribute = this.assignedAttributes.get(attribute);
                    
                    if (currentAssignmentForAttribute === die) {
                        // If the same button is clicked, unassign it
                        this.clearAssignment(attribute, die);
                        button.classList.remove('selected');
                    } else {
                        // Check if the selected die type is already assigned to another attribute
                        if (this.selectedDice.has(die)) {
                            alert('This die type is already assigned to another attribute');
                            return;
                        }

                        // Clear any previous assignment for the current attribute
                        if (currentAssignmentForAttribute) {
                            this.clearAssignment(attribute, currentAssignmentForAttribute);
                        }

                        // Assign the new die to the attribute
                        this.selectedDice.set(die, attribute);
                        this.assignedAttributes.set(attribute, die);
                        button.classList.add('selected');
                    }

                    this.updateDieStates();
                    this.updateState();
                    this.wizard.updateNav(); // Re-evaluate navbar completion
                },

                clearAssignment(attribute, die) {
                    this.selectedDice.delete(die);
                    this.assignedAttributes.delete(attribute);
                    // Remove 'selected' class from the button
                    document.querySelector(`tr[data-attribute="${attribute}"] button[data-die="${die}"]`)
                        ?.classList.remove('selected');
                },

                updateDieStates() {
                    // Iterate over ALL die buttons
                    document.querySelectorAll('.dice-assignment-table button[data-die]').forEach(button => {
                        const die = button.dataset.die;
                        const rowAttribute = button.closest('tr').dataset.attribute;
                        
                        // A button should be disabled if:
                        // 1. Its die type is currently assigned to *another* attribute.
                        const isAssignedToAnother = this.selectedDice.has(die) && this.selectedDice.get(die) !== rowAttribute;
                        
                        // Set the disabled state
                        button.disabled = isAssignedToAnother;

                        // Ensure button text content is correct after re-rendering, if needed.
                        // It should already be set by the HTML partial, but this provides a fallback.
                        if (!button.textContent.trim()) {
                            button.textContent = die.toUpperCase();
                        }
                    });
                },

                updateState() {
                    // Update the main wizard state with current attribute assignments
                    this.wizard.state.attributes = Object.fromEntries(this.assignedAttributes);
                }
            };
            diceManager.init(); // Initialize the dice manager logic when attributes page content is ready
            break;
          
        case 'info':
          document.getElementById('characterName').addEventListener('input', (e) => {
            this.state.info.name = e.target.value;
            this.updateNav(); 
          });
          document.getElementById('characterBio').addEventListener('input', (e) => {
            this.state.info.bio = e.target.value;
            this.updateNav(); 
          });
          break;
      }
    }
  
    // Informer updates
    updateInformer(page) {
      const informer = document.getElementById('informerPanel');
      if (!informer) return;
  
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
          break;
  
        case 'destiny':
          informer.innerHTML = this.state.destiny
            ? `<div class="destiny-info">
                 <h3>${this.state.destiny.charAt(0).toUpperCase() + this.state.destiny.slice(1)}</h3>
                 <p>${this.MODULE_SYSTEM[this.state.module]?.descriptions.destinies[this.state.destiny] || 'No description available'}</p>
               </div>`
            : '<div class="destiny-info"><p>Select your destiny to see details</p></div>';
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
          break;
  
        case 'info':
          // Keep existing info informer
          break;
      }
    }
  
    // New method to check if a page is truly completed
    isPageCompleted(page) {
        switch(page) {
            case 'module':
                return !!this.state.module;
            case 'destiny':
                return !!this.state.module && !!this.state.destiny;
            case 'attributes':
                if (!this.state.module) return false;
                const requiredAttrs = this.MODULE_SYSTEM[this.state.module].attributes;
                // A page is completed if all required attributes have a die assigned
                return requiredAttrs.every(attr => 
                    this.state.attributes[attr.toLowerCase()]
                );
            case 'info':
                return !!this.state.info.name?.trim(); 
            default:
                return false;
        }
    }

    // Navigation methods
    goToPage(page) {
      const pageIndex = this.pages.indexOf(page);
      if (pageIndex !== -1) { 
        this.loadPage(page);
      }
    }
  
    nextPage() {
      if (this.currentPage < this.pages.length - 1) {
        this.loadPage(this.pages[this.currentPage + 1]);
      } else {
        this.finishWizard();
      }
    }
  
    prevPage() {
      if (this.currentPage > 0) {
        this.loadPage(this.pages[this.currentPage - 1]);
      }
    }
  
    // Validation system (kept for final submission, but not enforced during navigation)
    validateCurrentPage() {
      // This method is now only called by finishWizard() to provide a final summary of missing fields.
      // It no longer prevents navigation.
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
  
      const { element, message } = errorMap[this.pages[this.currentPage]];
      const el = document.querySelector(element);
      if (el) {
        el.classList.add('error-highlight');
        setTimeout(() => el.classList.remove('error-highlight'), 2000);
      }
      alert(message);
    }
  
    // Final validation and completion
    validateAllPages() {
      const errors = [];
      
      if (!this.state.module) {
        errors.push("• Please select a Module");
      } else {
        if (!this.state.destiny) {
          errors.push("• Please select a Destiny");
        }
        
        const requiredAttrs = this.MODULE_SYSTEM[this.state.module].attributes;
        const missingAttrs = requiredAttrs.filter(attr => 
          !this.state.attributes[attr.toLowerCase()]
        );
        
        if (missingAttrs.length > 0) {
          errors.push(`• Assign dice to: ${missingAttrs.join(', ')}`);
        }
      }
      
      if (!this.state.info.name?.trim()) {
        errors.push("• Please enter a Character Name");
      }
      
      return {
        isValid: errors.length === 0,
        message: errors.join("\n")
      };
    }
  
    finishWizard() {
      const validation = this.validateAllPages();
      
      if (!validation.isValid) {
        alert("Please complete the following:\n\n" + validation.message);
        return;
      }
  
      const character = {
        name: this.state.info.name,
        module: this.state.module,
        destiny: this.state.destiny,
        attributes: this.state.attributes,
        bio: this.state.info.bio,
        createdAt: new Date().toISOString()
      };
  
      this.db.saveCharacter(character)
        .then(() => {
          window.location.href = 'character-selector.html';
        })
        .catch(err => {
          alert(`Failed to save character: ${err.message}`);
        });
    }
  
    // State restoration for elements outside diceManager's direct control
    restoreState(page) {
        switch(page) {
            case 'module':
                if (this.state.module) {
                    const btn = document.querySelector(`.module-option[data-value="${this.state.module}"]`);
                    if (btn) btn.classList.add('selected');
                }
                break;
                
            case 'destiny':
                if (this.state.destiny) {
                    document.getElementById('characterRole').value = this.state.destiny;
                }
                break;
                
            case 'attributes':
                // diceManager.init() now handles full restoration for attributes
                break; 
                
            case 'info':
                document.getElementById('characterName').value = this.state.info.name || '';
                document.getElementById('characterBio').value = this.state.info.bio || '';
                break;
        }
    }
}
  
document.addEventListener('DOMContentLoaded', () => {
    if (typeof db === 'undefined') {
      console.error("Database module not loaded!");
      return;
    }
    new CharacterWizard(db);
});