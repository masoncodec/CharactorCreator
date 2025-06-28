// pageNavigator.js

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

    this.navItems = document.querySelectorAll('.nav-item[data-page]');
    this.prevBtn = document.getElementById('prevBtn');
    this.nextBtn = document.getElementById('nextBtn');
    
    // MODIFIED: Get the new wrapper element for the next button.
    this.nextBtnWrapper = document.getElementById('nextBtnWrapper');
    
    console.log('PageNavigator: Initialized (Refactored).');
  }

  setCurrentPage(pageName) {
    this.currentPageName = pageName;
  }

  /**
   * Initializes event listeners for the navigation buttons and sidebar items.
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
    
    // MODIFIED: The click listener now checks the wrapper for the 'is-disabled' class.
    this.nextBtn?.addEventListener('click', () => {
      if (this.nextBtnWrapper && this.nextBtnWrapper.classList.contains('is-disabled')) {
        return; // Do nothing if the button is in a disabled state.
      }
      this.nextPage();
    });
  }

  /**
   * MODIFIED: Updates the visual state of all navigation, now using the wrapper
   * to control the disabled state and tooltip for the Next/Finish button.
   */
  updateNav() {
    const currentState = this.stateManager.getState();
    const currentPageIndex = this.pages.indexOf(this.currentPageName);

    // --- Sidebar Navigation Items ---
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

    // --- Previous/Next Buttons ---
    const isCurrentPageComplete = this.isPageCompleted(this.currentPageName, currentState);
    const isLastPage = currentPageIndex === this.pages.length - 1;

    if (this.prevBtn) {
      this.prevBtn.disabled = currentPageIndex === 0;
    }
    
    if (this.nextBtnWrapper && this.nextBtn) {
      const isDisabled = !isCurrentPageComplete;
      
      // Toggle the 'is-disabled' class on the wrapper element.
      this.nextBtnWrapper.classList.toggle('is-disabled', isDisabled);
      
      // Set the tooltip text on the wrapper, which can always show it.
      this.nextBtnWrapper.title = isDisabled ? this.getCompletionError(this.currentPageName) : '';
      
      // The button's text is still updated directly.
      this.nextBtn.textContent = isLastPage ? 'Finish' : 'Next';
    }
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