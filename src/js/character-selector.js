document.addEventListener('DOMContentLoaded', function() {
    const charactersList = document.getElementById('charactersList');
    
    function refreshCharacterList() {
        db.getAllCharacters().then(function(characters) {
            charactersList.innerHTML = '';
            
            if (characters.length === 0) {
                charactersList.innerHTML = '<p class="no-characters">No characters found. Create one to get started!</p>';
                return;
            }
            
            characters.forEach(function(character) {
                const characterCard = document.createElement('div');
                characterCard.className = 'character-card';
                characterCard.innerHTML = `
                    <h3>${character.info.name}</h3>
                    <p>${character.destiny}</p>
                    <p class="meta">Created: ${new Date(character.createdAt).toLocaleDateString()}</p>
                    <div class="card-actions">
                        <button class="btn-select" data-id="${character.id}">Select</button>
                        <button class="btn-delete" data-id="${character.id}">Delete</button>
                    </div>
                `;
                
                charactersList.appendChild(characterCard);
            });
            
            // Add event listeners
            document.querySelectorAll('.btn-select').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    db.setActiveCharacter(id);
                    window.location.href = 'play.html';
                });
            });
            
            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', function() {
                    if (confirm('Are you sure you want to delete this character?')) {
                        const id = this.getAttribute('data-id');
                        db.deleteCharacter(Number(id)).then(function() {
                            refreshCharacterList();
                        }).catch(function(err) {
                            alert('Error deleting character: ' + err);
                        });
                    }
                });
            });
        }).catch(function(err) {
            console.error('Error loading characters:', err);
            charactersList.innerHTML = '<p class="error">Error loading characters. Please refresh the page.</p>';
        });
    }
    
    refreshCharacterList();
});