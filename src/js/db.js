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
        
        // Create clean export object without internal DB fields
        const exportData = {
            name: character.name,
            role: character.role,
            // Add other character properties you want to export
            createdAt: character.createdAt || new Date().toISOString()
        };
        
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
                
                // Remove the id if it exists to avoid duplicate key errors
                if (character.id) {
                    delete character.id;
                }
                
                // Add timestamp
                character.createdAt = new Date().toISOString();
                
                // Validate required fields
                if (!character.name || !character.role) {
                    throw new Error('Character missing required fields (name, role)');
                }
                
                // Save the cleaned character
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

// Make functions available globally
window.db = {
    saveCharacter,
    getCurrentCharacter,
    exportCharacter,
    importCharacter,
    getAllCharacters,
    deleteCharacter,
    setActiveCharacter,
    getActiveCharacter
};