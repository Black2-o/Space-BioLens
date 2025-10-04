// Knowledge Graph visualization using D3.js
const d3 = window.d3;

let simulation, svg, g, zoomBehavior;
let nodes = [], links = [];
let currentFilter = "all";
let currentLayout = "force";

// Category colors
const categoryColors = {
  microbiology: "#8b5cf6",
  "plant-studies": "#10b981",
  "animal-studies": "#f59e0b",
  "human-studies": "#ef4444",
};

// Initialize graph
window.onload = async () => {
  try {
    const res = await fetch("/api/experiments");
    const data = await res.json();
    initializeGraph(data.experiments);
    setupEventListeners();
  } catch (err) {
    console.error("❌ Failed to load experiments:", err);
  }
};

function initializeGraph(experiments) {
  nodes = experiments.map(exp => ({
    id: exp.id,
    title: exp.title,
    category: exp.category,
    status: exp.status,
    duration: exp.duration,
    mission: exp.mission,
    description: exp.summary || exp.description || "No description available.",
    size: exp.graphData?.size || 15,
    connections: exp.graphData?.connections || 3,
    links: exp.links || {} // Include links for the detail button
  }));

  links = [];
  experiments.forEach(exp => {
    if (exp.links?.related) {
      exp.links.related.forEach(relatedId => {
        if (experiments.find(e => e.id === relatedId)) {
          links.push({ source: exp.id, target: relatedId });
        }
      });
    }
  });

  const container = document.getElementById("graphContainer");
  const width = container.clientWidth;
  const height = container.clientHeight;

  svg = d3.select("#knowledgeGraph").attr("width", width).attr("height", height);

  // Global zoom behavior
  zoomBehavior = d3.zoom().scaleExtent([0.1, 4]).on("zoom", (event) => g.attr("transform", event.transform));
  svg.call(zoomBehavior);

  g = svg.append("g");

  createForceLayout();
}

// --- Layout functions ---
function createForceLayout() {
  const container = document.getElementById("graphContainer");
  const width = container.clientWidth;
  const height = container.clientHeight;

  let filteredNodes = nodes;
  let filteredLinks = links;
  if (currentFilter !== "all") {
    filteredNodes = nodes.filter(n => n.category === currentFilter);
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredLinks = links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));
  }

  g.selectAll("*").remove();

  filteredNodes.forEach(node => { node.fx = null; node.fy = null; });

  simulation = d3.forceSimulation(filteredNodes)
    .force("link", d3.forceLink(filteredLinks).id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width/2, height/2))
    .force("collision", d3.forceCollide().radius(d => d.size + 5));

  const link = g.append("g").selectAll("line").data(filteredLinks).enter().append("line")
    .attr("stroke", "#4b5563").attr("stroke-opacity", 0.6).attr("stroke-width", 2);

  const node = g.append("g").selectAll("circle").data(filteredNodes).enter().append("circle")
    .attr("r", d => d.size)
    .attr("fill", d => categoryColors[d.category] || "#6b7280")
    .attr("stroke", "#fff").attr("stroke-width", 2)
    .style("cursor", "pointer")
    .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended))
    .on("click", (event,d)=>showNodeDetails(d))
    .on("mouseover", function(){ d3.select(this).attr("stroke-width",4).attr("stroke","#06b6d4")})
    .on("mouseout", function(){ d3.select(this).attr("stroke-width",2).attr("stroke","#fff") });

  const label = g.append("g").selectAll("text").data(filteredNodes).enter().append("text")
    .text(d=>d.title.substring(0,30)+(d.title.length>30?'...':''))
    .attr("font-size",10).attr("fill","#e5e7eb").attr("text-anchor","middle")
    .attr("dy", d=>d.size+15).style("pointer-events","none");

  simulation.on("tick", () => {
    link.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y).attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);
    node.attr("cx", d=>d.x).attr("cy", d=>d.y);
    label.attr("x", d=>d.x).attr("y", d=>d.y);
  });
}

// --- Radial Layout ---
function createRadialLayout() {
  const container = document.getElementById("graphContainer");
  const width = container.clientWidth;
  const height = container.clientHeight;
  const centerX = width / 2;
  const centerY = height / 2;

  let filteredNodes = nodes;
  if (currentFilter !== "all") filteredNodes = nodes.filter(n => n.category === currentFilter);

  g.selectAll("*").remove();

  const categories = [...new Set(filteredNodes.map(n => n.category))];
  const angleStep = (2 * Math.PI) / categories.length;

  filteredNodes.forEach((node) => {
    const categoryIndex = categories.indexOf(node.category);
    const angle = categoryIndex * angleStep;
    const radius = 200 + Math.random() * 100;
    node.fx = centerX + radius * Math.cos(angle);
    node.fy = centerY + radius * Math.sin(angle);
  });

  drawStaticLayout(filteredNodes);
}

