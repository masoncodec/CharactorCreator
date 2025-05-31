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

// Save character to IndexedDB (now uses put for upsert functionality)
function saveCharacter(character) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            // Changed from store.add(character) to store.put(character)
            const request = store.put(character); 
            
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
            
            const request = store.openCursor(null, 'prev'); // Get the last (most recent) character
            let character = null;
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    character = cursor.value;
                }
                resolve(character);
            };
            request.onerror = () => reject('Error getting current character');
        });
    });
}

// Export ALL character data
function exportAllCharacters() {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const getAllRequest = store.getAll();

            getAllRequest.onsuccess = () => {
                if (getAllRequest.result.length === 0) {
                    resolve(null); // No characters to export
                    return;
                }
                const dataStr = JSON.stringify(getAllRequest.result, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const filename = `all_characters_${new Date().toISOString().slice(0, 10)}.json`;
                resolve({ url, filename, data: getAllRequest.result });
            };
            getAllRequest.onerror = () => reject('Error exporting all characters');
        });
    });
}

// Export a SINGLE character by ID
function exportCharacter(id, characterName) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const character = getRequest.result;
                if (!character) {
                    resolve(null); // Character not found
                    return;
                }
                const dataStr = JSON.stringify(character, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                // Sanitize character name for filename and then capitalize the first letter
                let safeCharacterName = (characterName || 'character').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                if (safeCharacterName.length > 0) {
                    safeCharacterName = safeCharacterName.charAt(0).toUpperCase() + safeCharacterName.slice(1);
                }
                const filename = `${safeCharacterName}_${new Date().toISOString().slice(0, 10)}.json`;
                resolve({ url, filename, data: character });
            };
            getRequest.onerror = () => reject('Error exporting character');
        });
    });
}

// Import character data
function importCharacter(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                // Ensure importedData is always an array, even if a single object is imported
                const charactersToImport = Array.isArray(importedData) ? importedData : [importedData];

                openDB().then(db => {
                    const transaction = db.transaction(STORE_NAME, 'readwrite');
                    const store = transaction.objectStore(STORE_NAME);
                    
                    let importCount = 0;
                    let errorCount = 0;

                    charactersToImport.forEach(char => {
                        const request = store.put(char); // Use put for import (upsert)
                        request.onsuccess = () => importCount++;
                        request.onerror = (e) => {
                            console.error('Error importing character:', char, e);
                            errorCount++;
                        };
                    });

                    transaction.oncomplete = () => resolve({ importCount, errorCount });
                    transaction.onerror = () => reject('Transaction error during import');
                }).catch(reject);
            } catch (e) {
                reject('Error parsing JSON file: ' + e.message);
            }
        };
        reader.onerror = () => reject('Error reading file');
        reader.readAsText(file);
    });
}


// Get all characters
function getAllCharacters() {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject('Error getting all characters');
        });
    });
}

// Delete a character by ID
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

// Set active character in local storage
function setActiveCharacter(id) {
    localStorage.setItem('activeCharacterId', id);
    return Promise.resolve();
}

// Get active character from IndexedDB based on ID in local storage
function getActiveCharacter() {
    const activeId = parseInt(localStorage.getItem('activeCharacterId'));
    if (isNaN(activeId)) {
        return Promise.resolve(null); // No active character set
    }

    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(activeId);
            
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
    exportAllCharacters, // Changed this
    exportCharacter,     // Added this
    importCharacter,
    getAllCharacters,
    deleteCharacter,
    setActiveCharacter,
    getActiveCharacter,
    updateCharacterHealth
};