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
    this.nextBtnWrapper = document.getElementById('nextBtnWrapper');
    
    // MODIFIED: Create and manage a custom tooltip element.
    this.tooltipElement = null;
    this._createTooltip();
    
    console.log('PageNavigator: Initialized (Refactored).');
  }

  // --- NEW: Method to create the tooltip element dynamically ---
  _createTooltip() {
    if (document.getElementById('custom-tooltip')) return; // Ensure only one is created
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.id = 'custom-tooltip';
    this.tooltipElement.className = 'custom-tooltip';
    document.body.appendChild(this.tooltipElement);
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
    
    this.nextBtn?.addEventListener('click', () => {
      if (this.nextBtnWrapper && this.nextBtnWrapper.classList.contains('is-disabled')) {
        return;
      }
      this.nextPage();
    });

    // MODIFIED: Add event listeners to the wrapper for the custom tooltip.
    this.nextBtnWrapper?.addEventListener('mouseover', () => this._showTooltip());
    this.nextBtnWrapper?.addEventListener('mouseout', () => this._hideTooltip());
  }

  // --- NEW: Method to show and position the tooltip ---
  _showTooltip() {
    if (this.nextBtnWrapper && this.nextBtnWrapper.classList.contains('is-disabled') && this.tooltipElement) {
      const message = this.getCompletionError(this.currentPageName);
      this.tooltipElement.textContent = message;

      const rect = this.nextBtnWrapper.getBoundingClientRect();
      
      // Position tooltip to be centered above the button wrapper
      const topPos = rect.top + window.scrollY - this.tooltipElement.offsetHeight - 8; // 8px spacing
      const leftPos = rect.left + (rect.width / 2) - (this.tooltipElement.offsetWidth / 2);

      this.tooltipElement.style.top = `${topPos}px`;
      this.tooltipElement.style.left = `${leftPos}px`;

      this.tooltipElement.classList.add('visible');
    }
  }

  // --- NEW: Method to hide the tooltip ---
  _hideTooltip() {
    if (this.tooltipElement) {
      this.tooltipElement.classList.remove('visible');
    }
  }

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

    const isCurrentPageComplete = this.isPageCompleted(this.currentPageName, currentState);
    const isLastPage = currentPageIndex === this.pages.length - 1;

    if (this.prevBtn) {
      this.prevBtn.disabled = currentPageIndex === 0;
    }
    
    if (this.nextBtnWrapper && this.nextBtn) {
      const isDisabled = !isCurrentPageComplete;
      
      this.nextBtnWrapper.classList.toggle('is-disabled', isDisabled);
      this.nextBtn.textContent = isLastPage ? 'Finish' : 'Next';
      
      // MODIFIED: The 'title' attribute is no longer set here.
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
    // MODIFIED: Clean up the tooltip when it's no longer needed.
    this.tooltipElement?.remove();
  }
}

export { PageNavigator };