"""
Model Enrichment Script for LLM Bench (UI-3).
Fetches real metadata ONLY from real sources:
1. Hugging Face API & ModelCard (publisher, released_at, hf_updated_at, tags, license, languages, about)
2. Ollama Library pages (tagline from og:description, capability badges: vision/tools/thinking/embedding)
3. Optional override file: backend/data/model_copy.json

Follows strict rules: 1 s delay between requests, never crashes, records provenance in enriched_from.
Supports --force to re-enrich already processed models.
"""
import argparse
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup
from huggingface_hub import HfApi, ModelCard
from sqlalchemy.orm import Session

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from database import SessionLocal
from models import Model
from utils_time import utcnow

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("enrich_models")

BACKEND_DIR = Path(__file__).resolve().parent
COPY_FILE = BACKEND_DIR / "data" / "model_copy.json"


def get_hf_token() -> Optional[str]:
    """Reads Hugging Face token from environment or .env if present."""
    token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_TOKEN")
    if token:
        return token
    # Try reading .env manually if not yet loaded
    env_path = BACKEND_DIR.parent / ".env"
    if env_path.exists():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("HF_TOKEN=") or line.startswith("HUGGINGFACE_TOKEN="):
                        return line.split("=", 1)[1].strip().strip("\"'")
        except Exception:
            pass
    return None


def clean_tagline(text: str, max_chars: int = 200) -> Optional[str]:
    """Strips emoji, leading symbols/punctuation, and returns the first sentence."""
    if not text:
        return None
    # Strip emojis across common unicode ranges
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"
        "\U0001F300-\U0001F5FF"
        "\U0001F680-\U0001F6FF"
        "\U0001F1E0-\U0001F1FF"
        "\U00002702-\U000027B0"
        "\U000024C2-\U0001F251"
        "\U0001F900-\U0001F9FF"
        "\U0001FA70-\U0001FAFF"
        "\U00002600-\U000026FF"
        "\U00002B50"
        "]+",
        flags=re.UNICODE
    )
    cleaned = emoji_pattern.sub("", text)
    # Strip leading symbols, bullet points, colons, quotes
    cleaned = re.sub(r"^[^\w\"'A-Za-z0-9]+", "", cleaned).strip()
    return extract_first_sentence(cleaned, max_chars=max_chars)


def resolve_publisher(author: str, hf_token: Optional[str] = None) -> str:
    """
    Resolves Hugging Face organizations and user handles to human-readable display names.
    Queries HF org / user overview endpoints, falling back to a readable formatted handle.
    """
    if not author:
        return "Unknown"

    KNOWN_PUBLISHERS = {
        "meta-llama": "Meta Llama",
        "Qwen": "Qwen",
        "microsoft": "Microsoft",
        "google": "Google",
        "mistralai": "Mistral AI",
        "deepseek-ai": "DeepSeek",
        "stabilityai": "Stability AI",
        "HuggingFaceTB": "Hugging Face Smol Models",
        "TinyLlama": "TinyLlama",
        "liuhaotian": "Haotian Liu",
        "pankajmathur": "Pankaj Mathur",
        "lmsys": "LMSYS",
        "WizardLMTeam": "WizardLM",
        "internlm": "InternLM",
        "Intel": "Intel",
        "Nexusflow": "Nexusflow",
        "cognitivecomputations": "Cognitive Computations",
        "dphn": "Cognitive Computations",
    }
    if author in KNOWN_PUBLISHERS:
        return KNOWN_PUBLISHERS[author]

    headers = {"User-Agent": "LLMBench/1.0"}
    if hf_token:
        headers["Authorization"] = f"Bearer {hf_token}"

    # Try HF Organization API
    try:
        resp = requests.get(f"https://huggingface.co/api/organizations/{author}/overview", headers=headers, timeout=5)
        if resp.status_code == 200:
            fullname = resp.json().get("fullname")
            if fullname and fullname.strip():
                return fullname.strip()
    except Exception:
        pass

    # Try HF User API
    try:
        resp = requests.get(f"https://huggingface.co/api/users/{author}/overview", headers=headers, timeout=5)
        if resp.status_code == 200:
            fullname = resp.json().get("fullname")
            if fullname and fullname.strip():
                return fullname.strip()
    except Exception:
        pass

    # Clean readable fallback: replace hyphens/underscores with space and title case
    return author.replace("-", " ").replace("_", " ").title()


