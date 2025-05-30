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

// Export character data
//TODO: THIS IS EXPORT ALL CHARACTERS -> change back
function exportCharacter() {
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
                const filename = `character_data_${new Date().toISOString().slice(0, 10)}.json`;
                resolve({ url, filename, data: getAllRequest.result });
            };
            getAllRequest.onerror = () => reject('Error exporting characters');
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
                if (!Array.isArray(importedData)) {
                    reject('Invalid JSON format: Expected an array of characters.');
                    return;
                }
                openDB().then(db => {
                    const transaction = db.transaction(STORE_NAME, 'readwrite');
                    const store = transaction.objectStore(STORE_NAME);
                    
                    let importCount = 0;
                    let errorCount = 0;

                    // Clear existing data (optional, but often desired for full import)
                    // const clearRequest = store.clear();
                    // clearRequest.onsuccess = () => { /* proceed with import */ };
                    // clearRequest.onerror = () => reject('Error clearing existing data');

                    importedData.forEach(char => {
                        // Ensure unique IDs for imported characters if not managed
                        // or if they might conflict with autoIncrement
                        // For simplicity, directly put (upsert) here, assuming IDs are managed
                        const request = store.put(char); // Use put for import too
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
    exportCharacter,
    importCharacter,
    getAllCharacters,
    deleteCharacter,
    setActiveCharacter,
    getActiveCharacter,
    updateCharacterHealth
};