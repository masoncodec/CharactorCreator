// alerter.js
// A simple utility for displaying messages.
// Currently uses window.alert() but is designed for easy expansion to custom UI messages.

export const alerter = {
    /**
     * Displays a message to the user.
     * @param {string} message - The message content.
     * @param {string} [type='info'] - The type of message ('info', 'success', 'error', 'warning').
     */
    show: function(message, type = 'info') {
        // Using alert() for immediate feedback as per current implementation context.
        // In a full application, this would be replaced with a non-blocking UI element.
        alert(`[${type.toUpperCase()}] ${message}`);
        console.log(`Alerter (${type}): ${message}`);

        // --- Example of a conceptual non-blocking UI message implementation ---
        /*
        const messageEl = document.createElement('div');
        messageEl.classList.add('alerter-message', `alerter-${type}`);
        messageEl.textContent = message;
        document.body.appendChild(messageEl);

        // Auto-remove message after a few seconds
        setTimeout(() => {
            messageEl.remove();
        }, 3000); // Remove after 3 seconds
        */
    }
};
