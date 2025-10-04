// JavaScript for the search results page

document.addEventListener("DOMContentLoaded", () => {
  const loadingOverlay = document.getElementById("loadingOverlay")
  const searchContent = document.getElementById("searchContent")
  const queryTitle = document.getElementById("queryTitle")
  const summaryText = document.getElementById("summaryText")
  const findingsList = document.getElementById("findingsList")
  const referencesList = document.getElementById("referencesList")
  const relatedTags = document.getElementById("relatedTags")

  // Get query parameter from URL
  function getQueryParameter(name) {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get(name)
  }

  // Fetch summarized response from Flask backend
  async function getSummarizedResponse(query) {
    try {
      const resp = await fetch("/get_answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      })

      if (!resp.ok) {
        throw new Error(`Server error: ${resp.statusText}`)
      }

      return await resp.json()
    } catch (err) {
      console.error("Error fetching response:", err)
      return {
        query,
        summary: "Error fetching data from server.",
        keyFindings: [],
        references: [],
        relatedTopics: []
      }
    }
  }

  // Populate summary text
  function populateSummary(summary) {
    const paragraphs = summary.split("\n\n")
    summaryText.innerHTML = ""

    paragraphs.forEach((paragraph) => {
      if (paragraph.trim()) {
        const p = document.createElement("p")
        p.className = "summary-paragraph"
        p.textContent = paragraph.trim()
        summaryText.appendChild(p)
      }
    })
  }

  // Populate key findings
  function populateFindings(findings) {
    findingsList.innerHTML = ""

    findings.forEach((finding) => {
      const li = document.createElement("li")
      li.className = "finding-item"
      li.textContent = finding
      findingsList.appendChild(li)
    })
  }

  // Populate references
  function populateReferences(references) {
    referencesList.innerHTML = ""

    references.forEach((reference) => {
      const div = document.createElement("div")
      div.className = "reference-item"

      div.innerHTML = `
        <h4 class="reference-title">${reference.title || "Untitled"}</h4>
        ${reference.description ? `<p class="reference-description">${reference.description}</p>` : ""}
        <div class="reference-meta">
          ${reference.source ? `<span class="reference-source">${reference.source}</span>` : ""}
          ${reference.year ? `<span class="reference-year">${reference.year}</span>` : ""}
        </div>
        <a href="${reference.url}" target="_blank" rel="noopener noreferrer" class="reference-link">
          View Source →
        </a>
      `

      referencesList.appendChild(div)
    })
  }

  // Populate related topics
  function populateRelatedTopics(topics) {
    relatedTags.innerHTML = ""

    topics.forEach((topic) => {
      const span = document.createElement("span")
      span.className = "related-tag"
      span.textContent = topic
      relatedTags.appendChild(span)
    })
  }

  // Initialize page
  async function initializePage() {
    const query = getQueryParameter("q") || ""
    const response = await getSummarizedResponse(query)

    // Set query title
    queryTitle.textContent = `"${query}"`

    // Populate all sections
    populateSummary(response.summary)
    populateFindings(response.keyFindings)
    populateReferences(response.references)
    populateRelatedTopics(response.relatedTopics)

    // Show content after loading
    setTimeout(() => {
      loadingOverlay.style.display = "none"
      searchContent.style.display = "block"
    }, 2000)
  }

  // Start initialization
  initializePage()
})
