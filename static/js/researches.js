let currentPage = 1;
const itemsPerPage = 8;
let allExperiments = [];
let filteredExperiments = [];

// Fetch experiments data from backend
async function fetchExperiments() {
    try {
        const response = await fetch("/api/experiments");
        if (!response.ok) throw new Error("Failed to fetch experiments data");
        const data = await response.json();
        allExperiments = data.experiments || [];
        filteredExperiments = [...allExperiments];
        console.log("✅ Experiments data loaded");
    } catch (error) {
        console.error(error);
    }
}

// Initialize after DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
    await fetchExperiments();
    setupEventListeners();
    renderExperiments();
    updateResultsCount();

    const sidebarToggle = document.getElementById("sidebar-toggle");
    const filtersSidebar = document.getElementById("filters-sidebar");
    const overlay = document.getElementById("overlay");

    if (sidebarToggle && filtersSidebar && overlay) {
        sidebarToggle.addEventListener("click", () => {
            filtersSidebar.classList.toggle("open");
            overlay.classList.toggle("active");
        });
        overlay.addEventListener("click", () => {
            filtersSidebar.classList.remove("open");
            overlay.classList.remove("active");
        });
    }
});

// --- Debounce function for better performance ---
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// Setup search, filter, reset, and sort event listeners
function setupEventListeners() {
    const searchInput = document.getElementById("researchSearchInput");

    if (searchInput) {
        // Live search as you type, with 300ms debounce
        searchInput.addEventListener("input", debounce(handleSearch, 300));
    }

    const filterCheckboxes = document.querySelectorAll(".category-filter, .organism-filter, .mission-filter, .status-filter");
    filterCheckboxes.forEach(cb => cb.addEventListener("change", () => applyFilters()));

    const resetBtn = document.getElementById("resetFilters");
    if (resetBtn) resetBtn.addEventListener("click", resetFilters);

    const sortSelect = document.getElementById("sortSelect");
    if (sortSelect) sortSelect.addEventListener("change", handleSort);
}

