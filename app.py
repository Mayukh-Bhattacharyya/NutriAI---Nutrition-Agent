# =============================================================================
#  NutriAI Agent — Powered by IBM Watsonx.ai (Granite)
#  Flask backend with full nutrition planning, BMI, meal & family support.
# =============================================================================

import os
# from pathlib import Path
import json
import re
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
from dotenv import load_dotenv
from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

load_dotenv()

# base_dir = Path(__file__).resolve().parent
# env_path = base_dir / ".env"
# load_dotenv(dotenv_path=env_path)

# =============================================================================
#  AGENT INSTRUCTIONS — Customise the agent's behaviour, tone, and speciality
#  Edit any section below; changes take effect immediately (no restart needed).
# =============================================================================

AGENT_INSTRUCTIONS = {
    # ------------------------------------------------------------------
    # PERSONA  — Who the agent is
    # ------------------------------------------------------------------
    "persona": (
        "You are NutriAI, a warm, knowledgeable, and empathetic AI nutrition "
        "specialist. You hold expertise in dietetics, clinical nutrition, sports "
        "nutrition, and Ayurvedic food science. You speak in a friendly yet "
        "professional tone — encouraging, never judgmental."
    ),

    # ------------------------------------------------------------------
    # TONE  — How the agent communicates
    # ------------------------------------------------------------------
    "tone": (
        "Use clear, jargon-free language. Be motivating and positive. "
        "Celebrate small wins. Avoid alarmist language around weight or body image. "
        "Use bullet points for plans and lists; keep responses concise but complete."
    ),

    # ------------------------------------------------------------------
    # DIET SPECIALISATIONS  — Expertise areas the agent emphasises
    # ------------------------------------------------------------------
    "diet_specialisations": [
        "Indian vegetarian & vegan diets",
        "South Asian regional cuisines (Bengali, Punjabi, South Indian, Gujarati)",
        "Diabetic-friendly meal planning (low glycaemic index)",
        "PCOS / hormonal balance nutrition",
        "Weight loss & weight gain (evidence-based)",
        "Sports & athletic performance nutrition",
        "Intermittent fasting (16:8, 5:2, OMAD)",
        "Anti-inflammatory diets",
        "Child & adolescent nutrition (ages 2–18)",
        "Senior / geriatric nutrition (60+)",
    ],

    # ------------------------------------------------------------------
    # INDIAN FOOD PREFERENCES  — Regional & cultural food guidance
    # ------------------------------------------------------------------
    "indian_food_context": (
        "You deeply understand Indian home cooking. When suggesting meals, "
        "prioritise common Indian staples: dal, sabzi, roti, rice, idli, dosa, "
        "poha, upma, curd, lassi, paneer, sprouts, and seasonal vegetables. "
        "Acknowledge festivals and fasting traditions (Navratri, Ekadashi, Ramadan). "
        "Understand 'tiffin culture', dabba meals, and school lunchbox nutrition. "
        "Suggest affordable, locally available ingredients. "
        "Offer Ayurvedic tips (turmeric, jeera, ajwain, methi) where appropriate."
    ),

    # ------------------------------------------------------------------
    # SAFETY RULES  — Non-negotiable guardrails
    # ------------------------------------------------------------------
    "safety_rules": (
        "1. NEVER diagnose medical conditions or replace a licensed doctor. "
        "2. Always recommend consulting a Registered Dietitian (RD) or physician "
        "   for medical nutrition therapy. "
        "3. Do not recommend extreme calorie restriction (<1200 kcal for women, "
        "   <1500 kcal for men) without a medical supervision note. "
        "4. Flag any user-reported symptoms (chest pain, severe fatigue, dizziness) "
        "   and advise immediate medical attention. "
        "5. Avoid recommending unproven supplements or MLM products. "
        "6. Respect religious and cultural food restrictions without question."
    ),

    # ------------------------------------------------------------------
    # RESPONSE FORMAT  — Structural guidance for outputs
    # ------------------------------------------------------------------
    "response_format": (
        "Structure responses with clear headings where appropriate. "
        "For meal plans, always include: Meal name | Approximate calories | "
        "Key nutrients | Preparation tip. "
        "For calorie analysis, give a breakdown table. "
        "End every response with a 💡 quick tip relevant to the topic."
    ),

    # ------------------------------------------------------------------
    # LANGUAGE  — Primary and fallback language
    # ------------------------------------------------------------------
    "language": (
        "Respond in English by default. If the user writes in Hindi (Devanagari "
        "or Hinglish), respond in simple English but acknowledge their language. "
        "Use occasional friendly Hindi/Bengali/Tamil phrases where natural."
    ),
}

