// pageNavigator.js
// This module manages the wizard's page navigation,
// handling UI interactions and determining page accessibility.

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
  }

  /**
   * Updates the visual state of navigation items and buttons.
   */
  updateNav() {
    const currentState = this.stateManager.getState();

    this.navItems.forEach(item => {
      const page = item.dataset.page;
      const index = this.pages.indexOf(page);
      
      // Page accessibility and completion are now checked against the current state
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
   * THIS IS THE PRIMARY REFACTORED METHOD.
   * @param {string} page - The name of the page to check.
   * @param {Object} currentState - The current wizard state.
   * @returns {boolean} True if the page is completed, false otherwise.
   */
  isPageCompleted(page, currentState) {
    switch (page) {
      case 'module':
        return !!currentState.module;

      case 'frame':
        return true; // Frame page is informational

      case 'destiny':
        return this._validateDestinyCompletion(currentState);

      case 'attributes': {
        if (!currentState.module) return false;
        const moduleDef = this.stateManager.getModule(currentState.module);
        if (!moduleDef || !moduleDef.attributes) return false;
        // Checks that every required attribute has been assigned a die
        return moduleDef.attributes.every(attr => currentState.attributes[attr.toLowerCase()]);
      }

      case 'flaws-and-perks': {
        const allItemDefs = this.stateManager.getItemData();
        // Check that all selected items with nested options have fulfilled them
        const choicesComplete = currentState.selections
          .filter(sel => sel.source.startsWith('independent-'))
          .every(sel => {
            const itemDef = allItemDefs[sel.id];
            // If the item has options, the number of chosen options must match the requirement
            if (itemDef?.options && itemDef.maxOptionChoices) {
              return sel.selections.length === itemDef.maxOptionChoices;
            }
            return true; // No options to validate
          });
        
        // Check that perk points do not exceed flaw points
        const flawPoints = this.stateManager.getIndependentFlawTotalWeight();
        const perkPoints = this.stateManager.getIndependentPerkTotalWeight();
        const pointsValid = perkPoints <= flawPoints;

        return choicesComplete && pointsValid;
      }

      case 'equipment-and-loot':
        return true; // This page has no hard requirements for completion

      case 'info':
        return !!currentState.info.name?.trim(); // Must have a character name

      default:
        return false;
    }
  }

  /**
   * REFACTORED: Validates if the destiny page is complete using the new state structure.
   * @private
   */
  _validateDestinyCompletion(currentState) {
    if (!currentState.destiny) return false;

    const destinyDef = this.stateManager.getDestiny(currentState.destiny);
    if (!destinyDef || !destinyDef.choiceGroups) return false;
    
    const allItemDefs = this.stateManager.getItemData();

    // Check every choice group defined by the destiny
    return Object.entries(destinyDef.choiceGroups).every(([groupId, groupDef]) => {
      // Get all items selected for this specific group (e.g., 'destiny-flaws')
      const selectionsInGroup = currentState.selections.filter(
        sel => sel.source === `destiny-${groupId}`
      );
      
      // 1. Check if the correct number of items were chosen from the group
      if (selectionsInGroup.length !== groupDef.maxChoices) {
        return false;
      }

      // 2. For each chosen item, check if its own nested options are complete
      return selectionsInGroup.every(sel => {
        const itemDef = allItemDefs[sel.id];
        if (itemDef?.options && itemDef.maxOptionChoices) {
          return sel.selections.length === itemDef.maxOptionChoices;
        }
        return true; // Item has no nested options to validate
      });
    });
  }

  /**
   * Navigates to a specific page by name.
   * @param {string} pageName - The name of the page to navigate to.
   */
  goToPage(pageName) {
    const pageIndex = this.pages.indexOf(pageName);
    if (pageIndex !== -1 && this._canAccessPage(pageIndex, this.stateManager.getState())) {
      this.loadPageCallback(pageName);
    } else {
      console.warn(`PageNavigator.goToPage: Attempted to go to inaccessible or unknown page: ${pageName}`);
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
      // Dispatch event for the CharacterFinisher to pick up
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
   * @param {string} pageName - The name of the page with the error.
   * @returns {string} The error message.
   */
  getCompletionError(pageName) {
    const errorMap = {
      module: 'Please select a module to continue.',
      destiny: 'Please select a Destiny and ensure all choices are complete (including for abilities, flaws, and equipment).',
      attributes: 'Please assign dice to all attributes.',
      'flaws-and-perks': 'Please complete all required nested flaw/perk selections and ensure Perk Points do not exceed Flaw Points.',
      info: "Please enter your character's name."
    };
    return errorMap[pageName] || `The '${pageName}' page has an unresolved validation issue.`;
  }

  /**
   * Displays an error message for an incomplete page.
   * @param {string} pageName - The name of the page with the error.
   */
  showPageError(pageName) {
    const message = this.getCompletionError(pageName);
    console.error(`PageNavigator.showPageError: Displaying error for page '${pageName}': ${message}`);
    alerter.show(message, 'error');
  }
}

export { PageNavigator };