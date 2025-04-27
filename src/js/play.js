// Initialize play page
document.addEventListener('DOMContentLoaded', function() {
    //Load active character
    db.getActiveCharacter().then(function(character) {
        const characterDetails = document.getElementById('characterDetails');
        
        if (character) {
            characterDetails.innerHTML = `
                <div class="character-header">
                    <h3>${character.name}</h3>
                    <p class="character-role">${character.role}</p>
                </div>
                
                <div class="character-stats">
                    <h4>Attributes</h4>
                    <div class="stats-grid">
                        ${Object.entries(character.stats).map(([stat, value]) => `
                            <div class="stat">
                                <label>${stat.charAt(0).toUpperCase() + stat.slice(1)}</label>
                                <div class="stat-value">${value}</div>
                                <div class="stat-modifier">${Math.floor((value - 10) / 2)}</div>
                            </div>
                        `).join('')}
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
});