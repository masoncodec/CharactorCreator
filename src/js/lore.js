// Function to highlight the active navigation link
function highlightActiveNav(pageName) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').includes(pageName)) {
            link.classList.add('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    highlightActiveNav('lore.html'); // Highlight "Lore" link

    let loreData = [];
    let currentSectionIndex = 0;
    const loreContentDiv = document.getElementById('loreContent');
    const tocList = document.getElementById('tocList');
    const loreTocDiv = document.getElementById('loreTocDiv');
    const showTocBtn = document.getElementById('showTocBtn');
    const loreSearchInput = document.getElementById('loreSearch');
    const prevSectionBtn = document.getElementById('prevSectionBtn');
    const nextSectionBtn = document.getElementById('nextSectionBtn');

    // Fetch lore data
    fetch('data/lore.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            loreData = data.loreSections;
            if (loreData.length > 0) {
                renderLoreSection(currentSectionIndex);
                updatePaginationButtons();
                buildTableOfContents();
            } else {
                loreContentDiv.innerHTML = '<p>No lore available.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching lore data:', error);
            loreContentDiv.innerHTML = '<p>Failed to load lore content.</p>';
        });

    function renderLoreSection(index) {
        if (index >= 0 && index < loreData.length) {
            const section = loreData[index];
            loreContentDiv.innerHTML = `
                <h3>${section.title}</h3>
                ${section.content.map(p => `<p>${p}</p>`).join('')}
            `;
            highlightActiveToc(index);
            updatePaginationButtons();
        }
    }

    function updatePaginationButtons() {
        prevSectionBtn.disabled = currentSectionIndex === 0;
        nextSectionBtn.disabled = currentSectionIndex === loreData.length - 1;
    }

    function buildTableOfContents() {
        tocList.innerHTML = loreData.map((section, index) => 
            `<li><a href="#" data-index="${index}">${section.title}</a></li>`
        ).join('');

        tocList.addEventListener('click', function(event) {
            if (event.target.tagName === 'A') {
                event.preventDefault();
                const index = parseInt(event.target.dataset.index);
                currentSectionIndex = index;
                renderLoreSection(currentSectionIndex);
                loreTocDiv.style.display = 'none'; // Hide TOC after selection
            }
        });
    }

    function highlightActiveToc(activeIndex) {
        document.querySelectorAll('#tocList a').forEach((link, index) => {
            if (index === activeIndex) {
                link.classList.add('active-section');
            } else {
                link.classList.remove('active-section');
            }
        });
    }

    showTocBtn.addEventListener('click', function() {
        const tocElement = document.querySelector('.lore-toc');
        tocElement.style.display = tocElement.style.display === 'none' ? 'block' : 'none';
    });

    prevSectionBtn.addEventListener('click', function() {
        if (currentSectionIndex > 0) {
            currentSectionIndex--;
            renderLoreSection(currentSectionIndex);
        }
    });

    nextSectionBtn.addEventListener('click', function() {
        if (currentSectionIndex < loreData.length - 1) {
            currentSectionIndex++;
            renderLoreSection(currentSectionIndex);
        }
    });

    loreSearchInput.addEventListener('input', function() {
        const searchTerm = loreSearchInput.value.toLowerCase();
        // Simple search functionality: filter and potentially display matching sections or highlight text
        // For a more advanced search, you might integrate a search library or more complex DOM manipulation
        const filteredSections = loreData.filter(section =>
            section.title.toLowerCase().includes(searchTerm) ||
            section.content.some(p => p.toLowerCase().includes(searchTerm))
        );

        // For simplicity, let's just update the TOC to show matching sections
        tocList.innerHTML = filteredSections.map((section, index) => {
            const originalIndex = loreData.indexOf(section); // Get original index
            return `<li><a href="#" data-index="${originalIndex}">${section.title}</a></li>`;
        }).join('');

        if (searchTerm === '') {
            buildTableOfContents(); // Rebuild full TOC if search is cleared
            renderLoreSection(currentSectionIndex); // Show current section again
        } else if (filteredSections.length > 0) {
            loreTocDiv.style.display = 'block'; // Ensure TOC is visible for search results
            // Optionally, automatically jump to the first search result
            // currentSectionIndex = loreData.indexOf(filteredSections[0]);
            // renderLoreSection(currentSectionIndex);
        } else {
            loreTocDiv.style.display = 'block';
            tocList.innerHTML = '<li>No matching sections found.</li>';
        }
    });
});