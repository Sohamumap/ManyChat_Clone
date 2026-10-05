import re
import unicodedata


def normalize(text: str) -> str:
    """Lowercase, strip accents/emoji-variation noise and collapse whitespace."""
    text = unicodedata.normalize("NFKC", text or "").casefold()
    return " ".join(text.split())


def matches_keywords(text: str, keywords: list[str], mode: str) -> bool:
    """
    mode:
      any      -> every message/comment matches
      exact    -> whole text equals one keyword (ignoring case, spacing and punctuation at ends)
      contains -> a keyword appears as a whole word/phrase inside the text
    """
    if mode == "any":
        return True
    body = normalize(text)
    if not body:
        return False
    for raw in keywords:
        keyword = normalize(raw)
        if not keyword:
            continue
        if mode == "exact":
            if body.strip(" .,!?:;\"'`~-_*") == keyword:
                return True
        elif mode == "contains":
            # whole-word match so "link" doesn't fire on "unlinked"; works for emoji keywords too
            pattern = r"(?<!\w)" + re.escape(keyword) + r"(?!\w)"
            if re.search(pattern, body):
                return True
    return False
