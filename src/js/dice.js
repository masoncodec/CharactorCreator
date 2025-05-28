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
    highlightActiveNav('dice.html'); // Highlight "Dice" link

    db.getActiveCharacter().then(function(character) {
        const dicePageContent = document.getElementById('dicePageContent');
        
        if (character) {
            dicePageContent.innerHTML = `
                <div class="character-stats">
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
            `;

            // Rolling logic for attribute dice
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
            dicePageContent.innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
        }
    }).catch(function(err) {
        console.error('Error loading character:', err);
    });

    // Dice roller functionality for D20
    document.getElementById('rollD20').addEventListener('click', function() {
        const result = Math.floor(Math.random() * 20) + 1;
        const diceResult = document.getElementById('diceResult');
        
        diceResult.textContent = '...';
        setTimeout(function() {
            diceResult.textContent = result;
        }, 500);
    });
});