from __future__ import annotations
from typing import Optional, Dict, List
from dotenv import load_dotenv
import os
import json
import re
import concurrent.futures

from .core.models import Explanation, IngredientAnalysis
from .core.prompts import DISCLAIMER
from .adapters.openai_translator import OpenAITranslator
from .adapters.openai_summarizer import OpenAISummarizer


class IngredientEngine:
    """
    Ultra-optimized IngredientEngine:
    ✅ Uses gpt-4o-mini for speed
    ✅ ThreadPool for parallel ingredient processing
    ✅ Keeps cache, schemas, and full compatibility
    """

    def __init__(self, cache_file: str = "ingredx_cache.json"):
        load_dotenv()
        # Ensure summarizer/translator default to gpt-4o-mini
        self.summarizer = OpenAISummarizer(model_override="gpt-4o-mini")
        self.translator = OpenAITranslator(model_override="gpt-4o-mini")
        self.cache_file = cache_file
        self._memory: Dict[str, Dict[str, float]] = self._load_cache()
        self.chat_history: List[Dict[str, str]] = []

    # ---------- Persistent cache ----------
    def _load_cache(self) -> Dict[str, Dict[str, float]]:
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _save_cache(self) -> None:
        try:
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump(self._memory, f, indent=2)
        except Exception:
            pass

    # ---------- Core generation ----------
    def generate(self, ingredient_name: str, mode: str = "overview", output_language: str = "en"):
        name_key = ingredient_name.lower().strip()
        self._memory = self._load_cache()

        known_rating = None
        if name_key in self._memory:
            val = self._memory[name_key].get("health_safety_rating")
            try:
                known_rating = float(val)
            except (TypeError, ValueError):
                known_rating = None

        prompt = self._build_generation_prompt(
            ingredient_name, mode=mode, language=output_language, known_rating=known_rating
        )

        force_json = (mode == "schema")
        text_output = self.summarizer.summarize(prompt, force_json=force_json)

        if mode == "schema":
            try:
                parsed = json.loads(text_output)
                rating = float(parsed.get("health_safety_rating"))
                if 0 <= rating <= 1:
                    self._memory[name_key] = parsed
                    self._save_cache()
                    known_rating = rating
            except Exception:
                pass

        if known_rating is not None and mode == "overview":
            text_output = f"{text_output.strip()}\n\n[Health Rating: {known_rating:.2f}]"

        if mode == "chat":
            self.chat_history.append({"role": "user", "content": ingredient_name})
            chat_prompt = self._build_chat_prompt(language=output_language)
            text_output = self.summarizer.summarize(chat_prompt, force_json=False)
            self.chat_history.append({"role": "assistant", "content": text_output})

            suggestion_prompt = (
                "Based on this conversation, suggest 3-5 natural, concise follow-up questions "
                "the user might ask next about ingredients, safety, or nutrition. "
                "Return ONLY a numbered list and no other comments."
            )
            suggestions = self.summarizer.summarize(suggestion_prompt, force_json=False)
            text_output = f"{text_output.strip()}\n\n💡 Suggested follow-ups:\n{suggestions.strip()}"

        explanation = Explanation(
            detail_level=mode, language=output_language, text=text_output
        )

        return IngredientAnalysis(
            ingredient_input=ingredient_name,
            translated_name=None,
            match=None,
            data=None,
            explanation=explanation,
            disclaimer=DISCLAIMER,
        )

    # ---------- Prompt builders ----------
    def _build_generation_prompt(
        self, ingredient_name: str, mode: str, language: str, known_rating: Optional[float] = None
    ) -> str:
        rating_hint = (
            f"The ingredient '{ingredient_name}' already has an established health safety rating of "
            f"{known_rating:.2f} on a scale of 0–1. You must use this exact value consistently.\n\n"
            if known_rating is not None
            else ""
        )

        if mode == "blurb":
            return (
                f"You are a chemistry explainer. Write a MAX 2-sentence, layperson-friendly summary "
                f"of '{ingredient_name}', focusing only on what it is, what it does, and any general safety "
                f"considerations. Do NOT mention numeric ratings or decimals. Keep it friendly.\n\nWrite in {language}."
            )

        elif mode == "overview":
            return (
                f"{rating_hint}"
                f"You are an expert chemist writing a scientifically grounded overview for laypeople "
                f"about '{ingredient_name}'. Include:\n"
                f"1) Common synonyms/other names\n"
                f"2) Chemical properties and function\n"
                f"3) Common uses\n"
                f"4) Safety and controversy information\n"
                f"5) Environmental and regulatory considerations\n"
                f"6) Overall decimal health-safety rating (0–1)\n"
                f"7) Binary yes/no edible status\n\n"
                f"Use the same rating if known.\nWrite clearly in {language}."
            )

        elif mode == "schema":
            return (
                f"{rating_hint}"
                f"You are an expert data annotator. Produce a JSON object (strict JSON format only) for '{ingredient_name}'.\n"
                "Generate exactly these fields:\n"
                "{\n"
                '  "chemical_properties": "...",\n'
                '  "common_uses": "...",\n'
                '  "safety_and_controversy": "...",\n'
                '  "environmental_and_regulation": "...",\n'
                '  "health_safety_rating": "decimal between 0 and 1, where 1.0 = completely safe, 0.0 = extremely toxic or banned. Most common food ingredients should fall between 0.7 and 1.0 unless they pose known health or environmental risks.",\n'
                '  "edible": true/false\n'
                "}\n\nReturn ONLY valid JSON with no commentary or markdown."
            )

        elif mode == "chat":
            return self._build_chat_prompt(language)

        else:
            raise ValueError(f"Unknown mode '{mode}'")

    # ---------- Chat ----------
    def _build_chat_prompt(self, language: str) -> str:
        context_snippets = "\n".join(
            f"{msg['role'].capitalize()}: {msg['content']}" for msg in self.chat_history[-8:]
        )
        return (
            f"You are a friendly, scientifically accurate nutrition and chemistry assistant specializing "
            f"in ingredients, their chemical properties, uses, safety, and environmental effects.\n\n"
            f"Conversation so far:\n{context_snippets}\n\n"
            f"Continue naturally, focusing on:\n"
            f"Chemical Properties and Function\nCommon Uses\nSafety and Controversy\nEnvironmental and Regulatory Considerations\n"
            f"Write in {language}."
        )

    # ---------- Ingredient extraction ----------
    def extract_ingredients_from_text(self, raw_text: str) -> List[str]:
        if not raw_text or not raw_text.strip():
            return []

        text = raw_text.strip()
        text = re.sub(r"[\n\r\t|*_•·]+", " ", text)
        text = re.sub(r"\s{2,}", " ", text).strip()

        match = re.search(
            r"ingr[eai]{0,2}d[iy]?e?n?t?s?\s*[:\-–_—]*\s*(.*)",
            text,
            re.IGNORECASE | re.DOTALL,
        )
        if match:
            section = match.group(1)
            section = re.split(
                r"(contains|manufactured|nutrition|distributed|may contain|allergen|storage|warning)",
                section,
                flags=re.IGNORECASE,
            )[0]
        else:
            section = None

        if not section:
            delimiters = len(re.findall(r"[;,/\.]", text))
            word_count = len(text.split())
            if delimiters >= 2 and word_count < 80:
                section = text
            else:
                probable = re.search(
                    r"([A-Z][a-z]+\s*(?:[,;/\.]\s*[A-Za-z() ]+){2,})",
                    text,
                    re.DOTALL,
                )
                if probable:
                    section = probable.group(1)

        if not section:
            return []

        section = re.sub(r"([;,/\.])(?=[A-Za-z])", r"\1 ", section)
        section = section.replace(";", ",").replace("/", ",").replace(".", ",")
        section = re.sub(r"[^a-zA-Z0-9(),.\s-]", " ", section)
        section = re.sub(r"\s{2,}", " ", section).strip()

        parts = re.split(r",(?![^()]*\))", section)
        cleaned, seen, final = [], set(), []
        for p in parts:
            p = p.strip(" .;:-").title()
            if len(p) > 1 and not p.isdigit() and not re.match(r"contains|manufactured|warning", p, re.I):
                subparts = re.split(r"\s{2,}|(?<!\b[A-Z])[.]", p)
                for s in subparts:
                    s = s.strip(" .;:-").title()
                    if len(s) > 1 and s.lower() not in ["and", "or"]:
                        cleaned.append(s)

        for item in cleaned:
            if item.lower() not in seen:
                seen.add(item.lower())
                final.append(item)
        return final

    # ---------- Optimized batch analysis ----------
    def analyze_ingredient_list(self, raw_text: str, language: str = "en") -> Dict[str, Dict]:
        """
        Extracts all ingredients and analyzes them in parallel using multiple threads.
        """
        ingredients = self.extract_ingredients_from_text(raw_text)
        if not ingredients:
            return {"error": "No ingredient list found."}

        blurbs, schemas = {}, {}

        def process(ing):
            try:
                blurb = self.generate(ing, mode="blurb", output_language=language)
                schema = self.generate(ing, mode="schema", output_language=language)
                return ing, blurb.explanation.text, json.loads(schema.explanation.text)
            except Exception as e:
                return ing, f"[Error: {e}]", {}

        # 🔥 Run up to 6 parallel threads (balance of speed vs. API limits)
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            for ing, blurb_text, schema_data in executor.map(process, ingredients):
                blurbs[ing] = blurb_text
                schemas[ing] = schema_data

        return {
            "ingredients": ingredients,
            "blurbs": blurbs,
            "schemas": schemas,
        }


# ---------- CLI ----------
if __name__ == "__main__":
    print("✅ Optimized IngredientEngine loaded.")
    engine = IngredientEngine()
    print("✅ Engine initialized with OpenAI (gpt-4o-mini).")

    while True:
        print("\n🧩 Mode: [blurb / overview / schema / chat / list / quit]")
        mode = input("> ").strip().lower()
        if mode in {"quit", "exit"}:
            break

        if mode == "list":
            raw_text = input("📜 Paste full label text: ").strip()
            results = engine.analyze_ingredient_list(raw_text)
            print(json.dumps(results, indent=2, ensure_ascii=False))
            continue

        q = input("👩‍🔬 Enter ingredient: ").strip()
        result = engine.generate(q, mode=mode)
        print(f"\n[{mode.upper()} Output]\n{result.explanation.text}\n")