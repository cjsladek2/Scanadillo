from __future__ import annotations
from openai import OpenAI


class OpenAISummarizer:
    """
    Handles summarization and structured JSON generation using OpenAI models.
    Accepts an optional model_override (e.g. 'gpt-4o-mini') for faster models.
    """

    def __init__(self, model_override: str = None):
        self.client = OpenAI()
        self.model = model_override or "gpt-4o"

    def summarize(self, prompt: str, force_json: bool = False) -> str:
        """
        Summarize text via OpenAI. If force_json=True, enforces valid JSON response format.
        """
        try:
            if force_json:
                if "json" not in prompt.lower():
                    prompt += "\n\nRespond only in valid JSON format."

                completion = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                )
            else:
                completion = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                )

            return completion.choices[0].message.content.strip()

        except Exception as e:
            return f"[Error: {e}]"