// --- Search ---
function handleSearch() {
    const searchTerm = document.getElementById("researchSearchInput")?.value.toLowerCase() || "";

    filteredExperiments = allExperiments.filter(exp => {
        return (
            exp.title.toLowerCase().includes(searchTerm) ||
            exp.description.toLowerCase().includes(searchTerm) ||
            exp.organism.toLowerCase().includes(searchTerm) ||
            exp.mission.toLowerCase().includes(searchTerm) ||
            exp.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
    });

    applyFilters(true); // apply filters on search result
}

// --- Filters ---
function applyFilters(fromSearch = false) {
    const categoryFilters = Array.from(document.querySelectorAll(".category-filter:checked")).map(cb => cb.value);
    const organismFilters = Array.from(document.querySelectorAll(".organism-filter:checked")).map(cb => cb.value);
    const missionFilters = Array.from(document.querySelectorAll(".mission-filter:checked")).map(cb => cb.value);
    const statusFilters = Array.from(document.querySelectorAll(".status-filter:checked")).map(cb => cb.value);

    let source = fromSearch ? filteredExperiments : [...allExperiments];

    if (categoryFilters.length > 0) source = source.filter(exp => categoryFilters.includes(exp.category));
    if (organismFilters.length > 0) source = source.filter(exp => organismFilters.includes(exp.organism));
    if (missionFilters.length > 0) source = source.filter(exp => missionFilters.includes(exp.mission));
    if (statusFilters.length > 0) source = source.filter(exp => statusFilters.includes(exp.status));

    filteredExperiments = source;
    currentPage = 1;
    renderExperiments();
    updateResultsCount();
}

// --- Reset Filters ---
function resetFilters() {
    document.querySelectorAll(".category-filter, .organism-filter, .mission-filter, .status-filter").forEach(cb => cb.checked = false);
    const searchInput = document.getElementById("researchSearchInput");
    if (searchInput) searchInput.value = "";

    filteredExperiments = [...allExperiments];
    currentPage = 1;
    renderExperiments();
    updateResultsCount();
}

// --- Sorting ---
function handleSort() {
    const sortValue = document.getElementById("sortSelect")?.value;

    switch (sortValue) {
        case "year-desc":
            filteredExperiments.sort((a, b) => b.year - a.year);
            break;
        case "year-asc":
            filteredExperiments.sort((a, b) => a.year - b.year);
            break;
        case "title":
            filteredExperiments.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case "relevance":
        default:
            filteredExperiments.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
            break;
    }

    renderExperiments();
}

// --- Render Experiments ---
function renderExperiments() {
    const grid = document.getElementById("researchGrid");
    if (!grid) return;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageExperiments = filteredExperiments.slice(startIndex, endIndex);

    if (pageExperiments.length === 0) {
        grid.innerHTML = '<div class="no-results">No experiments found matching your criteria.</div>';
        if (document.getElementById("pagination")) document.getElementById("pagination").innerHTML = "";
        return;
    }

    grid.innerHTML = pageExperiments.map(createExperimentCard).join("");
    renderPagination();
}

// --- Experiment Card ---
function createExperimentCard(exp) {
    const categoryColors = {
        microbiology: "#8b5cf6",
        "plant-studies": "#10b981",
        "animal-studies": "#f59e0b",
        "human-studies": "#ef4444"
    };
    const statusColors = {
        Completed: "#10b981",
        "In Progress": "#3b82f6",
        Planned: "#f59e0b"
    };

    // Determine the link to open
    const linkToOpen = (exp.links?.publications?.[0] || exp.links?.datasets?.[0] || "#");

    return `
    <div class="research-card" style="cursor:default;">
        <div class="research-card-header">
            <span class="research-category" style="background:${categoryColors[exp.category]||"#6b7280"}">${exp.category.replace("-", " ")}</span>
            <span class="research-status" style="color:${statusColors[exp.status]||"#6b7280"}">${exp.status}</span>
        </div>
        <h3 class="research-card-title">${exp.title}</h3>
        <p class="research-card-description">${exp.summary}</p>
        <div class="research-card-meta">
            <div class="meta-row"><span class="meta-label">Organism:</span><span class="meta-value">${exp.organism}</span></div>
            <div class="meta-row"><span class="meta-label">Mission:</span><span class="meta-value">${exp.mission.toUpperCase()}</span></div>
            <div class="meta-row"><span class="meta-label">Duration:</span><span class="meta-value">${exp.duration}</span></div>
            <div class="meta-row"><span class="meta-label">Year:</span><span class="meta-value">${exp.year}</span></div>
        </div>
        <div class="research-card-tags">${exp.tags.slice(0,3).map(tag => `<span class="tag">${tag}</span>`).join("")}</div>
        ${linkToOpen !== "#" ? `<button class="view-link-btn research-card-btn" onclick="window.open('${linkToOpen}', '_blank')">View Publication</button>` : ""}
    </div>
    `;
}


// --- Pagination ---
function renderPagination() {
    const pagination = document.getElementById("pagination");
    if (!pagination) return;

    const totalPages = Math.ceil(filteredExperiments.length / itemsPerPage);
    if (totalPages <= 1) {
        pagination.innerHTML = "";
        return;
    }

    let html = "";

    html += `<button class="pagination-btn ${currentPage===1?'disabled':''}" onclick="changePage(${currentPage-1})" ${currentPage===1?'disabled':''}>Previous</button>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<button class="pagination-btn ${i===currentPage?'active':''}" onclick="changePage(${i})">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
    }

    html += `<button class="pagination-btn ${currentPage===totalPages?'disabled':''}" onclick="changePage(${currentPage+1})" ${currentPage===totalPages?'disabled':''}>Next</button>`;

    pagination.innerHTML = html;
}

function changePage(page) {
    const totalPages = Math.ceil(filteredExperiments.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    renderExperiments();
    document.querySelector(".research-content")?.scrollIntoView({ behavior: "smooth" });
}

// --- Update Results Count ---
function updateResultsCount() {
    const count = filteredExperiments.length;
    const countElement = document.getElementById("resultsCount");
    if (countElement) countElement.textContent = `Showing ${count} experiment${count !== 1 ? 's' : ''}`;
}
