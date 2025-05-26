// ======================
// DATA STRUCTURES
// ======================

const MODULE_SYSTEM = {
    'high-fantasy': {
      name: 'High Fantasy',
      destinies: ['wizard', 'knight', 'rogue', 'cleric'],
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
      destinies: ['pianist', 'guitarist', 'singer', 'drummer'],
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
  
  const DESTINY_DATA = {
    // ===== HIGH FANTASY DESTINIES =====
    'wizard': {
      displayName: 'Arcane Wizard',
      description: 'Master of magical energies through rigorous study.',
      health: {
        title: 'Frail',
        effect: '6 + INT',
        value: 6
      },
      flaw: {
        title: 'Overconfidence',
        description: 'You underestimate threats',
        effect: 'Disadvantage on Perception vs danger'
      },
      tags: [
        { id: 'magic', display: 'Magic', color: '#8a2be2', icon: '🔮' },
        { id: 'support', display: 'Support', color: '#20b2aa', icon: '🌟' }
      ],
      levelUnlocks: [
        { level: 1, ability: 'spellcaster' },
        { level: 3, ability: 'arcane-intellect' },
        { level: 5, ability: 'spell-mastery' }
      ]
    },
    'knight': {
      displayName: 'Chivalric Knight',
      description: 'Noble warrior sworn to protect the realm.',
      health: {
        title: 'Sturdy',
        effect: '10 + CON',
        value: 10
      },
      flaw: {
        title: 'Code of Honor',
        description: 'You refuse to fight dirty',
        effect: 'Cannot gain advantage from stealth'
      },
      tags: [
        { id: 'melee', display: 'Melee', color: '#b22222', icon: '⚔️' },
        { id: 'defense', display: 'Defense', color: '#1e90ff', icon: '🛡️' }
      ],
      levelUnlocks: [
        { level: 1, ability: 'armored-warrior' },
        { level: 3, ability: 'fealty' },
        { level: 5, ability: 'shield-bash' }
      ]
    },
    'rogue': {
      displayName: 'Shadow Rogue',
      description: 'Stealthy opportunist who thrives in shadows.',
      health: {
        title: 'Agile',
        effect: '8 + DEX',
        value: 8
      },
      flaw: {
        title: 'Greed',
        description: 'You can\'t resist valuable loot',
        effect: 'Disadvantage on resisting theft'
      },
      tags: [
        { id: 'stealth', display: 'Stealth', color: '#696969', icon: '👤' },
        { id: 'trap', display: 'Traps', color: '#ff8c00', icon: '⚠️' }
      ],
      levelUnlocks: [
        { level: 1, ability: 'backstab' },
        { level: 3, ability: 'lockpick' },
        { level: 5, ability: 'poison-mastery' }
      ]
    },
    'cleric': {
      displayName: 'Divine Cleric',
      description: 'Holy warrior who channels divine power.',
      health: {
        title: 'Resilient',
        effect: '9 + WIS',
        value: 9
      },
      flaw: {
        title: 'Dogmatic',
        description: 'You strictly follow doctrine',
        effect: 'Cannot lie or deceive'
      },
      tags: [
        { id: 'healing', display: 'Healing', color: '#32cd32', icon: '❤️' },
        { id: 'holy', display: 'Holy', color: '#ffd700', icon: '✝️' }
      ],
      levelUnlocks: [
        { level: 1, ability: 'divine-smite' },
        { level: 3, ability: 'lay-on-hands' },
        { level: 5, ability: 'turn-undead' }
      ]
    },
  
    // ===== CRESCENDO DESTINIES =====
    'pianist': {
      displayName: 'Virtuoso Pianist',
      description: 'Keyboard master with technical precision.',
      health: {
        title: 'Artistic',
        effect: '7 + HARMONY',
        value: 7
      },
      flaw: {
        title: 'Perfectionist',
        description: 'You obsess over mistakes',
        effect: 'Disadvantage on recovery checks'
      },
      tags: [
        { id: 'keys', display: 'Keys', color: '#000000', icon: '🎹' },
        { id: 'solo', display: 'Solo', color: '#ffffff', icon: '🎼' }
      ],
      levelUnlocks: [
        { level: 1, ability: 'virtuoso' },
        { level: 3, ability: 'improvisation' },
        { level: 5, ability: 'grand-finale' }
      ]
    },
    'guitarist': {
      displayName: 'Lead Guitarist',
      description: 'Stage-dominating riff machine.',
      health: {
        title: 'Charismatic',
        effect: '8 + STYLE',
        value: 8
      },
      flaw: {
        title: 'Ego',
        description: 'You crave the spotlight',
        effect: 'Disadvantage on group performance checks'
      },
      tags: [
        { id: 'strings', display: 'Strings', color: '#ff4500', icon: '🎸' },
        { id: 'lead', display: 'Lead', color: '#ffd700', icon: '🌟' }
      ],
      levelUnlocks: [
        { level: 1, ability: 'power-chord' },
        { level: 3, ability: 'face-melter' },
        { level: 5, ability: 'feedback-loop' }
      ]
    },
    'singer': {
      displayName: 'Soulful Singer',
      description: 'Voice that moves audiences to tears.',
      health: {
        title: 'Emotive',
        effect: '6 + PASSION',
        value: 6
      },
      flaw: {
        title: 'Vulnerable',
        description: 'You take criticism hard',
        effect: 'Disadvantage on Fame checks after failure'
      },
      tags: [
        { id: 'vocals', display: 'Vocals', color: '#ff69b4', icon: '🎤' },
        { id: 'lyrics', display: 'Lyrics', color: '#9370db', icon: '📝' }
      ],
      levelUnlocks: [
        { level: 1, ability: 'high-note' },
        { level: 3, ability: 'crowd-hush' },
        { level: 5, ability: 'golden-voice' }
      ]
    },
    'drummer': {
      displayName: 'Rhythmic Drummer',
      description: 'The band\'s heartbeat and tempo-keeper.',
      health: {
        title: 'Enduring',
        effect: '9 + RHYTHM',
        value: 9
      },
      flaw: {
        title: 'Impulsive',
        description: 'You rush into things',
        effect: 'Disadvantage on patience checks'
      },
      tags: [
        { id: 'percussion', display: 'Percussion', color: '#8b4513', icon: '🥁' },
        { id: 'tempo', display: 'Tempo', color: '#0000ff', icon: '⏱️' }
      ],
      levelUnlocks: [
        { level: 1, ability: 'double-kick' },
        { level: 3, ability: 'fill-master' },
        { level: 5, ability: 'metronome-sense' }
      ]
    }
  };
  
const ABILITY_DATA = {
    // ===== HIGH FANTASY ABILITIES =====
    'spellcaster': {
      name: 'Spellcaster',
      type: ['Spell', 'Combat'],
      description: 'Choose ${maxChoices} spells from your spellbook.',
      maxChoices: 3,
      options: ['fireball', 'shield', 'mage-hand', 'lightning-bolt'],
      tier: 1
    },
    'arcane-intellect': {
      name: 'Arcane Intellect',
      type: ['Passive'],
      description: 'Learn spells from scrolls by spending ${cost.gold} gold.',
      cost: { gold: 50, item: 'spell-scroll' },
      tier: 2
    },
    'armored-warrior': {
      name: 'Armored Warrior',
      type: ['Combat', 'Passive'],
      description: 'Gain +${bonus} to Constitution when wearing heavy armor.',
      bonus: 3,
      tier: 1
    },
    'fealty': {
      name: 'Fealty',
      type: ['Social', 'Passive'],
      description: 'Advantage on Charisma checks in your lord\'s domain.',
      tier: 2
    },
    'backstab': {
      name: 'Backstab',
      type: ['Combat'],
      description: 'Deal ${damage}x damage when attacking from stealth.',
      damage: 2,
      cost: { stamina: 10 },
      tier: 1
    },
    'divine-smite': {
      name: 'Divine Smite',
      type: ['Holy', 'Combat'],
      description: 'Channel holy energy to deal ${damage} + WIS radiant damage.',
      damage: 5,
      cost: { faith: 1 },
      tier: 1
    },
  
    // ===== CRESCENDO ABILITIES =====
    'virtuoso': {
      name: 'Virtuoso',
      type: ['Performance', 'Passive'],
      description: 'Gain +${bonus} to technical skill checks.',
      bonus: 2,
      tier: 1
    },
    'improvisation': {
      name: 'Improvisation',
      type: ['Performance'],
      description: 'Reroll a failed performance check once per session.',
      cost: { inspiration: 1 },
      tier: 2
    },
    'power-chord': {
      name: 'Power Chord',
      type: ['Performance', 'Combat'],
      description: 'Deal ${damage} sonic damage to nearby enemies.',
      damage: 4,
      cost: { stamina: 15 },
      tier: 1
    },
    'high-note': {
      name: 'High Note',
      type: ['Performance'],
      description: 'Automatically succeed on a vocal check (once per session).',
      tier: 1
    },
    'double-kick': {
      name: 'Double Kick',
      type: ['Performance', 'Combat'],
      description: 'Gain an extra action during drum solos.',
      cost: { stamina: 20 },
      tier: 1
    }
};

class CharacterWizard {
    constructor(db) {
      this.currentPage = 0;
      this.pages = ['module', 'destiny', 'attributes', 'info'];
      this.state = {
        module: null,
        moduleChanged: false, // This flag is still used for resetting destiny/attributes when module *truly* changes
        destiny: null,
        abilities: [], // Track {id, selections, tier}
        attributes: {},
        info: { name: '', bio: '' }
      };
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
            roleSelect.innerHTML = '<option value="">Select a Destiny</option>';
          
            if (this.state.module) {
              MODULE_SYSTEM[this.state.module].destinies.forEach(destinyId => {
                const destiny = DESTINY_DATA[destinyId];
                if (!destiny) {
                    console.error(`Missing destiny data for: ${destinyId}`);
                    return;
                }
          
                const option = document.createElement('option');
                option.value = destinyId;
                option.textContent = destiny.displayName;
                roleSelect.appendChild(option);
              });
          
              if (this.state.destiny) {
                roleSelect.value = this.state.destiny;
              }
            }
          
            roleSelect.addEventListener('change', (e) => {
              this.state.destiny = e.target.value;
              this.state.abilities = []; // Reset on destiny change
              this.renderDestinyDetails(); // New method
              this.renderAbilitiesSection(); // New method
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
                    MODULE_SYSTEM[this.state.module].attributes.forEach(attr => {
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
                 <h3>${MODULE_SYSTEM[this.state.module].name}</h3>
                 <p>${MODULE_SYSTEM[this.state.module].descriptions.module}</p>
                 <h4>Available Destinies:</h4>
                 <ul>
                   ${MODULE_SYSTEM[this.state.module].destinies.map(d => `<li>${d}</li>`).join('')}
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
            
            const destiny = DESTINY_DATA[this.state.destiny];
            informer.innerHTML = `
              <div class="destiny-info">
                <h3>${destiny.displayName}</h3>
                <p>${destiny.description}</p>
                <div class="tags">${this.renderTags(destiny.tags)}</div>
              </div>
            `;
            break;
  
        case 'attributes':
          informer.innerHTML = `
            <div class="attributes-info">
              <h3>${MODULE_SYSTEM[this.state.module]?.name || 'Module'} Attributes</h3>
              <p>Assign dice to your attributes:</p>
              <ul>
                ${this.state.module 
                  ? MODULE_SYSTEM[this.state.module].attributes.map(a => 
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
    renderDestinyDetails() {
        if (!this.state.destiny) return;
        const destiny = DESTINY_DATA[this.state.destiny];
        
        const container = document.createElement('div');
        container.className = 'destiny-details';
        container.innerHTML = `
          <h3>${destiny.displayName}</h3>
          <p>${destiny.description}</p>
          <div class="stats">
            <div><strong>Health:</strong> ${destiny.health.title} (${destiny.health.effect})</div>
            <div><strong>Flaw:</strong> ${destiny.flaw.title} - ${destiny.flaw.effect}</div>
          </div>
          <div class="tags">${this.renderTags(destiny.tags)}</div>
        `;
  
        const existing = document.querySelector('.destiny-details');
        existing ? existing.replaceWith(container) : document.querySelector('#selectorPanel').appendChild(container);
    }
  
    renderTags(tags) {
        return tags.map(tag => `
          <span class="tag" style="background: ${tag.color}">
            ${tag.icon} ${tag.display}
          </span>
        `).join('');
    }
  
    renderAbilitiesSection() {
        if (!this.state.destiny) return;
        const destiny = DESTINY_DATA[this.state.destiny];
        
        const container = document.createElement('div');
        container.className = 'abilities-section';
        container.innerHTML = '<h4>Abilities</h4>';
  
        // Group abilities by tier
        const abilitiesByTier = {};
        destiny.levelUnlocks.forEach(unlock => {
          if (!abilitiesByTier[unlock.level]) {
            abilitiesByTier[unlock.level] = [];
          }
          abilitiesByTier[unlock.level].push(unlock.ability);
        });
  
        // Render tier groups
        Object.entries(abilitiesByTier).forEach(([tier, abilityIds]) => {
          container.innerHTML += `<h5 class="tier-header">Tier ${tier} (Choose 1)</h5>`;
          
          abilityIds.forEach(abilityId => {
            const ability = ABILITY_DATA[abilityId];
            if (!ability) {
              console.warn(`Missing ability: ${abilityId}`);
              return;
            }
  
            const isSelected = this.state.abilities.some(a => a.id === abilityId);
            container.innerHTML += `
              <div class="ability ${isSelected ? 'selected' : ''}" data-ability="${abilityId}">
                <div class="ability-header">
                  <label>
                    <input type="radio" name="tier-${tier}" 
                           ${isSelected ? 'checked' : ''}
                           data-tier="${tier}" 
                           data-ability="${abilityId}">
                    <span class="ability-name">${ability.name}</span>
                  </label>
                  <div class="ability-types">
                    ${ability.type.map(type => `
                      <span class="type-tag">${this.getTypeIcon(type)} ${type}</span>
                    `).join('')}
                  </div>
                </div>
                <div class="ability-description">${this.renderAbilityDescription(ability)}</div>
                ${ability.options ? this.renderAbilityOptions(ability) : ''}
              </div>
            `;
          });
        });
  
        // Add event listeners
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
              e.target.dataset.ability,
              e.target.dataset.option,
              e.target.checked
            );
          });
        });
    }
  
    getTypeIcon(type) {
        const icons = {
          'Combat': '⚔️',
          'Spell': '🔮',
          'Support': '🛡️',
          'Social': '💬'
        };
        return icons[type] || '✨';
    }
  
    renderAbilityDescription(ability) {
        let desc = ability.description;
        // Replace template variables like ${bonus}
        desc = desc.replace(/\${([^}]+)}/g, (match, p1) => {
          return ability[p1] || p1;
        });
        return desc;
    }
  
    renderAbilityOptions(ability) {
        if (!ability.options) return '';
        
        const currentSelections = this.state.abilities
          .find(a => a.id === ability.id)?.selections || [];
        
        return `
          <div class="ability-options">
            <p>Choose ${ability.maxChoices}:</p>
            ${ability.options.map(option => `
              <label class="ability-option">
                <input type="checkbox" 
                       ${currentSelections.some(s => s.id === option) ? 'checked' : ''}
                       data-ability="${ability.id}" 
                       data-option="${option}">
                ${option}
              </label>
            `).join('')}
          </div>
        `;
    }
  
    handleTierSelection(tier, abilityId) {
        // Remove any existing abilities from this tier
        this.state.abilities = this.state.abilities.filter(a => {
          const ability = ABILITY_DATA[a.id];
          return !DESTINY_DATA[this.state.destiny].levelUnlocks.some(
            u => u.level == tier && u.ability === a.id
          );
        });
  
        // Add new selection
        this.state.abilities.push({
          id: abilityId,
          tier: parseInt(tier),
          selections: []
        });
  
        this.updateNav();
    }
  
    handleAbilityOptionSelection(abilityId, optionId, isSelected) {
        const abilityState = this.state.abilities.find(a => a.id === abilityId);
        if (!abilityState) return;
  
        const abilityDef = ABILITY_DATA[abilityId];
        
        if (isSelected) {
          // Check max choices
          if (abilityDef.maxChoices && 
              abilityState.selections.length >= abilityDef.maxChoices) {
            return;
          }
          abilityState.selections.push({ id: optionId });
        } else {
          abilityState.selections = abilityState.selections.filter(s => s.id !== optionId);
        }
  
        this.updateNav();
    }
  
    validateDestinyCompletion() {
        if (!this.state.destiny) return false;
        const destiny = DESTINY_DATA[this.state.destiny];
        
        // Check at least one ability per tier is selected
        const tiers = [...new Set(destiny.levelUnlocks.map(u => u.level))];
        const tierComplete = tiers.every(tier => {
          return this.state.abilities.some(a => 
            destiny.levelUnlocks.some(u => u.level == tier && u.ability === a.id)
          );
        });
  
        // Check ability option requirements
        const optionsComplete = this.state.abilities.every(abilityState => {
          const abilityDef = ABILITY_DATA[abilityState.id];
          if (!abilityDef.maxChoices) return true;
          return abilityState.selections.length === abilityDef.maxChoices;
        });
  
        return tierComplete && optionsComplete;
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
                    const requiredAttrs = MODULE_SYSTEM[this.state.module].attributes;
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
        Object.keys(MODULE_SYSTEM).forEach(moduleId => {
          MODULE_SYSTEM[moduleId].destinies.forEach(destinyId => {
            if (!DESTINY_DATA[destinyId]) {
              console.error(`Missing destiny data for: ${destinyId}`);
            } else {
              DESTINY_DATA[destinyId].levelUnlocks.forEach(unlock => {
                if (!ABILITY_DATA[unlock.ability]) {
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
        
        const requiredAttrs = MODULE_SYSTEM[this.state.module].attributes;
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