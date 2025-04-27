// db.js - IndexedDB utility functions (traditional script version)
const DB_NAME = 'TTRPG_DB';
const DB_VERSION = 1;
const STORE_NAME = 'characters';

// Open or create the database
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject('Database error: ' + request.error);
        
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// Save character to IndexedDB
function saveCharacter(character) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.add(character);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject('Error saving character');
        });
    });
}

// Get the most recent character
function getCurrentCharacter() {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.openCursor(null, 'prev'); // Get last added
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                resolve(cursor ? cursor.value : null);
            };
            
            request.onerror = () => reject('Error getting character');
        });
    });
}

// Export character to JSON file
function exportCharacter() {
    return getCurrentCharacter().then(character => {
        if (!character) return null;
        
        // Create a deep copy of the character without the id
        const exportData = JSON.parse(JSON.stringify(character));
        
        // Remove internal DB fields
        delete exportData.id;
        
        // Ensure we have all important fields
        if (!exportData.stats) {
            exportData.stats = {
                strength: 10,
                dexterity: 10,
                constitution: 10,
                intelligence: 10,
                wisdom: 10,
                charisma: 10
            };
        }
        
        if (!exportData.health) {
            exportData.health = {
                current: 10,
                max: 10,
                temporary: 0
            };
        }
        
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        return {
            url,
            filename: `character_${character.name || 'unknown'}.json`,
            data: exportData
        };
    });
}

// Import character from JSON file
function importCharacter(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            try {
                const character = JSON.parse(event.target.result);
                
                // Remove the id if it exists
                if (character.id) {
                    delete character.id;
                }
                
                // Set default values for required fields if missing
                if (!character.name) character.name = "Unnamed Character";
                if (!character.role) character.role = "Adventurer";
                
                // Ensure stats exist
                if (!character.stats) {
                    character.stats = {
                        strength: 10,
                        dexterity: 10,
                        constitution: 10,
                        intelligence: 10,
                        wisdom: 10,
                        charisma: 10
                    };
                }
                
                // Ensure health exists
                if (!character.health) {
                    character.health = {
                        current: 10,
                        max: 10,
                        temporary: 0
                    };
                }
                
                // Set creation date
                character.createdAt = new Date().toISOString();
                
                // Save the character
                saveCharacter(character).then(id => {
                    resolve({ ...character, id });
                }).catch(err => {
                    console.error('Detailed save error:', err);
                    reject('Error saving character. Check console for details.');
                });
            } catch (err) {
                console.error('Import parsing error:', err);
                reject('Invalid character file: ' + err.message);
            }
        };
        
        reader.onerror = () => {
            reject('Error reading file');
        };
        reader.readAsText(file);
    });
}

function getAllCharacters() {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject('Error getting characters');
        });
    });
}

function deleteCharacter(id) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject('Error deleting character');
        });
    });
}

function setActiveCharacter(id) {
    localStorage.setItem('activeCharacterId', id);
}

function getActiveCharacter() {
    const activeId = localStorage.getItem('activeCharacterId');
    if (!activeId) return null;
    
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(Number(activeId));
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject('Error getting active character');
        });
    });
}

function updateCharacterHealth(id, healthUpdate) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const getRequest = store.get(id);
            
            getRequest.onsuccess = function() {
                const character = getRequest.result;
                if (!character) {
                    reject('Character not found');
                    return;
                }
                
                character.health = {
                    ...character.health,
                    ...healthUpdate
                };
                
                const putRequest = store.put(character);
                
                putRequest.onsuccess = () => resolve(character);
                putRequest.onerror = () => reject('Error updating health');
            };
            
            getRequest.onerror = () => reject('Error finding character');
        });
    });
}

// Make functions available globally
window.db = {
    saveCharacter,
    getCurrentCharacter,
    exportCharacter,
    importCharacter,
    getAllCharacters,
    deleteCharacter,
    setActiveCharacter,
    getActiveCharacter,
    updateCharacterHealth
};