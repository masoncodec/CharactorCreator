# CharactorCreator

### Guide to Adding a New Page

Adding a new page to this modular wizard setup involves updating several files to integrate the new functionality. Let's assume you want to add a new "Gear" page between "Attributes" and "Info".

**Example New Page Name:** `gear`

**A. Create HTML Partials (Files: `partials/gear-selector.html`, `partials/gear-informer.html`)**

1.  **`partials/gear-selector.html`**: This file will contain the main interactive elements for the "Gear" page (e.g., checkboxes for selecting items, input fields for quantities).
    ```html
    <h2 class="text-2xl font-bold mb-4">Choose Your Gear</h2>
    <div id="gear-options-container" class="space-y-2">
        <p>Loading gear options...</p>
    </div>
    ```
2.  **`partials/gear-informer.html`**: This file will provide descriptive information or a summary related to the "Gear" page (e.g., selected gear, total weight, available slots).
    ```html
    <h3 class="text-xl font-semibold mb-4">Gear Summary</h3>
    <div id="selected-gear-summary">
        <p>Your selected gear will appear here.</p>
    </div>
    ```

**B. Create a New Page Handler Module (File: `gearPageHandler.js`)**

This module will encapsulate the logic specific to the "Gear" page.

```javascript
// gearPageHandler.js
// This module handles the UI rendering and event handling for the 'gear' selection page.

class GearPageHandler {
  constructor(stateManager, informerUpdater, pageNavigator) {
    this.stateManager = stateManager;
    this.informerUpdater = informerUpdater;
    this.pageNavigator = pageNavigator;
    this.selectorPanel = null;
    console.log('GearPageHandler: Initialized.');
  }

  setupPage(selectorPanel, informerPanel) {
    this.selectorPanel = selectorPanel;
    console.log('GearPageHandler.setupPage: Setting up gear page events and rendering content.');

    this._renderGearOptions();
    this._attachEventListeners();
    this._restoreState();

    this.informerUpdater.update('gear'); // Update informer with current gear state
    this.pageNavigator.updateNav();
  }

  _renderGearOptions() {
    const gearOptionsContainer = this.selectorPanel.querySelector('#gear-options-container');
    if (!gearOptionsContainer) return;

    // Example: Dynamically render gear options from your data (e.g., from stateManager.getGearData())
    // For this example, let's assume you have some dummy gear data for demonstration
    const dummyGearData = {
      'sword': { name: 'Longsword', weight: 3, description: 'A sturdy melee weapon.' },
      'shield': { name: 'Shield', weight: 7, description: 'Provides defense.' },
      'potion': { name: 'Healing Potion', weight: 0.5, description: 'Restores health.' }
    };

    let html = '';
    for (const gearId in dummyGearData) {
      const gear = dummyGearData[gearId];
      const isSelected = this.stateManager.get('inventory')?.some(item => item.id === gearId); // Assuming 'inventory' in state
      html += `
        <label class="block">
          <input type="checkbox" data-gear-id="${gearId}" ${isSelected ? 'checked' : ''}>
          ${gear.name} (${gear.weight} lbs): ${gear.description}
        </label>
      `;
    }
    gearOptionsContainer.innerHTML = html;
  }

  _attachEventListeners() {
    // Example: Event delegation for gear option checkboxes
    this.selectorPanel.removeEventListener('change', this._boundGearOptionChangeHandler);
    this._boundGearOptionChangeHandler = this._handleGearOptionChange.bind(this);
    this.selectorPanel.addEventListener('change', this._boundGearOptionChangeHandler);
  }

  _handleGearOptionChange(e) {
    if (e.target.matches('input[type="checkbox"][data-gear-id]')) {
      const gearId = e.target.dataset.gearId;
      const isSelected = e.target.checked;
      const currentInventory = this.stateManager.get('inventory') || [];
      let newInventory = [...currentInventory];

      if (isSelected) {
        // Add gear item
        // You'd typically get full gear data here from stateManager.getGear(gearId)
        newInventory.push({ id: gearId, quantity: 1 }); // Assuming quantity 1 for simplicity
      } else {
        // Remove gear item
        newInventory = newInventory.filter(item => item.id !== gearId);
      }
      this.stateManager.set('inventory', newInventory);

      this.informerUpdater.update('gear');
      this.pageNavigator.updateNav();
    }
  }

  _restoreState() {
    const currentInventory = this.stateManager.get('inventory') || [];
    currentInventory.forEach(item => {
      const checkbox = this.selectorPanel.querySelector(`input[type="checkbox"][data-gear-id="${item.id}"]`);
      if (checkbox) checkbox.checked = true;
    });
  }
}

export { GearPageHandler };
```

