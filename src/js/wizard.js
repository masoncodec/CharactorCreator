class CharacterWizard {
    constructor(db) {  // Accept db as a parameter
        this.currentPage = 0;
        this.pages = ['module', 'destiny', 'attributes', 'info'];
        this.state = {
            module: null,
            destiny: null,
            attributes: {},
            info: { name: '', bio: '' }
        };
        this.db = db;  // Store db reference
        this.navItems = document.querySelectorAll('.nav-item');
        
        // defines what the user can select from the selectors
        const MODULE_SYSTEM = {
            'high-fantasy': {
              name: 'High Fantasy',
              destinies: ['Wizard', 'Knight', 'Rogue', 'Cleric'],
              attributes: ['Strength', 'Dexterity', 'Constitution', 'Wisdom', 'Intelligence', 'Charisma'],
              descriptions: {
                module: 'Classic medieval fantasy adventuring...',
                destinies: {
                  wizard: 'Arcane spellcaster...',
                  knight: 'Noble warrior...'
                }
              }
            },
            'crescendo': {
              name: 'Crescendo',
              destinies: ['Pianist', 'Guitarist', 'Singer', 'Drummer'],
              attributes: ['Passion', 'Rhythm', 'Stamina', 'Fame', 'Style', 'Harmony'],
              descriptions: {
                module: 'Musical storytelling game...',
                destinies: {
                  pianist: 'Keyboard virtuoso...',
                  guitarist: 'String instrument master...'
                }
              }
            }
        };

        this.init();
    }

    init() {
        // Navigation events - now with click handling - via nav bar
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.goToPage(item.dataset.page);
            });
        });

        // Navigation events
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => this.goToPage(item.dataset.page));
        });

        // Control buttons
        document.getElementById('prevBtn').addEventListener('click', () => this.prevPage());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextPage());

        this.loadPage(this.pages[0]);
    }

    // nav bar selection
    goToPage(page) {
        const pageIndex = this.pages.indexOf(page);
        if (pageIndex !== -1 && this.validateCurrentPage()) {
            this.loadPage(page);
        }
    }

    loadPage(page) {
        this.currentPage = this.pages.indexOf(page);

        // Update nav items -> for nav bar selection
        this.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
            item.classList.toggle('completed', 
                this.pages.indexOf(item.dataset.page) < this.currentPage
            );
        });
        
        // Load selector content
        fetch(`partials/${page}-selector.html`)
            .then(r => r.text())
            .then(html => {
                document.getElementById('selectorPanel').innerHTML = html;
                this.restoreState(page); // Restore saved state
                this.setupPageEvents(page);
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
                // Restore dice assignments
                Object.entries(this.state.attributes).forEach(([attr, die]) => {
                    const btn = document.querySelector(`tr[data-attribute="${attr}"] button[data-die="${die}"]`);
                    if (btn) btn.classList.add('selected');
                });
                break;
                
            case 'info':
                document.getElementById('characterName').value = this.state.info.name || '';
                document.getElementById('characterBio').value = this.state.info.bio || '';
                break;
        }
    }

    setupPageEvents(page) {
        switch(page) {
            case 'module':
                document.querySelectorAll('.module-option').forEach(opt => {
                    opt.addEventListener('click', () => {
                        // Clear previous selection
                        document.querySelectorAll('.module-option').forEach(o => 
                            o.classList.remove('selected'));
                        
                        // Set new selection
                        opt.classList.add('selected');
                        this.state.module = opt.dataset.value;
                        this.updateInformer(page);
                    });
                });
                break;
                
            case 'destiny':
                const roleSelect = document.getElementById('characterRole');
                roleSelect.addEventListener('change', (e) => {
                    this.state.destiny = e.target.value;
                    this.updateInformer(page);
                });
                break;
                
            case 'attributes':
                const diceManager = {
                    selectedDice: new Map(), // die -> attribute
                    assignedAttributes: new Map(), // attribute -> die
                    
                    init() {
                        document.querySelector('.dice-assignment-table').addEventListener('click', (e) => {
                            const button = e.target.closest('button[data-die]');
                            if (!button) return;

                            const row = button.closest('tr');
                            const attribute = row.dataset.attribute;
                            const die = button.dataset.die;
                            
                            this.processSelection(attribute, die, button);
                        });
                    },

                    processSelection(attribute, die, button) {
                        const currentAssignment = this.assignedAttributes.get(attribute);
                        
                        if (currentAssignment === die) {
                            // Toggle off existing selection
                            this.clearAssignment(attribute, die);
                            button.classList.remove('selected');
                        } else {
                            // Check if new die is available
                            if (this.selectedDice.has(die)) {
                                alert('This die type is already assigned to another attribute');
                                return;
                            }

                            // Clear previous assignment if exists
                            if (currentAssignment) {
                                this.clearAssignment(attribute, currentAssignment);
                            }

                            // Set new assignment
                            this.selectedDice.set(die, attribute);
                            this.assignedAttributes.set(attribute, die);
                            button.classList.add('selected');
                        }

                        this.updateDieStates();
                        this.updateState();
                    },

                    clearAssignment(attribute, die) {
                        this.selectedDice.delete(die);
                        this.assignedAttributes.delete(attribute);
                        document.querySelector(`tr[data-attribute="${attribute}"] button[data-die="${die}"]`)
                            ?.classList.remove('selected');
                    },

                    updateDieStates() {
                        document.querySelectorAll('button[data-die]').forEach(button => {
                            const die = button.dataset.die;
                            const isAssigned = this.selectedDice.has(die);
                            const isCurrentAttribute = this.selectedDice.get(die) === button.closest('tr').dataset.attribute;
                            
                            button.disabled = isAssigned && !isCurrentAttribute;
                        });
                    },

                    updateState() {
                        // Update wizard state
                        this.wizard.state.attributes = Object.fromEntries(this.assignedAttributes);
                    }
                };
                
                // Link to wizard instance
                diceManager.wizard = this;
                diceManager.init();
                
                // Restore any existing selections
                Object.entries(this.state.attributes).forEach(([attr, die]) => {
                    const btn = document.querySelector(`tr[data-attribute="${attr}"] button[data-die="${die}"]`);
                    if (btn) {
                        btn.classList.add('selected');
                        diceManager.selectedDice.set(die, attr);
                        diceManager.assignedAttributes.set(attr, die);
                    }
                });
                diceManager.updateDieStates();
                break;
                
            case 'info':
                document.getElementById('characterName').addEventListener('input', (e) => {
                    this.state.info.name = e.target.value;
                });
                document.getElementById('characterBio').addEventListener('input', (e) => {
                    this.state.info.bio = e.target.value;
                });
                break;
        }
    }

    updateNav() {
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach((item, i) => {
            item.classList.toggle('active', i === this.currentPage);
            item.classList.toggle('completed', i < this.currentPage);
        });

        // Update control buttons
        document.getElementById('prevBtn').disabled = this.currentPage === 0;
        document.getElementById('nextBtn').textContent = 
            this.currentPage === this.pages.length - 1 ? 'Finish' : 'Next';

        // this.navItems.forEach((item, index) => {
        //     const canAccess = this.canAccessPage(index);
        //     item.classList.toggle('disabled', !canAccess);
        //     item.classList.toggle('active', index === this.currentPage);
        //     item.classList.toggle('completed', index < this.currentPage);
            
        //     // Add tooltip for disabled items
        //     if (!canAccess) {
        //       item.title = this.getNavigationBlockReason(index);
        //     } else {
        //       item.removeAttribute('title');
        //     }
        //   });
    }

    // canAccessPage(index) {
    //     if (index === 0) return true; // Module page always accessible
        
    //     // Check module selected
    //     if (!this.state.module) return false;
        
    //     // Check destiny selected for attributes+ pages
    //     if (index >= 2 && !this.state.destiny) return false;
        
    //     return true;
    // }

    // getNavigationBlockReason(index) {
    //     if (!this.state.module) return "Select a module first";
    //     if (index >= 2 && !this.state.destiny) return "Select a destiny first";
    //     return "";
    // }

    nextPage() {
        if (this.validateCurrentPage()) {
            if (this.currentPage < this.pages.length - 1) {
                this.loadPage(this.pages[this.currentPage + 1]);
            } else {
                this.finishWizard(); // New method for completion
            }
        }
    }

    validateAllPages() {
        const errors = [];
        
        // Module validation
        if (!this.state.module) {
            errors.push("• Please select a Module");
        }
        
        // Destiny validation
        if (!this.state.destiny) {
            errors.push("• Please select a Destiny (Class/Role)");
        }
        
        // Attributes validation
        const requiredAttributes = ['passion', 'rhythm', 'stamina', 'fame', 'style', 'harmony'];
        const missingAttributes = requiredAttributes.filter(attr => !this.state.attributes[attr]);
        
        if (missingAttributes.length > 0) {
            const formattedMissing = missingAttributes.map(a => 
                `${a.charAt(0).toUpperCase() + a.slice(1)}`
            ).join(", ");
            errors.push(`• Missing dice assignments for: ${formattedMissing}`);
        }
        
        // Basic Info validation
        if (!this.state.info.name || this.state.info.name.trim() === "") {
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
            // Clear previous error highlights
            document.querySelectorAll('.error-highlight').forEach(el => 
                el.classList.remove('error-highlight'));
            
            // Add new error highlights
            if (!this.state.module) {
                document.querySelector('.module-options')?.classList.add('error-highlight');
            }
            if (!this.state.destiny) {
                document.getElementById('characterRole')?.classList.add('error-highlight');
            }
            if (Object.keys(this.state.attributes).length < 6) {
                document.querySelector('.dice-assignment-table')?.classList.add('error-highlight');
            }
            if (!this.state.info.name) {
                document.getElementById('characterName')?.classList.add('error-highlight');
            }
            
            // Navigate to first incomplete page
            let incompletePage = null;
            if (!this.state.module) incompletePage = 'module';
            else if (!this.state.destiny) incompletePage = 'destiny';
            else if (Object.keys(this.state.attributes).length < 6) incompletePage = 'attributes';
            else if (!this.state.info.name) incompletePage = 'info';
            
            if (incompletePage) {
                this.goToPage(incompletePage);
            }
            
            alert(validation.message);
            return;
        }

        // Proceed with saving
        const character = {
            name: this.state.info.name,
            role: this.state.destiny,
            module: this.state.module,
            attributes: this.state.attributes,
            bio: this.state.info.bio,
            health: { current: 10, max: 10, temporary: 0 },
            inventory: [],
            abilities: [],
            createdAt: new Date().toISOString()
        };

        // Use this.db instead of global db
        this.db.saveCharacter(character)
            .then(() => {
                window.location.href = 'character-selector.html';
            })
            .catch(err => {
                alert(`Failed to save character: ${err.message}`);
            });
    }

    prevPage() {
        if (this.currentPage > 0) {
            this.loadPage(this.pages[this.currentPage - 1]);
        }
    }

    validateCurrentPage() {
        // const validations = {
        //   module: () => !!this.state.module,
        //   destiny: () => !!this.state.module && !!this.state.destiny,
        //   attributes: () => {
        //     if (!this.state.module) return false;
        //     const requiredAttrs = MODULE_SYSTEM[this.state.module].attributes;
        //     return requiredAttrs.every(attr => this.state.attributes[attr.toLowerCase()]);
        //   },
        //   info: () => !!this.state.info.name?.trim()
        // };
      
        // if (!validations[this.pages[this.currentPage]]()) {
        //   this.showPageError();
        //   return false;
        // }
        // return true;

        return true;
      }
      
    // showPageError() {
    //     const errorMap = {
    //       module: { element: '.module-options', message: 'Please select a module' },
    //       destiny: { element: '#characterRole', message: 'Please select a destiny' },
    //       attributes: { element: '.dice-assignment-table', message: 'Assign dice to all attributes' },
    //       info: { element: '#characterName', message: 'Enter a character name' }
    //     };
      
    //     const { element, message } = errorMap[this.pages[this.currentPage]];
    //     const el = document.querySelector(element);
    //     if (el) {
    //       el.classList.add('error-highlight');
    //       setTimeout(() => el.classList.remove('error-highlight'), 2000);
    //     }
    //     alert(message);
    // }

    saveCharacter() {
        // Your save logic here
        console.log('Character created:', this.state);
    }

    updateInformer(page) {
        // Update informer content based on selections
        switch(page) {
            case 'module':
                document.querySelectorAll('.module-info > div').forEach(div => {
                    div.style.display = 'none';
                });
                if (this.state.module) {
                    document.querySelector(`.info-${this.state.module}`).style.display = 'block';
                }
                break;
                
            case 'destiny':
                // Update role description
                const roleInfo = document.getElementById('roleInfo');
                if (this.state.destiny) {
                    roleInfo.innerHTML = `<h4>${this.state.destiny}</h4>
                                        <p>${this.getRoleDescription(this.state.destiny)}</p>`;
                }
                break;
        }
    }

    // updateInformer(page) {
    //     const informer = document.getElementById('informerPanel');
    //     if (!informer) return;
      
    //     switch(page) {
    //       case 'module':
    //         informer.innerHTML = this.state.module 
    //           ? `<div class="module-info">
    //                <h3>${MODULE_SYSTEM[this.state.module].name}</h3>
    //                <p>${MODULE_SYSTEM[this.state.module].descriptions.module}</p>
    //              </div>`
    //           : '<p>Select a module to begin</p>';
    //         break;
      
    //       case 'destiny':
    //         informer.innerHTML = this.state.destiny
    //           ? `<div class="destiny-info">
    //                <h3>${this.state.destiny}</h3>
    //                <p>${MODULE_SYSTEM[this.state.module]?.descriptions.destinies[this.state.destiny] || 'No description available'}</p>
    //              </div>`
    //           : '<p>Select a destiny</p>';
    //         break;
      
    //       // ... other cases
    //     }
    // }

    getRoleDescription(role) {
        // Add your role descriptions here
        const descriptions = {
            bard: "Charismatic performer with magical songs...",
            warrior: "Skilled combatant with martial prowess..."
        };
        return descriptions[role] || "Select a role to see details";
    }
}

// Initialize after ensuring db is available
document.addEventListener('DOMContentLoaded', () => {
    if (typeof db === 'undefined') {
        console.error("Database module not loaded!");
        // You could show a user-friendly error message here
        return;
    }
    
    new CharacterWizard(db);  // Pass db to constructor
});