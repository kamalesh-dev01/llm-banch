"""
Fixes dirty model descriptions in the database.
Replaces scraper-generated messy descriptions with clean ones.
"""
from database import engine
from sqlalchemy import text

CLEAN_DESCRIPTIONS = {
    "llama3.2":
        "Meta's lightweight multimodal model. Fast, efficient, "
        "and capable of both text and image understanding.",
    "qwen2.5":
        "Alibaba's latest instruction-tuned model. Strong at "
        "coding, math, and multilingual tasks.",
    "phi4":
        "Microsoft's compact reasoning model. Surprisingly capable "
        "at complex tasks despite its small size.",
    "mistral":
        "Mistral AI's flagship 7B model. Fast inference with strong "
        "general-purpose performance.",
    "gemma2":
        "Google's open model family. Optimised for efficient "
        "inference on consumer hardware.",
    "deepseek-r1":
        "DeepSeek's reasoning-focused model. Excellent at "
        "multi-step problem solving and code.",
    "llava":
        "A vision-language model that can understand and discuss "
        "images alongside text.",
    "codellama":
        "Meta's code-specialised Llama model. Fine-tuned for "
        "code generation and completion.",
    "llama3.1":
        "Meta's Llama 3.1 with a massive 128K context window. "
        "Great for long documents and conversations.",
    "tinyllama":
        "An extremely compact 1.1B model. Runs on almost any "
        "hardware including CPU-only systems.",
    "orca-mini":
        "A small but capable model fine-tuned to follow "
        "instructions and answer questions clearly.",
    "vicuna":
        "An instruction-following model fine-tuned from Llama. "
        "One of the original open chat models.",
    "wizardcoder":
        "Specialised for code generation tasks. Strong at "
        "Python, JavaScript, and general coding.",
    "stable-code":
        "Stability AI's code completion model. Lightweight and "
        "optimised for developer workflows.",
    "phi3":
        "Microsoft's Phi-3 Mini with a 128K context window. "
        "Punches well above its weight class.",
    "smollm2":
        "HuggingFace's ultra-compact model. Perfect for "
        "edge devices and extremely limited hardware.",
    "internlm2":
        "Shanghai AI Lab's bilingual model. Strong in both "
        "English and Chinese language tasks.",
    "neural-chat":
        "Intel's optimised chat model. Designed for efficient "
        "inference on Intel hardware.",
    "starling-lm":
        "A chat model trained with RLHF for improved "
        "helpfulness and harmlessness.",
    "dolphin-mistral":
        "An uncensored Mistral fine-tune from Cognitive "
        "Computations. Highly instruction-following.",
}

def fix_descriptions():
    """Updates all model descriptions in the database."""
    with engine.connect() as conn:
        for tag, description in CLEAN_DESCRIPTIONS.items():
            conn.execute(
                text(
                    "UPDATE models SET description = :desc "
                    "WHERE ollama_tag = :tag"
                ),
                {"desc": description, "tag": tag}
            )
        conn.commit()
    print(f"✅ Fixed {len(CLEAN_DESCRIPTIONS)} model descriptions")

if __name__ == "__main__":
    fix_descriptions()
