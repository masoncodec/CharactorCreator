// pageNavigator.js
// This module manages the wizard's page navigation,
// handling UI interactions and determining page accessibility.

import { alerter } from '../alerter.js'; // Assuming alerter.js is available

class PageNavigator {
  /**
   * @param {string[]} pages - An array of page names in order.
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   * @param {Function} callbacks.loadPage - Callback to load a specific page.
   */
  constructor(pages, stateManager, { loadPage }) {
    this.pages = pages;
    this.stateManager = stateManager;
    this.currentPageIndex = 0; // Tracks the current page by its index
    this.loadPageCallback = loadPage; // Callback to trigger page loading in CharacterWizard

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
          console.log(`PageNavigator.initNavListeners: Navigation to page ${item.dataset.page} is disabled. Reason: ${reason}`);
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
    console.log('PageNavigator.updateNav: Updating navigation state and buttons.');
    const currentState = this.stateManager.getState(); // Get a snapshot of the current state

    this.navItems.forEach(item => {
      const page = item.dataset.page;
      const index = this.pages.indexOf(page);
      const canAccess = this.canAccessPage(index, currentState); // Pass current state for validation
      const isCompleted = this.isPageCompleted(page, currentState); // Pass current state for validation

      item.classList.toggle('disabled', !canAccess);
      item.classList.toggle('active', index === this.currentPageIndex);
      item.classList.toggle('completed', isCompleted);

      if (!canAccess) {
        const reason = this.getNavigationBlockReason(index, currentState);
        item.title = reason;
        // console.log(`PageNavigator.updateNav: Page ${page} disabled. Reason: ${reason}`);
      } else {
        item.removeAttribute('title');
      }
    });

    if (this.prevBtn) {
        this.prevBtn.disabled = this.currentPageIndex === 0;
    }
    if (this.nextBtn) {
        this.nextBtn.textContent =
        this.currentPageIndex === this.pages.length - 1 ? 'Finish' : 'Next';
    }
    // console.log(`PageNavigator.updateNav: Prev button disabled: ${this.prevBtn?.disabled}, Next button text: ${this.nextBtn?.textContent}`);
  }

  /**
   * Determines if a page can be accessed.
   * @param {number} index - The index of the page to check.
   * @param {Object} currentState - The current wizard state.
   * @returns {boolean} True if the page can be accessed, false otherwise.
   */
  canAccessPage(index, currentState) {
    // Always allow access to the first page (module) and last page (info)
    if (index === 0 || index === this.pages.length - 1) {
      return true;
    }

    // For other pages, require module selection
    if (!currentState.module) {
      return false;
    }

    return true;
  }

  /**
   * Provides a reason why a navigation item is blocked.
   * @param {number} index - The index of the page.
   * @param {Object} currentState - The current wizard state.
   * @returns {string} The reason message.
   */
  getNavigationBlockReason(index, currentState) {
    if (index === this.pages.length - 1) return "Enter basic details anytime";
    if (!currentState.module) return "Select a module first";
    return "";
  }

  /**
   * Checks if a page is considered completed based on the current state.
   * This logic is now centralized here for navigation completion checks.
   * @param {string} page - The name of the page to check.
   * @param {Object} currentState - The current wizard state.
   * @returns {boolean} True if the page is completed, false otherwise.
   */
  isPageCompleted(page, currentState) {
    let completed = false;
    switch (page) {
      case 'module':
        completed = !!currentState.module;
        break;
      case 'destiny':
        completed = this.validateDestinyCompletion(currentState);
        break;
      case 'attributes':
        if (!currentState.module) {
          completed = false;
        } else {
          const moduleDefinition = this.stateManager.getModule(currentState.module);
          if (!moduleDefinition || !moduleDefinition.attributes) {
            completed = false; // Module data might be missing attributes
          } else {
            const requiredAttrs = moduleDefinition.attributes;
            // A page is completed if all required attributes have a die assigned
            completed = requiredAttrs.every(attr =>
              currentState.attributes[attr.toLowerCase()]
            );
          }
        }
        break;
      case 'flaws': // New case for 'flaw' page
        // For the bare-bones version, we'll consider it complete to allow navigation
        completed = true; 
        break;
      case 'info':
        completed = !!currentState.info.name?.trim();
        break;
      default:
        completed = false;
    }
    // console.log(`PageNavigator.isPageCompleted: Page '${page}' is completed: ${completed}.`);
    return completed;
  }

