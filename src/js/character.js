document.addEventListener('DOMContentLoaded', () => {
    const diceManager = {
        selectedDice: new Map(), // die -> attribute
        assignedAttributes: new Map(), // attribute -> die
        
        init() {
            document.querySelector('.dice-assignment-table').addEventListener('click', (e) => {
                const button = e.target.closest('button');
                if (!button) return;
                
                const attributeRow = button.closest('tr');
                const attribute = attributeRow.dataset.attribute;
                const die = button.dataset.die;
                
                this.handleSelection(attribute, die, button);
            });
            
            document.getElementById('characterForm').addEventListener('submit', (e) => {
                if (!this.validateSelections()) {
                    e.preventDefault();
                    alert('Please assign each die type to exactly one attribute');
                }
            });
        },
        
        handleSelection(attribute, die, button) {
            // Toggle selection
            if (this.assignedAttributes.get(attribute) === die) {
                // Deselect
                this.selectedDice.delete(die);
                this.assignedAttributes.delete(attribute);
                button.classList.remove('selected');
            } else {
                // Check if die is available
                if (this.selectedDice.has(die)) {
                    alert('This die type is already assigned to another attribute');
                    return;
                }
                
                // Remove previous assignment for this attribute
                const previousDie = this.assignedAttributes.get(attribute);
                if (previousDie) {
                    this.selectedDice.delete(previousDie);
                    this.updateDieButton(attributeRow, previousDie, false);
                }
                
                // Assign new selection
                this.selectedDice.set(die, attribute);
                this.assignedAttributes.set(attribute, die);
                button.classList.add('selected');
            }
            
            this.updateDieAvailability();
            this.updateRowStates();
        },
        
        updateDieAvailability() {
            document.querySelectorAll('[data-die]').forEach(button => {
                const die = button.dataset.die;
                button.disabled = this.selectedDice.has(die) && 
                              this.selectedDice.get(die) !== button.closest('tr').dataset.attribute;
            });
        },
        
        updateRowStates() {
            document.querySelectorAll('[data-attribute]').forEach(row => {
                row.classList.toggle('error', !this.assignedAttributes.has(row.dataset.attribute));
            });
        },
        
        validateSelections() {
            return this.selectedDice.size === 6 && 
                   this.assignedAttributes.size === 6;
        },
        
        getDiceAssignments() {
            return Object.fromEntries(this.assignedAttributes);
        }
    };

    diceManager.init();
});