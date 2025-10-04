from flask import Flask, render_template, request, jsonify
import os
import json
import re
import requests
from qdrant_client import QdrantClient
import google.generativeai as genai  # Gemini SDK
from dotenv import load_dotenv

# -------------------------
# CONFIG
# -------------------------
load_dotenv()
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
GEMINI_KEY = os.getenv("GEMINI_KEY")
HF_TOKEN = os.getenv("HUGGINGFACE_TOKEN")  # Hugging Face API token

COLLECTION_NAME = "nasa_bio_papers"
DATA_FILE = os.path.join(os.path.dirname(__file__), "data.json")
TOP_K = 5

# -------------------------
# INIT
# -------------------------
qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
genai.configure(api_key=GEMINI_KEY)
gemini = genai.GenerativeModel("gemini-2.5-pro")

HF_EMBEDDING_MODEL = "sentence-transformers/all-mpnet-base-v2"
HF_API_URL = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{HF_EMBEDDING_MODEL}"
HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"}

# -------------------------
# HF EMBEDDING FUNCTION
# -------------------------
def get_hf_embedding(text):
    """Get embedding vector from Hugging Face Inference API"""
    payload = {"inputs": text}
    response = requests.post(HF_API_URL, headers=HEADERS, json=payload)
    if response.status_code == 200:
        embedding = response.json()
        # HF returns list of token embeddings, take mean
        if isinstance(embedding[0], list):
            # simple average without numpy
            dim = len(embedding[0])
            avg = [sum(x[i] for x in embedding) / len(embedding) for i in range(dim)]
            return avg
        return embedding
    else:
        print("HF API error:", response.text)
        return [0.0] * 768  # fallback embedding

# -------------------------
# RAG + JSON OUTPUT FUNCTION
# -------------------------
def query_space_biology(user_query, top_k=TOP_K):
    """Return JSON with summary, keyFindings, references, relatedTopics"""
    query_embedding = get_hf_embedding(user_query)
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
        references.append({"title": title, "url": link})

    context = "\n\n".join(context_texts)

    prompt = f"""
You are an expert NASA Space Biology assistant. Use ONLY the context below. Do NOT make up references.

Context:
{context}

Question:
{user_query}

Instructions:
- Summarize findings in detail it should be standard length.
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
app = Flask(__name__, static_folder="static", template_folder="templates")

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

# -------------------------
# RUN APP
# -------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
