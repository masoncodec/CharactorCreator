// purposePageHandler.js
// This module handles the 'purpose' selection page by extending the generic ChoicePageHandler.

import { ChoicePageHandler } from './ChoicePageHandler.js';

const purposeConfig = {
  stateKey: 'purpose',
  pageName: 'Purpose',
  optionsContainerId: '#purpose-options-container',
  optionClassName: '.purpose-option',
  dataAttribute: 'data-purpose-id',
  contentScrollAreaClass: '.purpose-content-scroll-area',
  getDataMethodName: 'getPurpose',
  getOptionsKey: 'purposes'
};

class PurposePageHandler extends ChoicePageHandler {
  constructor(stateManager) {
    super(stateManager, purposeConfig);
  }

  // No overrides needed; inherits all functionality from ChoicePageHandler.
}

export { PurposePageHandler };
