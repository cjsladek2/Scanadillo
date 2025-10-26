from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import base64
import os
from dotenv import load_dotenv
from ingredx.engine import IngredientEngine   # adjust path if needed

# ✅ Load environment variables from .env
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

# ✅ Create Flask app
app = Flask(__name__)
CORS(app)

# ✅ Initialize ingredient engine
engine = IngredientEngine()


@app.route("/api/analyze-image", methods=["POST"])
def analyze_image():
    if "image" in request.files:
        # ---------- Image preprocessing (enhance OCR accuracy) ----------
        from PIL import Image, ImageEnhance, ImageFilter
        import io
        import cv2
        import numpy as np

        img_bytes = request.files["image"].read()
        img = Image.open(io.BytesIO(img_bytes)).convert("L")  # grayscale

        # Enhance contrast and sharpness
        img = ImageEnhance.Contrast(img).enhance(2.0)
        img = img.filter(ImageFilter.SHARPEN)

        # Denoise using OpenCV
        img_cv = np.array(img)
        img_cv = cv2.fastNlMeansDenoising(img_cv, None, 30, 7, 21)

        # Optional super-resolution repair for faint or torn text
        img_cv = cv2.resize(img_cv, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)

        # Minor blur to smooth torn edges before thresholding
        img_cv = cv2.GaussianBlur(img_cv, (3, 3), 0)

        # Adaptive threshold to make black text stand out on glossy backgrounds
        img_cv = cv2.adaptiveThreshold(
            img_cv,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            35, 11
        )

        # Morphological repair for vertically sliced or thin letters
        kernel = np.ones((2, 2), np.uint8)
        img_cv = cv2.dilate(img_cv, kernel, iterations=1)

        # Optional: contour-based line thickening (helps reconnect broken verticals)
        contours, _ = cv2.findContours(img_cv, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            if h > 10 and w < 5:
                cv2.rectangle(img_cv, (x, y), (x + w, y + h), 255, -1)

        # Encode back to base64
        _, buffer = cv2.imencode(".png", img_cv)
        img_b64 = base64.b64encode(buffer).decode("utf-8")

    else:
        data = request.get_json()
        if not data or "image" not in data:
            return jsonify({"success": False, "error": "No image found"}), 400
        img_b64 = data["image"].split(",")[1] if "," in data["image"] else data["image"]

    # ---------- STEP 1: OCR with GPT-4o ----------
    ocr_prompt = """
    You are an expert in cosmetic and food labeling OCR reconstruction.

    Your task:
    1. Read ALL visible areas of the image — even if the label is torn, folded, or vertically sliced.
    2. Use context clues, partial letter shapes, and word frequency to reconstruct missing or half-visible letters.
       For example:
       - If you see "SODI M HYALURONATE", infer it as "Sodium Hyaluronate".
       - If only the left half of a letter is visible, use linguistic context to deduce the most probable full word.
    3. Merge all split text regions in correct reading order, including those separated by tears or folds.
    4. Ignore non-ingredient text (usage instructions, brand names, etc.).
    5. Return ONLY one comma-separated list of complete ingredient names, correctly spelled.
    Example output: "Aqua, Glycerin, Sodium Isostearate, Sodium Hyaluronate"
    """

    ocr_response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": ocr_prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
            ]
        }]
    )

    raw_text = ocr_response.choices[0].message.content.strip()
    print("🧾 Raw OCR result:", raw_text)

    # ---------- Safety: Check if OCR found any text ----------
    if not raw_text or len(raw_text.strip()) == 0 or raw_text.lower() in ["none", "null"]:
        return jsonify({
            "success": False,
            "error": "No text detected in the image. Please try again with a clearer photo or better lighting."
        }), 400

    # Additional safeguard: if GPT returned only punctuation or numbers
    import re
    if not re.search(r"[a-zA-Z]", raw_text):
        return jsonify({
            "success": False,
            "error": "No readable text detected — please upload a higher-quality label image."
        }), 400

    # ---------- STEP 2: Verification & Cleanup ----------
    verify_prompt = f"""
    The following ingredients were extracted from a product label:
    {raw_text}

    Correct all misspellings and OCR reading errors (e.g., 'suger' → 'sugar'),
    expand abbreviations (e.g., 'NaCl' → 'Salt' if applicable),
    and remove any non-ingredient words or metadata such as "Contains", "Tested under dermatological control", or "Manufactured by".
    Preserve the order and return only a single, clean, comma-separated list of valid ingredient names.
    """

    verify_response = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": verify_prompt}],
    )

    cleaned_text = verify_response.choices[0].message.content.strip()
    print("✨ Verified ingredient text:", cleaned_text)

    # ---------- STEP 3: Final Structural and Consistency Check ----------
    format_check_prompt = f"""
    The current ingredient list may still contain minor OCR formatting issues:
    {cleaned_text}

    Your job:
    - Do NOT reorder ingredients — preserve the exact sequence as it appears above.
    - Ensure each ingredient is separated by exactly one comma and a space.
    - Remove duplicate ingredients or trailing punctuation.
    - Ensure capitalization is consistent (capitalize first letter of each ingredient name).
    - Ensure no non-ingredient words remain.
    Return ONLY the cleaned list of ingredient names in the same order as provided, formatted correctly.
    Example (order preserved):
    "Water, Sodium Lauryl Sulfate, Cocamidopropyl Betaine, Citric Acid"
    """

    format_response = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": format_check_prompt}],
    )

    final_text = format_response.choices[0].message.content.strip()
    print("✅ Final verified list:", final_text)

    # ---------- STEP 4: Join any '-yl' fragments (AFTER GPT cleanup) ----------
    import re
    parts = [p.strip() for p in final_text.split(",") if p.strip()]
    merged = []
    i = 0
    while i < len(parts):
        current = parts[i]
        next_part = parts[i + 1] if i + 1 < len(parts) else None
        if re.search(r"yl$", current.lower()) and next_part:
            merged.append(f"{current} {next_part}")
            i += 2
        else:
            merged.append(current)
            i += 1
    final_text = ", ".join(merged)
    print("🔗 After merging '-yl' fragments:", final_text)

    # ---------- STEP 5: Analyze ingredients ----------
    results = engine.analyze_ingredient_list(final_text)
    return jsonify({"success": True, "raw_text": final_text, **results})

