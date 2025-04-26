document.getElementById('characterForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const character = {
        name: document.getElementById('characterName').value,
        role: document.getElementById('characterRole').value
    };
    
    localStorage.setItem('currentCharacter', JSON.stringify(character));
    window.location.href = 'play.html';
});