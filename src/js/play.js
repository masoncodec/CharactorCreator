// Initialize play page
document.addEventListener('DOMContentLoaded', () => {
    // Load saved character
    const savedCharacter = localStorage.getItem('currentCharacter');
    const characterDetails = document.getElementById('characterDetails');
    
    if(savedCharacter) {
        const character = JSON.parse(savedCharacter);
        characterDetails.innerHTML = `
            <h3>${character.name}</h3>
            <p>Role: ${character.role}</p>
        `;
    } else {
        characterDetails.innerHTML = '<p>No character found. <a href="character-creator.html">Create one first</a></p>';
    }

    // Dice roller functionality
    document.getElementById('rollD20').addEventListener('click', () => {
        const result = Math.floor(Math.random() * 20) + 1;
        const diceResult = document.getElementById('diceResult');
        
        diceResult.textContent = '...';
        setTimeout(() => {
            diceResult.textContent = result;
        }, 500);
    });
});