**C. Update Core Files**

1.  **`characterWizard.js`**
    * **Import the new handler:**
        ```javascript
        // ... other imports
        import { GearPageHandler } from './gearPageHandler.js';
        ```
    * **Add page name to `this.pages` array:**
        ```javascript
        this.pages = ['module', 'destiny', 'attributes', 'gear', 'info']; // Insert 'gear'
        ```
    * **Instantiate the new handler in `this.pageHandlers`:**
        ```javascript
        this.pageHandlers = {
            // ... existing handlers
            attributes: new AttributesPageHandler(this.stateManager, this.informerUpdater, this.pageNavigator, alerter),
            gear: new GearPageHandler(this.stateManager, this.informerUpdater, this.pageNavigator), // Add this line
            info: new InfoPageHandler(this.stateManager, this.informerUpdater, this.pageNavigator)
        };
        ```

2.  **`wizardStateManager.js`**
    * **Add initial state for the new tracking piece:**
        ```javascript
        this.state = {
            // ... existing state
            attributes: {},
            inventory: [], // Add this line for tracking selected gear
            info: { name: '', bio: '' }
        };
        ```
    * **If your "Gear" has its own data loaded via `dataLoader.js`, ensure you add it to the constructor:**
        ```javascript
        // ... constructor parameters
        // @param {Object} gearData - Data for gear.
        constructor(moduleSystemData, flawData, destinyData, abilityData, gearData) {
            // ...
            this.gearData = gearData; // Store the new data
        }
        // ... and add a getter for it
        getGearData() {
            return this.gearData;
        }
        getGear(gearId) {
            return this.gearData[gearId];
        }
        ```

3.  **`pageNavigator.js`**
    * **Update `isPageCompleted` method:** Add a `case` for `'gear'` to define when this page is considered complete.
        ```javascript
        isPageCompleted(page, currentState) {
            let completed = false;
            switch (page) {
                // ... existing cases
                case 'attributes':
                    // ...
                    break;
                case 'gear': // New case for 'gear' page
                    // Example: Require at least one gear item to be selected
                    completed = (currentState.inventory && currentState.inventory.length > 0);
                    break;
                case 'info':
                    // ...
                    break;
            }
            return completed;
        }
        ```
    * **Update `showPageError` method:** Add a corresponding entry for the new page.
        ```javascript
        showPageError(pageName) {
            const errorMap = {
                // ... existing errors
                attributes: { /* ... */ },
                gear: { // New error for 'gear' page
                    element: '#gear-options-container',
                    message: 'Please select at least one piece of gear.'
                },
                info: { /* ... */ }
            };
            // ... rest of the method
        }
        ```

4.  **`informerUpdater.js`**
    * **Update `update` method:** Add a `case` for `'gear'` to display selected gear.
        ```javascript
        update(page) {
            // ...
            switch (page) {
                // ... existing cases
                case 'attributes':
                    // ...
                    break;
                case 'gear': // New case for 'gear' page
                    const selectedGear = currentState.inventory || [];
                    if (selectedGear.length > 0) {
                        htmlContent = `
                            <div class="gear-info">
                                <h3>Selected Gear:</h3>
                                <ul>
                                    ${selectedGear.map(item => `<li>${item.id} (Qty: ${item.quantity || 1})</li>`).join('')}
                                </ul>
                            </div>
                        `;
                    } else {
                        htmlContent = '<p>Select your desired equipment.</p>';
                    }
                    break;
                case 'info':
                    // ...
                    break;
            }
            // ...
        }
        ```

5.  **`characterFinisher.js` (If gear data is part of final character object and validation)**
    * **Update `_validateAllPages`:** Add validation for the new page's data.
        ```javascript
        _validateAllPages() {
            // ...
            // After attributes validation
            if (!currentState.inventory || currentState.inventory.length === 0) {
                errors.push("• Please select at least one piece of gear.");
                console.log('  - Validation error: No gear selected.');
            }
            // ...
            return {
                isValid: errors.length === 0,
                message: errors.join("\n")
            };
        }
        ```
    * **Add to the final `character` object:**
        ```javascript
        const character = {
            // ... existing properties
            attributes: currentState.attributes,
            inventory: currentState.inventory, // Add this line
            abilities: currentState.abilities,
            // ...
        };
        ```