# 🧠 Chat route for ingredient-aware chatbot
@app.route("/api/chat", methods=["POST"])
def chat_with_ingredients():
    data = request.get_json()
    question = data.get("question", "").strip()
    ingredients = data.get("ingredients", "").strip()
    analysis_data = data.get("analysisData", {})
    prior_messages = data.get("messages", [])

    if not question:
        return jsonify({"success": False, "error": "No question provided"}), 400
    # 🧠 If no ingredients were provided, still allow general conversation
    if not ingredients:
        context_note = (
            "No ingredient context was provided. "
            "Answer general questions about health, nutrition, and ingredient safety helpfully and accurately."
        )
        ingredients = ""
    else:
        context_note = "The following ingredients were scanned from a product label."

    system_prompt = f"""
    You are a helpful AI assistant specializing in cosmetic, food, and chemical ingredient safety.
    {context_note}

    Here are the ingredients (if any):
    {ingredients}

    You also have access to a basic analysis of these ingredients (if provided):
    {analysis_data}

    When answering:
    - Use the ingredient list as primary context if available.
    - If no ingredient list is provided, still answer general questions about health, nutrition, or safety.
    - Be factual, concise, and in plain language.
    - Focus on safety, purpose, and health/environmental impact.
    - If asked about something unrelated, politely redirect back to ingredient or health context.
    """

    try:
        chat_history = [{"role": "system", "content": system_prompt}] + [
            {"role": m["role"], "content": m["content"]} for m in prior_messages
        ]

        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=chat_history,
        )

        answer = response.choices[0].message.content.strip()
        return jsonify({"success": True, "response": answer})

    except Exception as e:
        print("Chat error:", e)
        return jsonify({"success": False, "error": str(e)})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
