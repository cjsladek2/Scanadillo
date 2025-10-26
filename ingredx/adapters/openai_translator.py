from __future__ import annotations
from openai import OpenAI
from ..core.translator import Translator


class OpenAITranslator(Translator):
    """
    Translator using OpenAI models for language detection and translation.
    Accepts optional model_override for faster or custom models.
    """

    def __init__(self, model_override: str = None):
        self.client = OpenAI()
        self.model = model_override or "gpt-4o"

    def detect_language(self, text: str) -> str:
        """Return ISO 639-1 code for the input language (e.g., 'en', 'es')."""
        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a language detection assistant. "
                            "Respond ONLY with the ISO 639-1 two-letter code for the language of the user's text."
                        ),
                    },
                    {"role": "user", "content": text},
                ],
                temperature=0.0,
            )
            code = resp.choices[0].message.content.strip().lower()
            return code[:2] if len(code) > 2 else code
        except Exception as e:
            return f"[Error: {e}]"

    def translate(self, text: str, target_language: str) -> str:
        """Translate text into the target language."""
        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            f"You are a precise translator. Translate everything into {target_language}. "
                            f"Do NOT add commentary or explanations — return only the translated text."
                        ),
                    },
                    {"role": "user", "content": text},
                ],
                temperature=0.0,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            return f"[Error: {e}]"