// --- Hierarchical Layout ---
function createHierarchicalLayout() {
  const container = document.getElementById("graphContainer");
  const width = container.clientWidth;
  const height = container.clientHeight;

  let filteredNodes = nodes;
  if (currentFilter !== "all") filteredNodes = nodes.filter(n => n.category === currentFilter);

  g.selectAll("*").remove();

  const categories = [...new Set(filteredNodes.map(n => n.category))];
  const columnWidth = width / (categories.length + 1);

  categories.forEach((category, catIndex) => {
    const categoryNodes = filteredNodes.filter(n => n.category === category);
    const rowHeight = height / (categoryNodes.length + 1);

    categoryNodes.forEach((node, nodeIndex) => {
      node.fx = columnWidth * (catIndex + 1);
      node.fy = rowHeight * (nodeIndex + 1);
    });
  });

  drawStaticLayout(filteredNodes);
}

// --- Helper for static layouts ---
function drawStaticLayout(filteredNodes) {
  const node = g.append("g").selectAll("circle").data(filteredNodes).enter().append("circle")
    .attr("r", d => d.size)
    .attr("cx", d => d.fx)
    .attr("cy", d => d.fy)
    .attr("fill", d => categoryColors[d.category] || "#6b7280")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .style("cursor", "pointer")
    .on("click", (event,d)=>showNodeDetails(d))
    .on("mouseover", function(){ d3.select(this).attr("stroke-width",4).attr("stroke","#06b6d4")})
    .on("mouseout", function(){ d3.select(this).attr("stroke-width",2).attr("stroke","#fff") });

  g.append("g").selectAll("text").data(filteredNodes).enter().append("text")
    .text(d=>d.title.substring(0,30)+(d.title.length>30?'...':''))
    .attr("x", d=>d.fx)
    .attr("y", d=>d.fy)
    .attr("font-size",10)
    .attr("fill","#e5e7eb")
    .attr("text-anchor","middle")
    .attr("dy", d=>d.size+15)
    .style("pointer-events","none");
}

// --- Node details panel ---
function showNodeDetails(node) {
  const detailsPanel = document.getElementById("nodeDetails");
  document.getElementById("nodeTitle").textContent = node.title;
  document.getElementById("nodeDescription").textContent = node.description;
  document.getElementById("nodeStatus").textContent = node.status;
  document.getElementById("nodeDuration").textContent = node.duration;
  document.getElementById("nodeMission").textContent = node.mission?.toUpperCase() || "N/A";

  const viewLinkBtn = document.getElementById("viewLinkBtn");
  viewLinkBtn.textContent = "View Publication";

  // Use first publication link or dataset link
  const linkToOpen = (node.links?.publications?.[0] || node.links?.datasets?.[0]);

  if (linkToOpen) {
    viewLinkBtn.onclick = () => window.open(linkToOpen, "_blank");
    viewLinkBtn.disabled = false;
  } else {
    viewLinkBtn.onclick = null;
    viewLinkBtn.disabled = true; // disable button if no link
  }

  detailsPanel.style.display = "block";
}

// --- Event listeners ---
function setupEventListeners() {
  document.getElementById("filterSelect")?.addEventListener("change",(e)=>{ currentFilter=e.target.value; updateLayout(); });
  document.getElementById("layoutSelect")?.addEventListener("change",(e)=>{ currentLayout=e.target.value; updateLayout(); });
  
  document.getElementById("resetViewBtn")?.addEventListener("click",()=>{
    svg.transition().duration(750).call(zoomBehavior.transform,d3.zoomIdentity);
    document.getElementById("nodeDetails").style.display="none";
  });

  document.getElementById("fullscreenBtn")?.addEventListener("click",()=>{ document.getElementById("graphContainer")?.requestFullscreen(); });
  
  window.addEventListener("resize",()=>{ 
    const container=document.getElementById("graphContainer"); 
    svg.attr("width",container.clientWidth).attr("height",container.clientHeight); 
    updateLayout(); 
  });

  const sidebarToggle=document.getElementById("sidebar-toggle");
  const legendSidebar=document.getElementById("legend-sidebar");
  const overlay=document.getElementById("overlay");

  sidebarToggle?.addEventListener("click",()=>{ legendSidebar?.classList.toggle("open"); overlay?.classList.toggle("active"); });
  overlay?.addEventListener("click",()=>{ legendSidebar?.classList.remove("open"); overlay?.classList.remove("active"); });
}

// --- Update layout ---
function updateLayout() {
  if (simulation) simulation.stop();
  switch(currentLayout){
    case "force": createForceLayout(); break;
    case "radial": createRadialLayout(); break;
    case "hierarchical": createHierarchicalLayout(); break;
  }
}

// --- Drag functions ---
function dragstarted(event,d){ if(!event.active&&simulation) simulation.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; }
function dragged(event,d){ d.fx=event.x; d.fy=event.y; }
function dragended(event,d){ if(!event.active&&simulation) simulation.alphaTarget(0); }
