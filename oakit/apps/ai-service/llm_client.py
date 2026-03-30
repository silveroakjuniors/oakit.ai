import os
import httpx
from abc import ABC, abstractmethod

OLLAMA_BASE = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1:8b")

class LLMClient(ABC):
    @abstractmethod
    async def generate(self, prompt: str) -> str: ...

class OllamaClient(LLMClient):
    async def generate(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{OLLAMA_BASE}/api/generate",
                json={"model": DEFAULT_MODEL, "prompt": prompt, "stream": False},
            )
            resp.raise_for_status()
            return resp.json()["response"]

# Singleton
_client: LLMClient | None = None

def get_llm_client() -> LLMClient:
    global _client
    if _client is None:
        _client = OllamaClient()
    return _client
