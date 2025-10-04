from flask import Flask, render_template, request, jsonify
import os
import json
import re
from qdrant_client import QdrantClient
import google.generativeai as genai  # Gemini SDK
from dotenv import load_dotenv
from gradio_client import Client

# -------------------------
# CONFIG
# -------------------------
load_dotenv()
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
GEMINI_KEY = os.getenv("GEMINI_KEY")

# Gradio-hosted embedding space
GRADIO_SPACE_NAME = "black2o/space-biolens"

COLLECTION_NAME = "nasa_bio_papers"
DATA_FILE = os.path.join(os.path.dirname(__file__), "data.json")

TOP_K = 5

# -------------------------
# INIT
# -------------------------
qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

genai.configure(api_key=GEMINI_KEY)
gemini = genai.GenerativeModel("gemini-2.5-pro")

# Gradio client for embeddings
gradio_client = Client(GRADIO_SPACE_NAME)

# -------------------------
# HELPER FUNCTION TO GET EMBEDDINGS
# -------------------------
def get_embedding(text):
    try:
        embedding = gradio_client.predict(text, fn_index=0)
        return embedding
    except Exception as e:
        print("Failed to get embedding:", e)
        return None

# -------------------------
# RAG + JSON OUTPUT FUNCTION
# -------------------------
def query_space_biology(user_query, top_k=TOP_K):
    """Return JSON with summary, keyFindings, references, relatedTopics"""
    query_embedding = get_embedding(user_query)
    if query_embedding is None:
        return {
            "query": user_query,
            "summary": "Failed to get embedding from remote model.",
            "keyFindings": [],
            "references": [],
            "relatedTopics": []
        }

    hits = qdrant.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_embedding,
        limit=top_k
    )

    context_texts = []
    references = []
    for h in hits:
        title = h.payload.get("title", "")
        link = h.payload.get("link", "")
        preview = h.payload.get("text_preview", "")
        context_texts.append(f"{title}\n{preview}")
        references.append({
            "title": title,
            "url": link
        })

    context = "\n\n".join(context_texts)

    prompt = f"""
You are an expert NASA Space Biology assistant. Use ONLY the context below. Do NOT make up references.

Context:
{context}

Question:
{user_query}

Instructions:
- Summarize findings in detail (standard length).
- Provide 5 key findings as concise sentences.
- Suggest 5 related topics (keywords, concepts, or themes).
- Do NOT generate references; they will be attached separately.
- Return the result STRICTLY in VALID JSON format like this:

{{
    "query": "{user_query}",
    "summary": "summary text here",
    "keyFindings": ["key finding 1", "key finding 2", "key finding 3", "key finding 4", "key finding 5"],
    "references": [],
    "relatedTopics": ["topic1", "topic2", "topic3", "topic4", "topic5"]
}}
Only fill in the values; maintain valid JSON.
"""

    response = gemini.generate_content(prompt)

    content = ""
    if hasattr(response, "text") and response.text:
        content = response.text
    elif hasattr(response, "candidates") and len(response.candidates) > 0:
        try:
            content = response.candidates[0].content.parts[0].text
        except Exception:
            content = ""

    # Clean up Markdown JSON formatting if any
    content = re.sub(r"^```json", "", content, flags=re.MULTILINE)
    content = re.sub(r"```$", "", content, flags=re.MULTILINE)
    content = content.strip()

    try:
        llm_json = json.loads(content)
    except Exception:
        llm_json = {
            "query": user_query,
            "summary": content,
            "keyFindings": [],
            "references": [],
            "relatedTopics": []
        }

    llm_json["references"] = references
    return llm_json

# -------------------------
# FLASK SETUP
# -------------------------
app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/search")
def search():
    return render_template("search.html")

@app.route("/get_answer", methods=["POST"])
def get_answer():
    data = request.get_json()
    if not data or "query" not in data:
        return jsonify({"error": "No query provided"}), 400

    user_query = data["query"]
    result = query_space_biology(user_query)
    return jsonify(result)

@app.route("/api/experiments")
def api_experiments():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return jsonify(data)

@app.route("/researches")
def researches():
    return render_template("researches.html", active="researches")

@app.route("/knowledge-graph")
def knowledge_graph():
    return render_template("knowledge-graph.html", active="knowledge")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
