// pageNavigator.js
// This module manages the wizard's page navigation,
// handling UI interactions and determining page accessibility.
// THIS VERSION IS UPDATED to automatically validate page completion on every state change.

import { alerter } from '../alerter.js';

class PageNavigator {
  /**
   * @param {string[]} pages - An array of page names in order.
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   * @param {Function} callbacks.loadPage - Callback to load a specific page.
   */
  constructor(pages, stateManager, { loadPage }) {
    this.pages = pages;
    this.stateManager = stateManager;
    this.currentPageIndex = 0;
    this.loadPageCallback = loadPage;

    this.navItems = document.querySelectorAll('.nav-item');
    this.prevBtn = document.getElementById('prevBtn');
    this.nextBtn = document.getElementById('nextBtn');
    
    // Bind the event handler to the class instance for proper removal on cleanup.
    this._boundUpdateNav = this.updateNav.bind(this);

    console.log('PageNavigator: Initialized.');
  }

  /**
   * Sets the current page index.
   * @param {number} index - The index of the current page.
   */
  setCurrentPage(index) {
    this.currentPageIndex = index;
  }

  /**
   * Initializes event listeners for navigation buttons and sidebar items.
   */
  initNavListeners() {
    console.log('PageNavigator.initNavListeners: Setting up event listeners.');

    this.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        if (item.classList.contains('disabled')) {
          const reason = item.title || "Cannot access this page yet.";
          alerter.show(reason);
          return;
        }
        this.goToPage(item.dataset.page);
      });
    });

    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.prevPage());
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.nextPage());
    }
    
    // --- THIS IS THE FIX ---
    // Listen for the global state change event and call updateNav to re-validate completion.
    document.addEventListener('wizard:stateChange', this._boundUpdateNav);
  }

  /**
   * Updates the visual state of navigation items and buttons.
   * This is now called automatically on every state change.
   */
  updateNav() {
    const currentState = this.stateManager.getState();

    this.navItems.forEach(item => {
      const page = item.dataset.page;
      const index = this.pages.indexOf(page);
      
      const canAccess = this._canAccessPage(index, currentState);
      const isCompleted = this.isPageCompleted(page, currentState); // Public for finisher access

      item.classList.toggle('disabled', !canAccess);
      item.classList.toggle('active', index === this.currentPageIndex);
      item.classList.toggle('completed', isCompleted);

      item.title = canAccess ? '' : this._getNavigationBlockReason(index, currentState);
    });

    if (this.prevBtn) {
        this.prevBtn.disabled = this.currentPageIndex === 0;
    }
    if (this.nextBtn) {
        this.nextBtn.textContent =
        this.currentPageIndex === this.pages.length - 1 ? 'Finish' : 'Next';
    }
  }

  /**
   * Determines if a page can be accessed.
   * @private
   */
  _canAccessPage(index, currentState) {
    if (index === 0) return true; // Always allow access to the first page
    if (!currentState.module) return false; // Module must be selected for all subsequent pages
    return true;
  }

  /**
   * Provides a reason why a navigation item is blocked.
   * @private
   */
  _getNavigationBlockReason(index, currentState) {
    if (!currentState.module) return "Select a module first";
    return "";
  }

  /**
   * Checks if a page is considered completed based on the current state.
   * @param {string} page - The name of the page to check.
   * @param {Object} currentState - The current wizard state.
   * @returns {boolean} True if the page is completed, false otherwise.
   */
  isPageCompleted(page, currentState) {
    switch (page) {
      case 'module':
        return !!currentState.module;
      case 'frame':
        return true;
      case 'destiny':
        return this._validateDestinyCompletion(currentState);
      // This case now uses the dynamic attribute data from the module.
      case 'attributes': {
        if (!currentState.module) return false;
        const moduleDef = this.stateManager.getModule(currentState.module);
        const attrConfig = moduleDef?.attributes;
        // The page is complete if the module doesn't define attributes, or if all defined attributes have been assigned.
        if (!attrConfig || !attrConfig.names) return true;
        
        return attrConfig.names.every(attrName => {
            const assignedValue = currentState.attributes[attrName.toLowerCase()];
            return assignedValue !== undefined && assignedValue !== null;
        });
      }
      case 'flaws-and-perks': {
        const allItemDefs = this.stateManager.getItemData();
        const choicesComplete = currentState.selections
          .filter(sel => sel.source.startsWith('independent-'))
          .every(sel => {
            const itemDef = allItemDefs[sel.id];
            if (itemDef?.options && itemDef.maxChoices) {
              return sel.selections.length === itemDef.maxChoices;
            }
            return true;
          });
        const flawPoints = this.stateManager.getIndependentFlawTotalWeight();
        const perkPoints = this.stateManager.getIndependentPerkTotalWeight();
        const pointsValid = perkPoints <= flawPoints;
        return choicesComplete && pointsValid;
      }
      case 'equipment-and-loot':
        return true;
      case 'info':
        return !!currentState.info.name?.trim();
      default:
        return false;
    }
  }

  /**
   * Validates if the destiny page is complete using the new state structure.
   * @private
   */
  _validateDestinyCompletion(currentState) {
    if (!currentState.destiny) return false;
    const destinyDef = this.stateManager.getDestiny(currentState.destiny);
    if (!destinyDef || !destinyDef.choiceGroups) return false;
    const allItemDefs = this.stateManager.getItemData();

    return Object.entries(destinyDef.choiceGroups).every(([groupId, groupDef]) => {
      const selectionsInGroup = currentState.selections.filter(
        sel => sel.source === `destiny-${groupId}`
      );
      if (selectionsInGroup.length !== groupDef.maxChoices) {
        return false;
      }
      return selectionsInGroup.every(sel => {
        const itemDef = allItemDefs[sel.id];
        if (itemDef?.options && itemDef.maxChoices) {
          return sel.selections.length === itemDef.maxChoices;
        }
        return true;
      });
    });
  }

  /**
   * Navigates to a specific page by name.
   */
  goToPage(pageName) {
    const pageIndex = this.pages.indexOf(pageName);
    if (pageIndex !== -1 && this._canAccessPage(pageIndex, this.stateManager.getState())) {
      this.loadPageCallback(pageName);
    }
  }

  /**
   * Navigates to the next page in the sequence.
   */
  nextPage() {
    const currentPageName = this.pages[this.currentPageIndex];
    if (!this.isPageCompleted(currentPageName, this.stateManager.getState())) {
      this.showPageError(currentPageName);
      return;
    }
    if (this.currentPageIndex < this.pages.length - 1) {
      this.loadPageCallback(this.pages[this.currentPageIndex + 1]);
    } else {
      document.dispatchEvent(new CustomEvent('wizard:finish'));
    }
  }

  /**
   * Navigates to the previous page in the sequence.
   */
  prevPage() {
    if (this.currentPageIndex > 0) {
      this.loadPageCallback(this.pages[this.currentPageIndex - 1]);
    }
  }

  /**
   * Returns a user-friendly error message for an incomplete page.
   */
  getCompletionError(pageName) {
    const errorMap = {
      module: 'Please select a module to continue.',
      destiny: 'Please select a Destiny and ensure all choices are complete (including for abilities, flaws, and equipment).',
      attributes: 'Please assign a value to all attributes.',
      'flaws-and-perks': 'Please complete all required nested flaw/perk selections and ensure Perk Points do not exceed Flaw Points.',
      info: "Please enter your character's name."
    };
    return errorMap[pageName] || `The '${pageName}' page has an unresolved validation issue.`;
  }

  /**
   * Displays an error message for an incomplete page.
   */
  showPageError(pageName) {
    const message = this.getCompletionError(pageName);
    console.error(`PageNavigator.showPageError: Displaying error for page '${pageName}': ${message}`);
    alerter.show(message, 'error');
  }
  
  /**
   * Removes event listeners to prevent memory leaks.
   */
  cleanup() {
      document.removeEventListener('wizard:stateChange', this._boundUpdateNav);
  }
}

export { PageNavigator };