**D. Update HTML Loading Order**

Add `js/gearPageHandler.js` to your `index.html` `<body>` section, in the correct order (e.g., after `attributesPageHandler.js` and before `characterFinisher.js`).

```html
    <script type="module" src="js/modulePageHandler.js"></script>
    <script type="module" src="js/destinyPageHandler.js"></script>
    <script type="module" src="js/attributesPageHandler.js"></script>
    <script type="module" src="js/gearPageHandler.js"></script> <script type="module" src="js/infoPageHandler.js"></script>
```

### Guide to Adding a New Tracking Piece

Let's say you want to add a new concept like "Spells" that a character can learn, similar to "Abilities" but possibly managed differently.

**Example New Tracking Piece:** `spells`

**A. Define Data Structure (File: `data/spell_list.json` - new file)**

Create a new JSON file to hold the data for your new tracking piece.

```json
// data/spell_list.json
{
  "fireball": {
    "name": "Fireball",
    "description": "Hurl a ball of fire at your enemies. Deals ${damage} damage.",
    "type": "evocation",
    "damage": "6d6",
    "cost": { "mana": 5 }
  },
  "heal": {
    "name": "Healing Word",
    "description": "Heal an ally for ${healing} health.",
    "type": "restoration",
    "healing": "2d4",
    "cost": { "mana": 2 }
  }
}
```

**B. Update Data Loading (`dataLoader.js`)**

Modify `loadGameData` in `dataLoader.js` to fetch and expose this new data.

```javascript
// dataLoader.js
// ... existing imports

async function loadGameData() {
    // ... existing fetches for module, flaw, destiny, ability data

    const spellData = await fetch('data/spell_list.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for spell_list.json`);
            return response.json();
        })
        .catch(error => {
            console.error('Error loading spell_list.json:', error);
            return {}; // Return empty object on error to prevent breaking app
        });

    // Return the new data along with existing data
    return { moduleSystemData, flawData, destinyData, abilityData, spellData }; // Add spellData
}