def extract_first_sentence(text: str, max_chars: int = 200) -> Optional[str]:
    """Extracts first sentence of text, truncated up to max_chars."""
    if not text:
        return None
    cleaned = " ".join(text.split()).strip()
    if not cleaned:
        return None

    # Match first sentence ending in period, exclamation, or question mark followed by space or end
    match = re.search(r"^(.*?[.!?])(?:\s|$)", cleaned)
    sentence = match.group(1).strip() if match else cleaned

    if len(sentence) > max_chars:
        sentence = sentence[:max_chars - 3].rstrip() + "..."
    return sentence


def extract_clean_about(card_text: str, max_chars: int = 900) -> Optional[str]:
    """
    Extracts the first clean prose paragraph of a Hugging Face model card.
    Strips markdown formatting, HTML, badges, tables, and code blocks.
    Returns None if nothing clean is found.
    """
    if not card_text:
        return None

    # 1. Remove HTML tags
    text = re.sub(r"<[^>]+>", " ", card_text)
    # 2. Remove markdown images and badges (![...](...))
    text = re.sub(r"!\[[^\]]*\]\([^\)]*\)", " ", text)
    # 3. Clean markdown links: [label](url) -> label
    text = re.sub(r"\[([^\]]+)\]\([^\)]*\)", r"\1", text)
    # 4. Remove code blocks
    text = re.sub(r"```[\s\S]*?```", " ", text)

    # Split into candidate paragraphs
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    for p in paragraphs:
        lines = [l.strip() for l in p.split("\n") if l.strip()]
        if not lines:
            continue

        # Ignore lines that are headings, tables, list bullets, or hr dividers
        clean_lines = []
        for line in lines:
            if line.startswith("#") or line.startswith("|") or line.startswith("---") or line.startswith("==="):
                continue
            if line.startswith("- ") or line.startswith("* ") or line.startswith(">"):
                # strip bullet/quote prefix if it's text
                line = re.sub(r"^[-*>\s]+", "", line).strip()
            clean_lines.append(line)

        if not clean_lines:
            continue

        candidate = " ".join(clean_lines).strip()
        # Clean double spaces
        candidate = re.sub(r"\s+", " ", candidate)

        # Must look like an informative paragraph (at least 40 chars, not a table residue)
        if len(candidate) >= 40 and not candidate.startswith("|"):
            # Strip markdown bold/italics
            candidate = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", candidate)
            candidate = re.sub(r"_{1,3}([^_]+)_{1,3}", r"\1", candidate)
            if len(candidate) > max_chars:
                candidate = candidate[:max_chars - 3].rstrip() + "..."
            return candidate

    return None


def fetch_ollama_data(tag: str) -> Tuple[Optional[str], List[str], Optional[str]]:
    """
    Fetches real metadata from the Ollama library page for the tag:
    Returns (tagline, capabilities, library_url).
    """
    base_tag = tag.split(":")[0].strip()
    url = f"https://ollama.com/library/{base_tag}"

    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LLMBench/1.0"},
            timeout=10,
        )
        if resp.status_code != 200:
            logger.warning(f"Ollama library returned status {resp.status_code} for {url}")
            return None, [], url

        soup = BeautifulSoup(resp.text, "html.parser")

        # 1. og:description -> tagline (stripped of emoji and leading symbols)
        tagline = None
        og_desc = soup.find("meta", property="og:description")
        if og_desc and og_desc.get("content"):
            tagline = clean_tagline(og_desc["content"])

        # 2. Capabilities badges (vision, tools, thinking, embedding)
        valid_caps = {"vision", "tools", "thinking", "embedding"}
        capabilities = set()

        # Check all badges / tags on the page
        for el in soup.find_all(["span", "div", "a"]):
            txt = el.get_text(strip=True).lower()
            if txt in valid_caps:
                capabilities.add(txt)

        return tagline, sorted(list(capabilities)), url

    except Exception as e:
        logger.warning(f"Error fetching Ollama library for {tag}: {e}")
        return None, [], url


