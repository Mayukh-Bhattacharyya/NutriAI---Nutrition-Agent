# 🥗 NutriAI — IBM Watsonx.ai Nutrition Agent

> **Personalised AI nutrition planning powered by IBM Watsonx.ai (Granite models)**  
> Chat · 7-Day Meal Plans · Calorie Analysis · BMI Calculator · Family Profiles · Indian Diet Expertise

---

## 📋 Table of Contents

1. [Features](#-features)
2. [Architecture](#-architecture)
3. [Prerequisites](#-prerequisites)
4. [Quick Start](#-quick-start)
5. [IBM Cloud Setup](#-ibm-cloud-setup)
6. [Environment Variables](#-environment-variables)
7. [Customising the Agent](#-customising-the-agent)
8. [Project Structure](#-project-structure)
9. [API Reference](#-api-reference)
10. [Deployment](#-deployment)
11. [Troubleshooting](#-troubleshooting)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Chat** | Conversational nutrition assistant with conversation history |
| 📅 **7-Day Meal Plan** | Personalised plans based on your goals, diet type & cuisine |
| 🔍 **Meal Analyser** | Nutritional breakdown of any meal you describe |
| ⚖️ **BMI Calculator** | BMR, TDEE, and calorie targets with AI health insight |
| 👨‍👩‍👧 **Family Profiles** | Shared meal planning for entire households |
| 💡 **Quick Tips** | On-demand nutrition tips for any topic |
| 🌙 **Dark Mode** | Full light/dark theme with persistence |
| 📱 **Responsive** | Optimised for mobile, tablet, and desktop |
| 🇮🇳 **Indian Food Expertise** | Deep knowledge of regional Indian cuisines |

---

## 🏗️ Architecture

```
Browser  ──►  Flask (app.py)  ──►  IBM Watsonx.ai
              │                    (Granite Model)
              │
              ├── /api/chat            → conversational AI
              ├── /api/nutrition-plan  → 7-day meal plans
              ├── /api/meal-analysis   → calorie breakdown
              ├── /api/bmi             → BMI + TDEE + insight
              ├── /api/family-plan     → household meal plans
              └── /api/quick-tips      → topic-based tips
```

---

## 🔧 Prerequisites

- Python **3.10+**
- An **IBM Cloud account** (free tier is sufficient for testing)
- An **IBM Watsonx.ai** project

---

## 🚀 Quick Start

### 1 — Clone / Download

```bash
# If using git
git clone https://github.com/your-org/nutriai.git
cd nutriai

# Or just extract the zip into a folder
```

### 2 — Create a virtual environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3 — Install dependencies

```bash
pip install -r requirements.txt
```

### 4 — Configure credentials

```bash
# Copy the example env file
cp .env.example .env    # macOS/Linux
copy .env.example .env  # Windows

# Edit .env and fill in your IBM Cloud keys (see next section)
```

### 5 — Run the app

```bash
python app.py
```

Open **http://localhost:5000** in your browser. ✅

---

## 🔑 IBM Cloud Setup

### Step 1 — Create an IBM Cloud Account

1. Visit [https://cloud.ibm.com/registration](https://cloud.ibm.com/registration)
2. Sign up for a free account (no credit card required for Lite tier)

### Step 2 — Get your API Key

1. Go to **Manage → Access (IAM) → API Keys**
2. Click **Create an IBM Cloud API key**
3. Copy and save the key securely — it's shown only once

### Step 3 — Create a Watsonx.ai Project

1. Go to [https://dataplatform.cloud.ibm.com/wx/home](https://dataplatform.cloud.ibm.com/wx/home)
2. Click **New project → Create an empty project**
3. Note the **Project ID** from the project settings (Manage tab → General)

### Step 4 — Associate a Watson Machine Learning service

1. In your project, go to **Manage → Services and integrations**
2. Click **Associate service → Watson Machine Learning**
3. Create a new WML instance or associate an existing one

### Step 5 — Choose your Granite model

Recommended models (set in `.env`):

| Model ID | Description |
|----------|-------------|
| `ibm/granite-3-8b-instruct` | Best balance of speed & quality ✅ |
| `ibm/granite-13b-chat-v2` | Larger, more detailed responses |
| `ibm/granite-3-2b-instruct` | Fastest, lighter responses |

---

## 🌍 Environment Variables

Edit `.env` with your values:

```env
# Required
IBM_API_KEY=<your IBM Cloud API key>
IBM_PROJECT_ID=<your Watsonx.ai project ID>

# Optional — defaults shown
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-3-8b-instruct
FLASK_SECRET_KEY=<random string for session security>
FLASK_DEBUG=false
FLASK_PORT=5000
```

> 💡 **Region URLs**  
> - US South: `https://us-south.ml.cloud.ibm.com`  
> - EU Frankfurt: `https://eu-de.ml.cloud.ibm.com`  
> - Tokyo: `https://jp-tok.ml.cloud.ibm.com`

---

## 🎛️ Customising the Agent

All agent behaviour is controlled by the `AGENT_INSTRUCTIONS` dictionary at the top of `app.py`. No restart required — changes are compiled into the system prompt at each request.

```python
AGENT_INSTRUCTIONS = {
    "persona":                "...",   # Who the agent is
    "tone":                   "...",   # Communication style
    "diet_specialisations":   [...],   # List of expertise areas
    "indian_food_context":    "...",   # Regional food knowledge
    "safety_rules":           "...",   # Mandatory guardrails
    "response_format":        "...",   # How responses are structured
    "language":               "...",   # Language preferences
}
```

### Example customisations

**Make the agent stricter about calorie limits:**
```python
"safety_rules": (
    "Never recommend below 1500 kcal/day without explicit doctor note. "
    + existing_rules
),
```

**Add keto specialisation:**
```python
"diet_specialisations": [
    *existing_list,
    "Ketogenic diet and low-carb high-fat (LCHF) protocols",
],
```

**Change language to Hindi:**
```python
"language": "Always respond in simple Hindi (Devanagari script).",
```

---

## 📁 Project Structure

```
nutriai/
├── app.py                  # Flask backend + Watsonx.ai client
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
├── .env                    # Your credentials (DO NOT COMMIT)
├── README.md               # This file
├── templates/
│   └── index.html          # Single-page application shell
└── static/
    ├── css/
    │   └── style.css       # Full stylesheet (light/dark/responsive)
    └── js/
        └── app.js          # Frontend logic (tabs, chat, BMI, family)
```

---

## 📡 API Reference

All endpoints accept and return JSON.

### `POST /api/chat`
```json
{ "message": "What should I eat for breakfast?" }
```
Returns: `{ "reply": "...", "timestamp": "HH:MM" }`

---

### `POST /api/nutrition-plan`
```json
{
  "name": "Riya",
  "age": "28",
  "gender": "female",
  "weight": "62",
  "height": "163",
  "goal": "weight_loss",
  "diet_type": "vegetarian",
  "activity_level": "moderately_active",
  "cuisine": "South Indian",
  "medical_conditions": "PCOS",
  "allergies": "none"
}
```
Returns: `{ "plan": "...", "bmi": {...}, "tdee": {...}, "timestamp": "..." }`

---

### `POST /api/meal-analysis`
```json
{ "meal": "2 rotis, 1 bowl dal, 100g paneer", "portion": "standard" }
```
Returns: `{ "analysis": "..." }`

---

### `POST /api/bmi`
```json
{ "weight": 70, "height": 175, "age": 30, "gender": "male", "activity": "moderately_active" }
```
Returns: `{ "bmi": {...}, "tdee": {...}, "insight": "..." }`

---

### `POST /api/family-plan`
```json
{
  "members": [
    { "name": "Dad", "age": "55", "gender": "male", "goal": "manage diabetes", "conditions": "type 2 diabetes" },
    { "name": "Mom", "age": "50", "gender": "female", "goal": "weight loss", "conditions": "none" },
    { "name": "Kid", "age": "12", "gender": "male", "goal": "child growth", "conditions": "none" }
  ],
  "cuisine": "North Indian",
  "budget": "moderate"
}
```
Returns: `{ "plan": "..." }`

---

### `GET /api/quick-tips?topic=iron+rich+foods`
Returns: `{ "tips": "...", "topic": "iron rich foods" }`

---

### `GET /api/health`
Returns server status and active model name.

---

## 🚢 Deployment

### Option A — Local Development (default)

```bash
python app.py
```

### Option B — Gunicorn (Linux/macOS production)

```bash
gunicorn -w 2 -b 0.0.0.0:5000 --timeout 120 app:app
```

### Option C — IBM Code Engine (recommended cloud deployment)

1. Build a container image (Dockerfile below)
2. Push to IBM Container Registry
3. Deploy on IBM Code Engine

**Dockerfile:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "--timeout", "120", "app:app"]
```

```bash
# Build & push
docker build -t nutriai:latest .
ibmcloud cr push us.icr.io/<namespace>/nutriai:latest

# Deploy on Code Engine
ibmcloud ce app create \
  --name nutriai \
  --image us.icr.io/<namespace>/nutriai:latest \
  --env IBM_API_KEY=<key> \
  --env IBM_PROJECT_ID=<id> \
  --port 5000
```

### Option D — Heroku

```bash
# Add Procfile
echo "web: gunicorn -w 2 -b 0.0.0.0:\$PORT --timeout 120 app:app" > Procfile

heroku create my-nutriai
heroku config:set IBM_API_KEY=<key> IBM_PROJECT_ID=<id>
git push heroku main
```

### Option E — Railway / Render

Both platforms auto-detect Python/Flask apps. Set your environment variables in the dashboard and deploy from your git repository.

---

## 🛠️ Troubleshooting

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| `401 Authentication error` | Wrong API key | Re-copy API key from IBM Cloud IAM |
| `404 Model not found` | Wrong model ID | Check `WATSONX_MODEL_ID` in `.env` |
| `Project not found` | Wrong project ID | Get project ID from Watsonx.ai settings |
| Slow responses | Network / model size | Use `ibm/granite-3-2b-instruct` for speed |
| Session expires | Flask `SECRET_KEY` missing | Set a proper `FLASK_SECRET_KEY` |
| CORS issues on deploy | Missing headers | Add `flask-cors` and `CORS(app)` |

### Enable debug mode for detailed errors

```env
FLASK_DEBUG=true
```

> ⚠️ Never run with `FLASK_DEBUG=true` in production — it exposes a debugger.

---

## 🔐 Security Notes

- `.env` is in `.gitignore` — **never commit it**
- Rotate your IBM API key immediately if accidentally exposed
- In production, use environment variables injected by your platform (not `.env`)
- Consider rate-limiting the `/api/chat` endpoint with `flask-limiter`

---

## 📄 License

MIT — free to use, modify, and distribute.

---

*Built with ❤️ using IBM Watsonx.ai Granite · Flask · Bootstrap 5*
