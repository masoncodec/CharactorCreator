// nurturePageHandler.js
// This module handles the 'nurture' selection page by extending the generic ChoicePageHandler.

import { ChoicePageHandler } from './ChoicePageHandler.js';

const nurtureConfig = {
  stateKey: 'nurture',
  pageName: 'Nurture',
  optionsContainerId: '#nurture-options-container',
  optionClassName: '.nurture-option',
  dataAttribute: 'data-nurture-id',
  contentScrollAreaClass: '.nurture-content-scroll-area',
  getDataMethodName: 'getNurture',
  getOptionsKey: 'nurtures'
};

class NurturePageHandler extends ChoicePageHandler {
  constructor(stateManager) {
    super(stateManager, nurtureConfig);
  }

  // No overrides needed; inherits all functionality from ChoicePageHandler.
}

export { NurturePageHandler };
