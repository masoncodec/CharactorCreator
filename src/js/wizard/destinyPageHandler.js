// destinyPageHandler.js
// This module handles the 'destiny' selection page by extending the generic ChoicePageHandler.

import { ChoicePageHandler } from './ChoicePageHandler.js';

const destinyConfig = {
  stateKey: 'destiny',
  pageName: 'Destiny',
  optionsContainerId: '#destiny-options-container',
  optionClassName: '.destiny-option',
  dataAttribute: 'data-destiny-id',
  contentScrollAreaClass: '.destiny-content-scroll-area',
  getDataMethodName: 'getDestiny',
  getOptionsKey: 'destinies'
};

class DestinyPageHandler extends ChoicePageHandler {
  constructor(stateManager) {
    super(stateManager, destinyConfig);
  }

  /**
   * Overrides the base method to add destiny-specific content like health stats.
   * @param {object} destinyDef - The full definition of the currently selected destiny.
   * @returns {string} The additional HTML content for the informer panel.
   * @private
   */
  _getAdditionalInformerContent(destinyDef) {
    if (destinyDef && destinyDef.health) {
      return `<div class="stats"><strong>Health:</strong> ${destinyDef.health.title} (${destinyDef.health.value})</div>`;
    }
    return '';
  }
}

export { DestinyPageHandler };
