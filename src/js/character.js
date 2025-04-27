document.getElementById('characterForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const character = {
        name: document.getElementById('characterName').value,
        role: document.getElementById('characterRole').value,
        stats: {
            strength: parseInt(document.getElementById('statStrength').value),
            dexterity: parseInt(document.getElementById('statDexterity').value),
            constitution: parseInt(document.getElementById('statConstitution').value),
            intelligence: parseInt(document.getElementById('statIntelligence').value),
            wisdom: parseInt(document.getElementById('statWisdom').value),
            charisma: parseInt(document.getElementById('statCharisma').value)
        },
        health: {
            current: 10 + Math.floor((parseInt(document.getElementById('statConstitution').value) - 10) / 2),
            max: 10 + Math.floor((parseInt(document.getElementById('statConstitution').value) - 10) / 2),
            temporary: 0
        },
        inventory: [],
        abilities: [],
        bio: document.getElementById('characterBio').value,
        createdAt: new Date().toISOString()
    };
    
    db.saveCharacter(character).then(function() {
        window.location.href = 'character-selector.html';
    }).catch(function(err) {
        alert('Failed to save character: ' + err);
    });
});

// Add import functionality
document.getElementById('importCharacter').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    db.importCharacter(file).then(function() {
        window.location.href = 'play.html';
    }).catch(function(err) {
        alert('Failed to import character: ' + err);
    });
    
    // Reset input
    e.target.value = '';
});