def fetch_hf_data(
    hf_model_id: str,
    api: HfApi,
    hf_token: Optional[str] = None,
) -> Dict[str, any]:
    """
    Fetches real metadata from Hugging Face for the given repository:
    Returns dict of author, released_at, hf_updated_at, license, languages, tags, about, hf_url.
    """
    data: Dict[str, any] = {}
    hf_url = f"https://huggingface.co/{hf_model_id}"
    data["hf_url"] = hf_url

    try:
        info = api.model_info(hf_model_id, files_metadata=False)
        if info.author:
            data["publisher"] = resolve_publisher(info.author, hf_token=hf_token)

        if info.created_at:
            dt = info.created_at
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            data["released_at"] = dt

        if info.last_modified:
            dt = info.last_modified
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            data["hf_updated_at"] = dt

        if info.tags:
            data["hf_tags"] = info.tags

        # Card data
        card_data = getattr(info, "card_data", None)
        if card_data:
            # License
            lic = getattr(card_data, "license", None)
            if lic and isinstance(lic, str):
                data["licence"] = lic

            # Languages
            lang = getattr(card_data, "language", None)
            if lang:
                if isinstance(lang, str):
                    data["languages"] = [lang]
                elif isinstance(lang, list):
                    data["languages"] = [str(l) for l in lang if l]

    except Exception as e:
        logger.warning(f"Error fetching HF model_info for {hf_model_id}: {e}")

    # Fetch Model Card prose for 'about'
    try:
        card = ModelCard.load(hf_model_id)
        about = extract_clean_about(card.text)
        if about:
            data["about"] = about
    except Exception as e:
        logger.warning(f"Error loading HF ModelCard text for {hf_model_id}: {e}")

    return data


