// Initialize play page
document.addEventListener('DOMContentLoaded', function() {
    //Load active character
    db.getActiveCharacter().then(function(character) {
        const characterDetails = document.getElementById('characterDetails');
        
        if (character) {
            characterDetails.innerHTML = `
                <div class="character-header">
                    <h3>${character.name}</h3>
                    <p class="character-module">${character.module || 'Crescendo'}</p>
                    <p class="character-role">${character.destiny}</p>
                </div>
                
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
                        <div class="dice-assignment" data-dice="d100">
                            <label>Luck</label>
                            <div class="die-type">D100</div>
                            <button class="btn-roll">Roll</button>
                            <div class="roll-result"></div>
                        </div>
                    </div>
                </div>
                
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
                
                ${character.bio ? `
                <div class="character-bio">
                    <h4>Background</h4>
                    <p>${character.bio}</p>
                </div>
                ` : ''}
                
                <div class="character-notes">
                    <h4>Notes</h4>
                    <textarea placeholder="Add session notes here..."></textarea>
                </div>
            `;
        } else {
            characterDetails.innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
        }
    }).catch(function(err) {
        console.error('Error loading character:', err);
    });

    // Dice roller functionality
    document.getElementById('rollD20').addEventListener('click', function() {
        const result = Math.floor(Math.random() * 20) + 1;
        const diceResult = document.getElementById('diceResult');
        
        diceResult.textContent = '...';
        setTimeout(function() {
            diceResult.textContent = result;
        }, 500);
    });

    // Export character
    document.getElementById('exportCharacter').addEventListener('click', function() {
        db.exportCharacter().then(function(exportData) {
            if (!exportData) {
                alert('No character to export');
                return;
            }
            
            // Log the exported data for debugging
            console.log('Exporting character:', exportData.data);
            
            const a = document.createElement('a');
            a.href = exportData.url;
            a.download = exportData.filename;
            a.click();
            
            setTimeout(function() {
                URL.revokeObjectURL(exportData.url);
            }, 100);
        }).catch(function(err) {
            console.error('Export failed:', err);
            alert('Export failed: ' + err);
        });
    });

    // Rolling logic
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
});