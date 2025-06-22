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
  }

  /**
   * Determines if a page can be accessed.
   * @param {number} index - The index of the page to check.
   * @param {Object} currentState - The current wizard state.
   * @returns {boolean} True if the page can be accessed, false otherwise.
   */
  canAccessPage(index, currentState) {
    // Always allow access to the first page (module). The last page (info) is also accessible.
    if (index === 0 || this.pages[index] === 'info') {
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
    if (this.pages[index] === 'info') return "Enter basic details anytime";
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
    let completed = false;
    switch (page) {
      case 'module':
        completed = !!currentState.module;
        break;
      case 'frame': 
        // This is the one modification in this function.
        // It marks the info-only 'Frame' page as complete so the 'Next' button works.
        completed = true;
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
            completed = false;
          } else {
            const requiredAttrs = moduleDefinition.attributes;
            completed = requiredAttrs.every(attr =>
              currentState.attributes[attr.toLowerCase()]
            );
          }
        }
        break;
      case 'flaws-and-perks':
        const independentFlaws = currentState.flaws.filter(f => f.source === 'independent-flaw');
        const independentPerks = currentState.perks.filter(p => p.source === 'independent-perk');

        const flawsCompleted = independentFlaws.every(flawState => {
          const flawDef = this.stateManager.getFlaw(flawState.id);
          if (!flawDef || !flawDef.options || flawDef.maxChoices === undefined || flawDef.maxChoices === null) {
            return true;
          }
          return flawState.selections.length === flawDef.maxChoices;
        });

        const perksCompleted = independentPerks.every(perkState => {
            const perkDef = this.stateManager.getPerk(perkState.id);
            if (!perkDef || !perkDef.options || perkDef.maxChoices === undefined || perkDef.maxChoices === null) {
                return true;
            }
            return perkState.selections.length === perkDef.maxChoices;
        });

        const totalFlawPoints = this.stateManager.getIndependentFlawTotalWeight();
        const totalPerkPoints = this.stateManager.getIndependentPerkTotalWeight();
        const pointsBalanceValid = totalPerkPoints <= totalFlawPoints;

        completed = flawsCompleted && perksCompleted && pointsBalanceValid;
        break;
      case 'equipment-and-loot':
        completed = true;
        break;
      case 'info':
        completed = !!currentState.info.name?.trim();
        break;
      default:
        completed = false;
    }
    return completed;
  }

  /**
   * Validates if the destiny page is complete.
   * @param {Object} currentState - The current wizard state.
   * @returns {boolean} True if destiny page is complete, false otherwise.
   */
  validateDestinyCompletion(currentState) {
    if (!currentState.destiny) {
        return false;
    }

    const destinyDefinition = this.stateManager.getDestiny(currentState.destiny);
    if (!destinyDefinition || !destinyDefinition.choiceGroups) {
        return false;
    }

    const allGroupsComplete = Object.entries(destinyDefinition.choiceGroups).every(([groupId, groupDef]) => {
      let selectedItemsInGroup;

      if (groupId === 'flaws') {
        selectedItemsInGroup = currentState.flaws.filter(item => item.groupId === groupId && item.source === 'destiny');
      } else if (groupId === 'perks') {
        selectedItemsInGroup = currentState.perks.filter(item => item.groupId === groupId && item.source === 'destiny');
      } else if (groupId === 'equipment') {
        selectedItemsInGroup = currentState.inventory.filter(item => item.groupId === groupId && item.source === 'destiny');
      }
      else {
        selectedItemsInGroup = currentState.abilities.filter(item => item.groupId === groupId && item.source === 'destiny');
      }

      if (selectedItemsInGroup.length !== groupDef.maxChoices) {
        return false;
      }

      const nestedOptionsComplete = selectedItemsInGroup.every(itemState => {
        let itemDef;

        if (groupId === 'equipment') {
            itemDef = this.stateManager.getInventoryItemDefinition(itemState.id);
        } else {
            itemDef = this.stateManager.getAbilityOrFlawData(itemState.id, itemState.groupId);
        }

        if (!itemDef || !itemDef.options || itemDef.maxChoices === undefined || itemDef.maxChoices === null) {
          return true;
        }
        return itemState.selections.length === itemDef.maxChoices;
      });

      if (!nestedOptionsComplete) {
        return false;
      }

      return true;
    });

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
    const currentState = this.stateManager.getState();

    if (!this.isPageCompleted(currentPageName, currentState)) {
      console.warn(`PageNavigator.nextPage: Current page '${currentPageName}' is not completed. Blocking navigation.`);
      this.showPageError(currentPageName);
      return;
    }

    if (this.currentPageIndex < this.pages.length - 1) {
      const nextPageName = this.pages[this.currentPageIndex + 1];
      console.log(`PageNavigator.nextPage: Moving to next page: ${nextPageName}`);
      this.loadPageCallback(nextPageName);
    } else {
      console.log('PageNavigator.nextPage: End of wizard, attempting to finish.');
      document.dispatchEvent(new CustomEvent('wizard:finish'));
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
      'equipment-and-loot': 'Please review your equipment and loot selections.',
      info: "Please enter your character's name."
    };
    return errorMap[pageName] || `The '${pageName}' page has an unresolved validation issue.`;
  }

  /**
   * Displays an error message for an incomplete page.
   * @param {string} pageName - The name of the page with the error.
   */
  showPageError(pageName) {
    const elementMap = {
      module: '.module-options',
      destiny: '#destiny-options-container',
      attributes: '.dice-assignment-table',
      'flaws-and-perks': '.flaws-and-perks-container',
      'equipment-and-loot': '#equipment-loot-container',
      info: '#characterName',
    };

    const message = this.getCompletionError(pageName);
    const elementSelector = elementMap[pageName];

    if (elementSelector) {
      const el = document.querySelector(elementSelector);
      if (el) {
        el.classList.add('error-highlight');
        setTimeout(() => {
          el.classList.remove('error-highlight');
        }, 2000);
      }
    }
    console.error(`PageNavigator.showPageError: Displaying error for page '${pageName}': ${message}`);
    alerter.show(message, 'error');
  }
}

export { PageNavigator };