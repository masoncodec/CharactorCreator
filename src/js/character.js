document.getElementById('characterForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const character = {
        name: document.getElementById('characterName').value,
        role: document.getElementById('characterRole').value,
        createdAt: new Date().toISOString()
    };
    
    db.saveCharacter(character).then(function() {
        window.location.href = 'play.html';
    }).catch(function(err) {
        console.error('Full import error:', err);
        alert('Failed to import character: ' + err);
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