export { loadGameData };
```

**C. Update `WizardStateManager`**

1.  **Add to constructor parameters:**
    ```javascript
    // @param {Object} spellData - Data for spells.
    constructor(moduleSystemData, flawData, destinyData, abilityData, spellData) {
        // ...
        this.spellData = spellData; // Store the new data
    }
    ```
2.  **Add a new state property:**
    ```javascript
    this.state = {
        // ... existing state
        abilities: [],
        spells: [], // Add this for tracking selected spells
        attributes: {},
        // ...
    };
    ```
3.  **Add getter for the raw data:**
    ```javascript
    getSpellData() {
        return this.spellData;
    }
    getSpell(spellId) {
        return this.spellData[spellId];
    }
    ```
4.  **Add methods for managing the state of spells (similar to `addOrUpdateAbility`):**
    ```javascript
    addOrUpdateSpell(newSpellState) {
        // Example: If spells are tier-based like abilities
        this.state.spells = this.state.spells.filter(spell =>
            spell.tier !== newSpellState.tier
        );
        this.state.spells.push(newSpellState);
        console.log('WizardStateManager: Current spells state:', this.state.spells);
    }

    updateSpellSelections(spellId, newSelections) {
        const spellIndex = this.state.spells.findIndex(s => s.id === spellId);
        if (spellIndex !== -1) {
            this.state.spells[spellIndex].selections = newSelections;
        }
    }
    ```

**D. Integrate with UI (Page Handler)**

Decide which existing page will allow the user to select spells, or create a new page handler for it (as shown in the "Add a New Page" guide). Let's assume you're adding it to the `destinyPageHandler.js` for simplicity, perhaps below the abilities section.

1.  **Modify `destinyPageHandler.js` (or a new handler):**
    * **In `_renderAbilitiesSection` (or a new `_renderSpellsSection` method):** Add logic to render the spell options based on the `spellData`.
        ```javascript
        _renderSpellsSection() {
            // Similar logic to _renderAbilitiesSection
            const container = document.createElement('div');
            container.className = 'spells-section';
            container.innerHTML = '<h4>Choose Your Spells</h4>';

            const dummySpellsForDestiny = ['fireball', 'heal']; // Example: Destiny unlocks certain spells
            const currentSpellsState = this.stateManager.get('spells');

            dummySpellsForDestiny.forEach(spellId => {
                const spell = this.stateManager.getSpell(spellId);
                if (!spell) return;
                const isSelected = currentSpellsState.some(s => s.id === spellId);
                container.innerHTML += `
                    <label class="block">
                        <input type="checkbox" data-spell-id="${spellId}" ${isSelected ? 'checked' : ''}>
                        ${spell.name}: ${spell.description}
                    </label>
                `;
            });
            // Append this container to the selectorPanel or after abilities section
            this.selectorPanel.querySelector('.abilities-section').after(container);
        }
        ```
    * **In `_attachEventListeners`:** Add event listeners for spell selection (e.g., checkbox changes).
        ```javascript
        _attachEventListeners() {
            // ... existing listeners

            this.selectorPanel.removeEventListener('change', this._boundSpellOptionChangeHandler);
            this._boundSpellOptionChangeHandler = this._handleSpellOptionChange.bind(this);
            this.selectorPanel.addEventListener('change', this._boundSpellOptionChangeHandler);
        }
        ```
    * **Add event handler:**
        ```javascript
        _handleSpellOptionChange(e) {
            if (e.target.matches('input[type="checkbox"][data-spell-id]')) {
                const spellId = e.target.dataset.spellId;
                const isSelected = e.target.checked;
                const currentSpells = this.stateManager.get('spells') || [];
                let newSpells = [...currentSpells];

                if (isSelected) {
                    newSpells.push({ id: spellId }); // Add spell to state
                } else {
                    newSpells = newSpells.filter(s => s.id !== spellId); // Remove spell
                }
                this.stateManager.set('spells', newSpells); // Update state

                this.informerUpdater.update('destiny'); // Update informer
                this.pageNavigator.updateNav(); // Update nav (if spell selection affects page completion)
            }
        }
        ```
    * **In `_restoreState`:** Add logic to restore spell selections.
        ```javascript
        _restoreState() {
            // ... existing restores for destiny, flaws, abilities

            const currentSpells = this.stateManager.get('spells') || [];
            currentSpells.forEach(spell => {
                const checkbox = this.selectorPanel.querySelector(`input[type="checkbox"][data-spell-id="${spell.id}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
        ```

**E. Update Validation/Completion (`pageNavigator.js`, `characterFinisher.js`)**

1.  **`pageNavigator.js` `isPageCompleted`:** If spell selection is required for a page to be complete, add a check.
    ```javascript
    isPageCompleted(page, currentState) {
        // ...
        case 'destiny':
            // Add a check here if spell selection is mandatory for Destiny page completion
            const spellsSelected = currentState.spells && currentState.spells.length > 0;
            // return this.validateDestinyCompletion(currentState) && spellsSelected; // Example
            return this.validateDestinyCompletion(currentState); // If not mandatory for this page
        // ...
    }
    ```
2.  **`characterFinisher.js` `_validateAllPages`:** Add a validation rule for spells.
    ```javascript
    _validateAllPages() {
        // ...
        // After abilities validation
        if (!currentState.spells || currentState.spells.length === 0) {
            errors.push("• Please select at least one Spell.");
            console.log('  - Validation error: No spells selected.');
        }
        // ...
    }
    ```

**F. Update Informer (`informerUpdater.js`)**

In the `update` method for the relevant page (`destiny` in this example), display the selected spells.

```javascript
update(page) {
    // ...
    case 'destiny':
        // ... existing destiny info HTML
        const selectedSpells = currentState.spells || [];
        htmlContent += `
            <div class="spells-info">
                <h4>Selected Spells:</h4>
                <ul>
                    ${selectedSpells.map(s => `<li>${s.id}</li>`).join('')}
                </ul>
            </div>
        `;
        // ...
        break;
    // ...
}
```

**G. Add to Final Character Object (`characterFinisher.js`)**

Ensure the `spells` array is included when the character object is saved.

```javascript
const character = {
    // ... existing properties
    inventory: currentState.inventory,
    abilities: currentState.abilities,
    spells: currentState.spells, // Add this line
    createdAt: new Date().toISOString(),
    info: currentState.info
};
```
```