# =============================================================================
#  Build the master system prompt from AGENT_INSTRUCTIONS
# =============================================================================

def build_system_prompt() -> str:
    ai = AGENT_INSTRUCTIONS
    specs = "\n".join(f"  • {s}" for s in ai["diet_specialisations"])
    return f"""{ai['persona']}

TONE & COMMUNICATION STYLE:
{ai['tone']}

DIET SPECIALISATIONS:
{specs}

INDIAN FOOD & CULTURAL CONTEXT:
{ai['indian_food_context']}

SAFETY & ETHICAL RULES (MANDATORY):
{ai['safety_rules']}

RESPONSE FORMATTING:
{ai['response_format']}

LANGUAGE POLICY:
{ai['language']}
"""

SYSTEM_PROMPT = build_system_prompt()

# =============================================================================
#  Flask App
# =============================================================================

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "nutriai-dev-secret-2024")

# =============================================================================
#  Watsonx.ai Client
# =============================================================================

def get_watsonx_model() -> ModelInference:
    """Initialise and return a Watsonx ModelInference object."""
    api_key    = (os.getenv("IBM_API_KEY")    or "").strip()
    project_id = (os.getenv("IBM_PROJECT_ID") or "").strip()
    url        = (os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")).strip()
    model_id   = (os.getenv("WATSONX_MODEL_ID", "ibm/granite-4-h-small")).strip()

    if not api_key:
        raise ValueError("IBM_API_KEY is missing or empty in your .env file.")
    if not project_id:
        raise ValueError("IBM_PROJECT_ID is missing or empty in your .env file.")

    credentials = Credentials(url=url, api_key=api_key)
    client = APIClient(credentials)
    client.set.default_project(project_id)
    return ModelInference(
        model_id=model_id,
        api_client=client,
        params={
            GenParams.MAX_NEW_TOKENS: 1200,
            GenParams.TEMPERATURE: 0.72,
            GenParams.TOP_P: 0.95,
            GenParams.TOP_K: 50,
            GenParams.REPETITION_PENALTY: 1.1,
        },
    )

def call_granite(user_message: str, conversation_history: list | None = None) -> str:
    """
    Call Granite model via the chat API with the system prompt + conversation history.
    Returns the model's reply as a plain string.
    """
    try:
        model = get_watsonx_model()

        # Build structured chat messages list
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        if conversation_history:
            for turn in conversation_history[-8:]:   # keep last 8 turns
                role = turn.get("role", "user")
                content = turn.get("content", "")
                if role in ("user", "assistant"):
                    messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": user_message})

        response = model.chat(messages=messages)
        reply = (
            response.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                    .strip()
        )
        return reply if reply else "I'm sorry, I couldn't generate a response. Please try again."
        

    except ValueError as exc:
        return f"⚠️ Configuration error: {exc}"
    except Exception as exc:
        error_msg = str(exc)
        if "api_key" in error_msg.lower() and "not provided" in error_msg.lower():
            return (
                "⚠️ IBM API Key not recognised. Make sure your .env file has "
                "IBM_API_KEY=<key> with no spaces around the = sign."
            )
        if "CannotSetProjectOrSpace" in type(exc).__name__ or "WSCPA0000E" in error_msg:
            return (
                "⚠️ IBM Project setup error: Your IBM Cloud account does not have a "
                "Watson Machine Learning (WML) service instance associated with the project. "
                "Fix: Go to your Watsonx.ai project → Manage → Services & Integrations → "
                "Associate Service → Watson Machine Learning → create or attach an instance."
            )
        if "401" in error_msg or "Unauthorized" in error_msg:
            return "⚠️ Authentication failed — verify your IBM_API_KEY in the .env file."
        if "404" in error_msg:
            return "⚠️ Resource not found — verify WATSONX_MODEL_ID and IBM_PROJECT_ID in your .env file."
        return f"⚠️ An error occurred: {error_msg[:300]}"

# =============================================================================
#  BMI Utilities
# =============================================================================

def calculate_bmi(weight_kg: float, height_cm: float) -> dict:
    height_m = height_cm / 100
    bmi = weight_kg / (height_m ** 2)
    if bmi < 18.5:
        category, colour = "Underweight", "#f59e0b"
    elif bmi < 25.0:
        category, colour = "Normal weight", "#22c55e"
    elif bmi < 30.0:
        category, colour = "Overweight", "#f97316"
    else:
        category, colour = "Obese", "#ef4444"
    return {"bmi": round(bmi, 1), "category": category, "colour": colour}

def calculate_tdee(weight_kg: float, height_cm: float, age: int,
                   gender: str, activity: str) -> dict:
    """Calculate BMR (Mifflin-St Jeor) then apply activity multiplier."""
    if gender.lower() == "female":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5

    multipliers = {
        "sedentary": 1.2,
        "lightly_active": 1.375,
        "moderately_active": 1.55,
        "very_active": 1.725,
        "extra_active": 1.9,
    }
    multiplier = multipliers.get(activity, 1.55)
    tdee = bmr * multiplier
    return {
        "bmr": round(bmr),
        "tdee": round(tdee),
        "weight_loss": round(tdee - 500),
        "weight_gain": round(tdee + 300),
    }

# =============================================================================
#  Routes — Pages
# =============================================================================

@app.route("/")
def index():
    """Main application page."""
    if "conversation" not in session:
        session["conversation"] = []
    if "family_profiles" not in session:
        session["family_profiles"] = []
    return render_template("index.html")

# =============================================================================
#  Routes — API
# =============================================================================

@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json(force=True)
    user_message = (data.get("message") or "").strip()
    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    conversation = session.get("conversation", [])
    conversation.append({"role": "user", "content": user_message})

    reply = call_granite(user_message, conversation[:-1])   # history without latest

    conversation.append({"role": "assistant", "content": reply})
    session["conversation"] = conversation[-20:]            # keep last 20 turns
    session.modified = True

    return jsonify({"reply": reply, "timestamp": datetime.now().strftime("%H:%M")})


@app.route("/api/nutrition-plan", methods=["POST"])
def api_nutrition_plan():
    data = request.get_json(force=True)
    required = ["name", "age", "gender", "weight", "height", "goal", "diet_type"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    bmi_data  = calculate_bmi(float(data["weight"]), float(data["height"]))
    tdee_data = calculate_tdee(
        float(data["weight"]), float(data["height"]),
        int(data["age"]), data["gender"],
        data.get("activity_level", "moderately_active"),
    )

    prompt = f"""Generate a detailed 7-day nutrition plan for the following person:

Name: {data['name']}
Age: {data['age']} years | Gender: {data['gender']}
Weight: {data['weight']} kg | Height: {data['height']} cm
BMI: {bmi_data['bmi']} ({bmi_data['category']})
Goal: {data['goal']}
Diet Type: {data['diet_type']}
Activity Level: {data.get('activity_level', 'moderately_active')}
Daily Calorie Target (TDEE): {tdee_data['tdee']} kcal
Medical Conditions: {data.get('medical_conditions', 'None')}
Food Allergies / Dislikes: {data.get('allergies', 'None')}
Cuisine Preference: {data.get('cuisine', 'Indian')}

Please provide:
1. A brief nutritional assessment
2. Daily calorie & macro targets (protein, carbs, fats, fibre)
3. A 7-day meal plan (breakfast, lunch, dinner, snacks) with approximate calories
4. Hydration recommendations
5. 5 practical tips for achieving the goal
6. Foods to avoid
"""
    plan = call_granite(prompt)
    return jsonify({
        "plan": plan,
        "bmi": bmi_data,
        "tdee": tdee_data,
        "timestamp": datetime.now().strftime("%d %b %Y, %H:%M"),
    })


@app.route("/api/meal-analysis", methods=["POST"])
def api_meal_analysis():
    data = request.get_json(force=True)
    meal_description = (data.get("meal") or "").strip()
    if not meal_description:
        return jsonify({"error": "No meal description provided"}), 400

    prompt = f"""Analyse the following meal and provide a detailed nutritional breakdown:

Meal: {meal_description}
Portion size note: {data.get('portion', 'standard serving')}

Please provide:
1. Estimated total calories
2. Macro breakdown table (Protein, Carbohydrates, Fats, Fibre, Sugar)
3. Key micronutrients present (vitamins, minerals)
4. Healthiness rating (1–10) with explanation
5. Suggestions to make this meal healthier
6. Best time to eat this meal
"""
    analysis = call_granite(prompt)
    return jsonify({"analysis": analysis, "timestamp": datetime.now().strftime("%H:%M")})


@app.route("/api/bmi", methods=["POST"])
def api_bmi():
    data = request.get_json(force=True)
    try:
        weight = float(data["weight"])
        height = float(data["height"])
        age    = int(data.get("age", 30))
        gender = data.get("gender", "male")
        activity = data.get("activity", "moderately_active")
    except (KeyError, ValueError, TypeError) as exc:
        return jsonify({"error": f"Invalid input: {exc}"}), 400

    bmi_data  = calculate_bmi(weight, height)
    tdee_data = calculate_tdee(weight, height, age, gender, activity)

    prompt = f"""A person has BMI {bmi_data['bmi']} ({bmi_data['category']}).
Details: Age {age}, Gender {gender}, Weight {weight} kg, Height {height} cm,
Activity level: {activity}.
Give a brief (4–5 sentences) personalised health insight and 3 actionable nutrition tips."""

    insight = call_granite(prompt)
    return jsonify({"bmi": bmi_data, "tdee": tdee_data, "insight": insight})


@app.route("/api/family-plan", methods=["POST"])
def api_family_plan():
    data = request.get_json(force=True)
    members = data.get("members", [])
    if not members:
        return jsonify({"error": "No family members provided"}), 400

    member_lines = []
    for i, m in enumerate(members, 1):
        member_lines.append(
            f"{i}. {m.get('name','Member')} — Age: {m.get('age','?')}, "
            f"Gender: {m.get('gender','?')}, "
            f"Goal: {m.get('goal','maintain weight')}, "
            f"Conditions: {m.get('conditions','none')}"
        )
    members_text = "\n".join(member_lines)

    prompt = f"""Create a family nutrition plan for the following household members:

{members_text}

Cuisine preference: {data.get('cuisine', 'Indian')}
Budget level: {data.get('budget', 'moderate')}

Please provide:
1. Individual calorie targets for each member
2. A shared family meal plan for 3 days (meals the whole family can enjoy)
3. Notes on customising portions for different members
4. A shared grocery shopping list for the 3-day plan
5. Tips for balancing different dietary needs in one household
"""
    plan = call_granite(prompt)
    return jsonify({"plan": plan, "timestamp": datetime.now().strftime("%d %b %Y, %H:%M")})


@app.route("/api/quick-tips", methods=["GET"])
def api_quick_tips():
    topic = request.args.get("topic", "general nutrition")
    prompt = f"Give 5 practical, actionable nutrition tips about: {topic}. Keep each tip to 1–2 sentences."
    tips = call_granite(prompt)
    return jsonify({"tips": tips, "topic": topic})


@app.route("/api/clear-chat", methods=["POST"])
def api_clear_chat():
    session["conversation"] = []
    session.modified = True
    return jsonify({"status": "cleared"})


@app.route("/api/health", methods=["GET"])
def api_health():
    return jsonify({
        "status": "ok",
        "model": os.getenv("WATSONX_MODEL_ID", "ibm/granite-3-8b-instruct"),
        "timestamp": datetime.now().isoformat(),
    })


# =============================================================================
#  Entry Point
# =============================================================================

if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    print(f"\n🥗  NutriAI Agent starting on http://0.0.0.0:{port}")
    print(f"   Model : {os.getenv('WATSONX_MODEL_ID', 'ibm/granite-4-h-small')}")
    print(f"   Debug : {debug}\n")
    app.run(host="0.0.0.0", port=port, debug=debug)