  /**
   * Validates if the destiny page (including flaws and ability groups) is complete.
   * This is a helper for `isPageCompleted`.
   * @param {Object} currentState - The current wizard state.
   * @returns {boolean} True if destiny page is complete, false otherwise.
   */
  validateDestinyCompletion(currentState) {
    if (!currentState.destiny) {
        console.log('Validation (Destiny): No destiny selected.');
        return false;
    }

    const destinyDefinition = this.stateManager.getDestiny(currentState.destiny);
    if (!destinyDefinition || !destinyDefinition.abilityGroups) {
        console.warn('PageNavigator.validateDestinyCompletion: Destiny data or ability groups missing for:', currentState.destiny);
        return false;
    }

    const allGroupsComplete = Object.entries(destinyDefinition.abilityGroups).every(([groupId, groupDef]) => {
      let selectedItemsInGroup;

      // Determine which state array to check based on groupId
      if (groupId === 'flaws') {
        selectedItemsInGroup = currentState.flaws.filter(item => item.groupId === groupId && item.source === 'destiny');
      } else {
        selectedItemsInGroup = currentState.abilities.filter(item => item.groupId === groupId && item.source === 'destiny');
      }

      if (selectedItemsInGroup.length !== groupDef.maxChoices) {
        console.log(`Validation (Destiny): Group '${groupDef.name}' (${groupId}) incomplete. Expected ${groupDef.maxChoices}, got ${selectedItemsInGroup.length}.`);
        return false;
      }

      // For each selected item in the group, validate its nested options
      const nestedOptionsComplete = selectedItemsInGroup.every(itemState => {
        // Use getAbilityOrFlawData and ensure the 'this' context is bound
        const itemDef = this.stateManager.getAbilityOrFlawData.bind(this.stateManager)(itemState.id, itemState.groupId);

        // If itemDef or itemDef.options is missing, or maxChoices is not defined, assume no nested options or they are not required.
        if (!itemDef || !itemDef.options || itemDef.maxChoices === undefined || itemDef.maxChoices === null) {
          return true;
        }
        return itemState.selections.length === itemDef.maxChoices;
      });

      if (!nestedOptionsComplete) {
        console.log(`Validation (Destiny): Nested options incomplete for an item in group '${groupDef.name}' (${groupId}).`);
        return false;
      }

      return true; // This group is complete
    });

    console.log("Validation (Destiny): All groups completed:", allGroupsComplete);

    return allGroupsComplete;
  }


  /**
   * Navigates to a specific page by name.
   * @param {string} pageName - The name of the page to navigate to.
   */
  goToPage(pageName) {
    const pageIndex = this.pages.indexOf(pageName);
    if (pageIndex !== -1 && this.canAccessPage(pageIndex, this.stateManager.getState())) {
      console.log(`PageNavigator.goToPage: Navigating to page: ${pageName}`);
      this.loadPageCallback(pageName); // Use the callback to trigger the page load in CharacterWizard
    } else {
      console.warn(`PageNavigator.goToPage: Attempted to go to inaccessible or unknown page: ${pageName}`);
      // Error message already shown by event listener check for disabled items
    }
  }

  /**
   * Navigates to the next page in the sequence.
   */
  nextPage() {
    const currentPageName = this.pages[this.currentPageIndex];
    const currentState = this.stateManager.getState();

    // Check if the current page is completed before allowing navigation to the next
    if (!this.isPageCompleted(currentPageName, currentState)) {
      console.warn(`PageNavigator.nextPage: Current page '${currentPageName}' is not completed. Blocking navigation.`);
      this.showPageError(currentPageName); // Show specific error for incomplete page
      return;
    }

    if (this.currentPageIndex < this.pages.length - 1) {
      const nextPageName = this.pages[this.currentPageIndex + 1];
      console.log(`PageNavigator.nextPage: Moving to next page: ${nextPageName}`);
      this.loadPageCallback(nextPageName);
    } else {
      console.log('PageNavigator.nextPage: End of wizard, attempting to finish.');
      // When 'Finish' is clicked, the main CharacterWizard class will handle the final validation/saving
      // It assumes the CharacterWizard has a public finishWizard() method.
      // This is passed implicitly through the `this` context when CharacterWizard calls `this.pageNavigator.initNavListeners()`
      // and `nextPage` is called directly by the button listener, which means `this` refers to PageNavigator.
      // We need a specific callback for 'finish' action, or pass it to CharacterWizard directly.
      // For now, let's assume CharacterWizard explicitly calls `finishWizard` when nextBtn is 'Finish'.
      document.dispatchEvent(new CustomEvent('wizard:finish')); // Custom event for finish
    }
  }

  /**
   * Navigates to the previous page in the sequence.
   */
  prevPage() {
    if (this.currentPageIndex > 0) {
      const prevPageName = this.pages[this.currentPageIndex - 1];
      console.log(`PageNavigator.prevPage: Moving to previous page: ${prevPageName}`);
      this.loadPageCallback(prevPageName);
    } else {
      console.log('PageNavigator.prevPage: Already on the first page, cannot go back further.');
    }
  }

  /**
   * Displays an error message for an incomplete page.
   * @param {string} pageName - The name of the page with the error.
   */
  showPageError(pageName) {
    const errorMap = {
      module: {
        element: '.module-options',
        message: 'Please select a module to continue.'
      },
      destiny: {
        element: '#destiny-options-container', // More specific element
        message: 'Please select a Destiny and ensure all ability and flaw selections are complete.'
      },
      attributes: {
        element: '.dice-assignment-table',
        message: 'Please assign dice to all attributes.'
      },
      flaws: {
        element: '.flaw-options',
        message: 'Please select your flaws to continue.' // Placeholder message
      },
      info: {
        element: '#characterName',
        message: 'Please enter your character\'s name.'
      }
    };

    const { element, message } = errorMap[pageName];
    const el = document.querySelector(element);
    if (el) {
      el.classList.add('error-highlight');
      setTimeout(() => {
        el.classList.remove('error-highlight');
        console.log(`PageNavigator.showPageError: Removed error highlight from ${element}`);
      }, 2000);
    }
    console.error(`PageNavigator.showPageError: Displaying error for page '${pageName}': ${message}`);
    alerter.show(message, 'error');
  }
}

export { PageNavigator };
