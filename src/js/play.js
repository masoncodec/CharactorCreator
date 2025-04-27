// Initialize play page
document.addEventListener('DOMContentLoaded', function() {
    //Load active character
    db.getActiveCharacter().then(function(character) {
        const characterDetails = document.getElementById('characterDetails');
        
        if (character) {
            characterDetails.innerHTML = `
                <h3>${character.name}</h3>
                <p>Role: ${character.role}</p>
                <a href="character-selector.html" class="btn-change-character">Change Character</a>
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
            
            const a = document.createElement('a');
            a.href = exportData.url;
            a.download = exportData.filename;
            a.click();
            
            // Clean up
            setTimeout(function() {
                URL.revokeObjectURL(exportData.url);
            }, 100);
        }).catch(function(err) {
            console.error('Export failed:', err);
            alert('Export failed: ' + err);
        });
    });
});