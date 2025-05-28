// Function to highlight the active navigation link
function highlightActiveNav(pageName) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').includes(pageName)) {
            link.classList.add('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    highlightActiveNav('combat.html'); // Highlight "Combat" link

    db.getActiveCharacter().then(function(character) {
        const combatPageContent = document.getElementById('combatPageContent');
        
        if (character) {
            combatPageContent.innerHTML = `
                <div class="character-health">
                    <h4>Health</h4>
                    <div class="health-bar">
                        <div class="health-current" style="width: ${(character.health.current / character.health.max) * 100}%"></div>
                    </div>
                    <div class="health-numbers">
                        ${character.health.current} / ${character.health.max}
                        ${character.health.temporary ? `(+${character.health.temporary} temp)` : ''}
                    </div>
                </div>

                <div class="character-stats" style="margin-top: 20px;">
                    <h4>Attributes</h4>
                    <div class="dice-assignments">
                        ${Object.entries(character.attributes).map(([attr, die]) => `
                            <div class="dice-assignment" data-attribute="${attr}" data-dice="${die}">
                                <label>${attr.charAt(0).toUpperCase() + attr.slice(1)}</label>
                                <div class="die-type">${die.toUpperCase()}</div>
                                <button class="btn-roll">Roll</button>
                                <div class="roll-result"></div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                ${character.abilities && character.abilities.length > 0 ? `
                <div class="character-abilities" style="margin-top: 20px;">
                    <h4>Abilities</h4>
                    ${character.abilities.map(ability => `
                        <div class="ability-item">
                            <button class="ability-toggle">${ability.selections[0].id.replace(/-/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</button>
                            <ul class="ability-selections">
                                ${ability.selections.map(selection => `<li>${selection.id.replace(/-/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</li>`).join('')}
                            </ul>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
            `;

            // Add event listeners for ability toggles
            document.querySelectorAll('.ability-toggle').forEach(button => {
                button.addEventListener('click', function() {
                    const selections = this.nextElementSibling;
                    selections.classList.toggle('active');
                });
            });

            // Rolling logic for attribute dice (copied from play.js)
            document.querySelectorAll('.btn-roll').forEach(btn => {
                btn.addEventListener('click', function() {
                    const assignment = this.closest('.dice-assignment');
                    const dieType = assignment.getAttribute('data-dice');
                    const result = Math.floor(Math.random() * parseInt(dieType.substring(1))) + 1;
                    
                    const resultEl = assignment.querySelector('.roll-result');
                    resultEl.textContent = result;
                    resultEl.classList.add('visible');
                    
                    setTimeout(() => resultEl.classList.remove('visible'), 2000);
                });
            });

        } else {
            combatPageContent.innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
        }
    }).catch(function(err) {
        console.error('Error loading character:', err);
    });
});