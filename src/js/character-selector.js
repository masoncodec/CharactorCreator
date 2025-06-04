document.addEventListener('DOMContentLoaded', function() {
    const charactersList = document.getElementById('charactersList');
    const importCharacterBtn = document.getElementById('importCharacterBtn');
    const importFileInput = document.getElementById('importFileInput');
    const importMessageArea = document.getElementById('importMessage');
    const exportAllCharactersBtn = document.getElementById('exportAllCharactersBtn'); // New: Get the export all button

    function showMessage(message, type) {
        importMessageArea.textContent = message;
        importMessageArea.className = `message-area ${type}`; // Add a class for styling (e.g., 'success', 'error')
        setTimeout(() => {
            importMessageArea.textContent = '';
            importMessageArea.className = 'message-area';
        }, 5000); // Clear message after 5 seconds
    }
    
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
                    <p>Module: ${character.module || 'N/A'}</p>
                    <p>Destiny: ${character.destiny || 'N/A'}</p>
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
                            showMessage('Error deleting character: ' + err, 'error');
                        });
                    }
                });
            });
        }).catch(function(err) {
            console.error('Error loading characters:', err);
            charactersList.innerHTML = '<p class="error">Error loading characters. Please refresh the page.</p>';
        });
    }

    // Event listener for the Import Character button
    importCharacterBtn.addEventListener('click', function() {
        importFileInput.click(); // Programmatically click the hidden file input
    });

    // Event listener for when a file is selected
    importFileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            db.importCharacter(file).then(function(result) {
                if (result.errorCount === 0) {
                    showMessage(`Successfully imported ${result.importCount} character(s)!`, 'success');
                } else {
                    showMessage(`Import completed with ${result.importCount} successes and ${result.errorCount} error(s). Check console for details.`, 'warning');
                }
                refreshCharacterList(); // Refresh the list to show imported characters
            }).catch(function(err) {
                showMessage('Error importing character: ' + err, 'error');
                console.error('Import error:', err);
            });
        }
        // Clear the file input value so that the same file can be selected again if needed
        event.target.value = ''; 
    });

    // New: Event listener for Export All Characters button
    exportAllCharactersBtn.addEventListener('click', function() {
        db.exportAllCharacters().then(function(exportData) {
            if (!exportData) {
                showMessage('No characters to export.', 'warning');
                return;
            }
            const a = document.createElement('a');
            a.href = exportData.url;
            a.download = exportData.filename;
            document.body.appendChild(a); // Append to body to make it clickable in all browsers
            a.click();
            document.body.removeChild(a); // Clean up
            setTimeout(function() {
                URL.revokeObjectURL(exportData.url);
            }, 100);
            showMessage('All characters exported successfully!', 'success');
        }).catch(function(err) {
            showMessage('Error exporting all characters: ' + err, 'error');
            console.error('Export all failed:', err);
        });
    });
    
    refreshCharacterList();
});