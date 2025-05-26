document.addEventListener('DOMContentLoaded', () => {
    const diceManager = {
        selectedDice: new Map(), // die -> attribute
        assignedAttributes: new Map(), // attribute -> die
        
        init() {
            // Event delegation for button clicks
            document.querySelector('.dice-assignment-table').addEventListener('click', (e) => {
                const button = e.target.closest('button[data-die]');
                if (!button) return;

                const row = button.closest('tr');
                const attribute = row.dataset.attribute;
                const die = button.dataset.die;
                
                this.processSelection(attribute, die, button);
            });

            // Form submission handler
            document.getElementById('characterForm').addEventListener('submit', (e) => {
                if (!this.validateAssignments()) {
                    e.preventDefault();
                    alert('Please assign each die type to exactly one attribute');
                }
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
            this.updateRowValidation();
        },

        clearAssignment(attribute, die) {
            this.selectedDice.delete(die);
            this.assignedAttributes.delete(attribute);
            // Remove visual selection
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

        updateRowValidation() {
            document.querySelectorAll('tr[data-attribute]').forEach(row => {
                row.classList.toggle('invalid', !this.assignedAttributes.has(row.dataset.attribute));
            });
        },

        validateAssignments() {
            return this.selectedDice.size === 6 && 
                   this.assignedAttributes.size === 6;
        },

        getAssignments() {
            return Object.fromEntries(this.assignedAttributes);
        }
    };

    diceManager.init();
});