def enrich_models(force: bool = False, model_filter: Optional[str] = None):
    print("=" * 60)
    print("LLM Bench Model Metadata Enrichment (UI-3)")
    print(f"Force overwrite: {force}")
    if model_filter:
        print(f"Filtering to model: {model_filter}")
    print("=" * 60)

    hf_token = get_hf_token()
    if hf_token:
        print("[INFO] Using Hugging Face authentication token from environment.")
    else:
        print("[INFO] No HF token found; querying Hugging Face anonymously.")
    api = HfApi(token=hf_token)

    # Load optional override copy file
    copy_overrides = {}
    if COPY_FILE.exists():
        try:
            with open(COPY_FILE, "r", encoding="utf-8") as f:
                copy_overrides = json.load(f)
            print(f"[INFO] Loaded {len(copy_overrides)} manual copy override(s) from {COPY_FILE.name}.")
        except Exception as e:
            print(f"[WARN] Failed to read {COPY_FILE}: {e}")

    db: Session = SessionLocal()
    try:
        query = db.query(Model)
        if model_filter:
            query = query.filter((Model.ollama_tag == model_filter) | (Model.name.ilike(f"%{model_filter}%")))
        models = query.all()
        total_models = len(models)
        print(f"[INFO] Found {total_models} models to process.\n")

        for idx, model in enumerate(models, start=1):
            if model.enriched_at and not force:
                print(f"[{idx}/{total_models}] Skipping {model.name} (already enriched at {model.enriched_at}).")
                continue

            print(f"[{idx}/{total_models}] Enriching {model.name} (Tag: {model.ollama_tag}, HF: {model.hf_model_id})...")
            sources: Dict[str, str] = {}

            # 1. Hugging Face Data
            if model.hf_model_id:
                hf_dict = fetch_hf_data(model.hf_model_id, api, hf_token=hf_token)
                hf_url = hf_dict.get("hf_url", f"https://huggingface.co/{model.hf_model_id}")
                model.hf_url = hf_url
                sources["hf_url"] = hf_url

                if "publisher" in hf_dict:
                    model.publisher = hf_dict["publisher"]
                    sources["publisher"] = hf_url
                elif model.hf_model_id and "/" in model.hf_model_id:
                    raw_author = model.hf_model_id.split("/")[0]
                    model.publisher = resolve_publisher(raw_author, hf_token=hf_token)
                    sources["publisher"] = hf_url
                if "released_at" in hf_dict:
                    model.released_at = hf_dict["released_at"]
                    sources["released_at"] = hf_url
                if "hf_updated_at" in hf_dict:
                    model.hf_updated_at = hf_dict["hf_updated_at"]
                    sources["hf_updated_at"] = hf_url
                if "hf_tags" in hf_dict:
                    model.hf_tags = json.dumps(hf_dict["hf_tags"])
                    sources["hf_tags"] = hf_url
                # Save languages only when list has >= 2 entries
                if "languages" in hf_dict and len(hf_dict["languages"]) >= 2:
                    model.languages = json.dumps(hf_dict["languages"])
                    sources["languages"] = hf_url
                else:
                    model.languages = None
                if "licence" in hf_dict and not model.licence:
                    model.licence = hf_dict["licence"]
                    sources["licence"] = hf_url
                if "about" in hf_dict:
                    model.about = hf_dict["about"]
                    sources["about"] = hf_url

            # 2. Ollama Data
            if model.ollama_tag:
                tagline, capabilities, ollama_url = fetch_ollama_data(model.ollama_tag)
                model.ollama_library_url = ollama_url
                sources["ollama_library_url"] = ollama_url

                if tagline:
                    model.tagline = tagline
                    sources["tagline"] = ollama_url
                if capabilities:
                    model.capabilities = json.dumps(capabilities)
                    sources["capabilities"] = ollama_url

            # 3. Optional copy override (wins over fetched text, only restates facts)
            override = copy_overrides.get(model.ollama_tag) or copy_overrides.get(model.ollama_tag.split(":")[0])
            if override:
                if "tagline" in override and override["tagline"]:
                    model.tagline = str(override["tagline"]).strip()
                    sources["tagline"] = str(COPY_FILE.name)
                if "about" in override and override["about"]:
                    model.about = str(override["about"]).strip()
                    sources["about"] = str(COPY_FILE.name)
                if "publisher" in override and override["publisher"]:
                    model.publisher = str(override["publisher"]).strip()
                    sources["publisher"] = str(COPY_FILE.name)

            # Metadata timestamp and provenance
            model.enriched_at = utcnow()
            model.enriched_from = json.dumps(sources)

            try:
                db.commit()
                print(f"  -> Successfully saved: tagline={'yes' if model.tagline else 'no'}, "
                      f"about={'yes' if model.about else 'no'}, "
                      f"publisher={model.publisher or 'none'}, "
                      f"languages={'yes' if model.languages else 'none (<2)'}, "
                      f"capabilities={model.capabilities or 'none'}")
            except Exception as e:
                db.rollback()
                print(f"  -> [ERROR] Failed to commit model {model.name}: {e}")

            # 1-second delay between requests to be polite to external APIs
            time.sleep(1.0)

        # 4. Coverage Report
        print("\n" + "=" * 60)
        print("ENRICHMENT COVERAGE REPORT")
        print("=" * 60)
        all_models = db.query(Model).all()
        n = len(all_models)
        print(f"Total models in database: {n}")
        fields = [
            ("publisher", lambda m: bool(m.publisher)),
            ("released_at", lambda m: bool(m.released_at)),
            ("hf_updated_at", lambda m: bool(m.hf_updated_at)),
            ("tagline", lambda m: bool(m.tagline)),
            ("about", lambda m: bool(m.about)),
            ("languages (>=2)", lambda m: bool(m.languages and m.languages != "[]")),
            ("capabilities", lambda m: bool(m.capabilities and m.capabilities != "[]")),
            ("hf_tags", lambda m: bool(m.hf_tags and m.hf_tags != "[]")),
            ("hf_url", lambda m: bool(m.hf_url)),
            ("ollama_library_url", lambda m: bool(m.ollama_library_url)),
            ("enriched_at", lambda m: bool(m.enriched_at)),
        ]
        for field_name, check_fn in fields:
            count = sum(1 for m in all_models if check_fn(m))
            pct = (count / n * 100.0) if n > 0 else 0.0
            print(f"  - {field_name:<20}: {count:>2}/{n} ({pct:>5.1f}%)")
        print("=" * 60 + "\n")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich models with real Hugging Face and Ollama metadata")
    parser.add_argument("--force", action="store_true", help="Force re-enrichment of models even if already enriched")
    parser.add_argument("--model", type=str, default=None, help="Filter to enrich only a specific model tag or name")
    args = parser.parse_args()
    enrich_models(force=args.force, model_filter=args.model)
