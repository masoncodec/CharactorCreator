// equipmentAndLootPageHandler.js
// REFACTORED: Now a thin wrapper around the generic DirectContentPageHandler.

import { DirectContentPageHandler } from './DirectContentPageHandler.js';

// Configuration specific to the Equipment & Loot page
const equipmentAndLootConfig = {
  pageName: 'Equipment & Loot',
  sourceId: 'equipment-and-loot',
  definitionKey: 'equipmentAndLootDef'
};

class EquipmentAndLootPageHandler extends DirectContentPageHandler {
  constructor(stateManager) {
    super(stateManager, equipmentAndLootConfig);
  }

   // You can override methods here if needed, just like in the other handler.
}

export { EquipmentAndLootPageHandler };