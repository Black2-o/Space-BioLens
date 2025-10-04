// Main JavaScript for the Space Biology Knowledge Engine homepage

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput")
  const searchBtn = document.getElementById("searchBtn")
  const loadingOverlay = document.getElementById("loadingOverlay")
  const filterPills = document.querySelectorAll(".filter-pill")

  // Create additional stars for dynamic effect
  function createAdditionalStars() {
    const starsContainer = document.querySelector(".stars")
    if (!starsContainer) return

    for (let i = 0; i < 50; i++) {
      const star = document.createElement("div")
      star.className = "dynamic-star"
      star.style.cssText = `
        position: absolute;
        width: ${Math.random() * 3 + 1}px;
        height: ${Math.random() * 3 + 1}px;
        background: white;
        border-radius: 50%;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        opacity: ${Math.random() * 0.8 + 0.2};
        animation: subtleTwinkle ${Math.random() * 3 + 2}s ease-in-out infinite alternate;
        animation-delay: ${Math.random() * 2}s;
      `
      starsContainer.appendChild(star)
    }
  }

  // Parallax effect for cosmic background
  function handleScroll() {
    const scrolled = window.pageYOffset
    const nebula = document.querySelector(".nebula")
    const stars = document.querySelector(".stars")

    if (nebula) {
      nebula.style.transform = `translateY(${scrolled * 0.5}px)`
    }

    if (stars) {
      stars.style.transform = `translateY(${scrolled * 0.3}px)`
    }
  }

  // Perform search function
  function performSearch() {
    const searchTerm = searchInput.value.trim()
    if (searchTerm) {
      showLoading()
      setTimeout(() => {
        // FIXED: Point to Flask route, not static HTML
        window.location.href = `/search?q=${encodeURIComponent(searchTerm)}`
      }, 1500)
    }
  }

  // Apply quick filter
  function applyQuickFilter(filter) {
    showLoading()
    setTimeout(() => {
      // FIXED: Point to Flask route, not static HTML
      window.location.href = `/search?q=${encodeURIComponent(filter)}`
    }, 1000)
  }

  // Show loading overlay
  function showLoading() {
    loadingOverlay.style.display = "flex"
    loadingOverlay.style.opacity = "1"
  }

  // Event listeners
  searchBtn.addEventListener("click", performSearch)

  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      performSearch()
    }
  })

  // Quick filter event listeners
  filterPills.forEach((pill) => {
    pill.addEventListener("click", function () {
      const query = this.getAttribute("data-query")
      applyQuickFilter(query)
    })
  })

  // Initialize effects
  createAdditionalStars()
  window.addEventListener("scroll", handleScroll)
})
