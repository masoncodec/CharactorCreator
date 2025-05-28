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
    highlightActiveNav('character-sheet.html'); // Highlight "Character" link

    db.getActiveCharacter().then(function(character) {
        const characterSheetContent = document.getElementById('characterSheetContent');
        
        if (character) {
            characterSheetContent.innerHTML = `
                <div class="character-header">
                    <h3>${character.name}</h3>
                    <p class="character-module">${character.module || 'Crescendo'}</p>
                    <p class="character-role">${character.destiny}</p>
                </div>
                
                ${character.selectedFlaw ? `
                <div class="character-flaw">
                    <h4>Selected Flaw</h4>
                    <p>${character.selectedFlaw.charAt(0).toUpperCase() + character.selectedFlaw.slice(1)}</p>
                </div>
                ` : ''}

                ${character.bio ? `
                <div class="character-bio">
                    <h4>Background</h4>
                    <p>${character.bio}</p>
                </div>
                ` : ''}

                ${character.inventory && character.inventory.length > 0 ? `
                <div class="character-inventory">
                    <h4>Inventory</h4>
                    <ul>
                        ${character.inventory.map(item => `<li>${item.name}</li>`).join('')}
                    </ul>
                </div>
                ` : '<div class="character-inventory"><h4>Inventory</h4><p>No inventory items.</p></div>'}
            `;
        } else {
            characterSheetContent.innerHTML = '<p>No character selected. <a href="character-selector.html">Choose one first</a></p>';
        }
    }).catch(function(err) {
        console.error('Error loading character:', err);
    });
});