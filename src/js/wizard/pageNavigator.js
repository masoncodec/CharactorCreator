// pageNavigator.js
// REFACTORED: This module manages wizard navigation.
// It no longer manages the state change listener, as that is now
// handled by the central CharacterWizard orchestrator.

import { alerter } from '../alerter.js';

class PageNavigator {
  /**
   * @param {string[]} pages - An array of page names in order.
   * @param {WizardStateManager} stateManager - The instance of the WizardStateManager.
   * @param {Object} pageHandlers - A map of all page handler instances.
   * @param {Function} callbacks.loadPage - Callback to load a specific page.
   */
  constructor(pages, stateManager, pageHandlers, { loadPage }) {
    this.pages = pages;
    this.stateManager = stateManager;
    this.pageHandlers = pageHandlers;
    this.currentPageName = '';
    this.loadPageCallback = loadPage;

    // MODIFIED: This selector now specifically targets nav items with a 'data-page'
    // attribute, correctly excluding the '.nav-item--home' button.
    this.navItems = document.querySelectorAll('.nav-item[data-page]');
    this.prevBtn = document.getElementById('prevBtn');
    this.nextBtn = document.getElementById('nextBtn');
    
    console.log('PageNavigator: Initialized (Refactored).');
  }

  setCurrentPage(pageName) {
    this.currentPageName = pageName;
  }

  /**
   * Initializes event listeners for the navigation buttons and sidebar items.
   * The global state change listener has been removed from this component.
   */
  initNavListeners() {
    this.navItems.forEach(item => {
      item.addEventListener('click', () => {
        if (item.classList.contains('disabled')) {
          alerter.show(item.title || "Cannot access this page yet.");
          return;
        }
        this.goToPage(item.dataset.page);
      });
    });

    this.prevBtn?.addEventListener('click', () => this.prevPage());
    this.nextBtn?.addEventListener('click', () => this.nextPage());
  }

  /**
   * Updates the visual state of all navigation items (sidebar and buttons).
   * This is now called by the central listener in the CharacterWizard.
   */
  updateNav() {
    const currentState = this.stateManager.getState();
    const currentPageIndex = this.pages.indexOf(this.currentPageName);

    this.navItems.forEach(item => {
      const page = item.dataset.page;
      const index = this.pages.indexOf(page);
      const canAccess = this._canAccessPage(index, currentState);
      const isCompleted = this.isPageCompleted(page, currentState);

      item.classList.toggle('disabled', !canAccess);
      item.classList.toggle('active', index === currentPageIndex);
      item.classList.toggle('completed', isCompleted);
      item.title = canAccess ? '' : "Select a module first";
    });

    if (this.prevBtn) this.prevBtn.disabled = currentPageIndex === 0;
    if (this.nextBtn) this.nextBtn.textContent = currentPageIndex === this.pages.length - 1 ? 'Finish' : 'Next';
  }

  _canAccessPage(index, currentState) {
    if (index === 0) return true;
    return !!currentState.module;
  }
  
  isPageCompleted(page, currentState) {
    const handler = this.pageHandlers[page];
    if (handler && typeof handler.isComplete === 'function') {
      return handler.isComplete(currentState);
    }
    return true;
  }

  goToPage(pageName) {
    const pageIndex = this.pages.indexOf(pageName);
    if (this._canAccessPage(pageIndex, this.stateManager.getState())) {
      this.loadPageCallback(pageName);
    }
  }

  nextPage() {
    const currentPageIndex = this.pages.indexOf(this.currentPageName);
    if (!this.isPageCompleted(this.currentPageName, this.stateManager.getState())) {
      this.showPageError(this.currentPageName);
      return;
    }
    if (currentPageIndex < this.pages.length - 1) {
      this.loadPageCallback(this.pages[currentPageIndex + 1]);
    } else {
      document.dispatchEvent(new CustomEvent('wizard:finish'));
    }
  }

  prevPage() {
    const currentPageIndex = this.pages.indexOf(this.currentPageName);
    if (currentPageIndex > 0) {
      this.loadPageCallback(this.pages[currentPageIndex - 1]);
    }
  }

  getCompletionError(pageName) {
    const handler = this.pageHandlers[pageName];
    if (handler && typeof handler.getCompletionError === 'function') {
      return handler.getCompletionError();
    }
    return `The '${pageName}' page has an unresolved validation issue.`;
  }

  showPageError(pageName) {
    const message = this.getCompletionError(pageName);
    alerter.show(message, 'error');
  }
  
  cleanup() {
    // No global listeners to remove from this component anymore.
  }
}

export { PageNavigator };