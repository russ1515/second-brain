"""Explicit English CMU39 ↔ canonical IDs ↔ audited phoneme-token inventory.

Reference inventory: facebook/wav2vec2-lv-60-espeak-cv-ft at revision
ae45363bf3413b374fecd9dc8bc1df0e24c3b7f4, vocab SHA256
d732ab2456c0c017930001dc9af0b41b3b93d25b2eb9740bf9d925508d7d87d0.
The caller supplies the already verified vocabulary; this module downloads none.
Stress is retained as metadata. AH0/ER0 are mapped explicitly, not silently
converted to their stressed counterparts. No new language or G2P model is added.
"""

from pathlib import Path
import re

from phonetic_engine import G2PAdapter, EvidenceError
from .errors import V2EvidenceError

MAPPING_VERSION = "cmu39-espeak-en-us-v2.1"
ARPABET_MODEL_SYMBOL = {
    "AA": "ɑː", "AE": "æ", "AH": "ʌ", "AO": "ɔː", "AW": "aʊ", "AY": "aɪ",
    "B": "b", "CH": "tʃ", "D": "d", "DH": "ð", "EH": "ɛ", "ER": "ɜː",
    "EY": "eɪ", "F": "f", "G": "ɡ", "HH": "h", "IH": "ɪ", "IY": "iː",
    "JH": "dʒ", "K": "k", "L": "l", "M": "m", "N": "n", "NG": "ŋ",
    "OW": "oʊ", "OY": "ɔɪ", "P": "p", "R": "ɹ", "S": "s", "SH": "ʃ",
    "T": "t", "TH": "θ", "UH": "ʊ", "UW": "uː", "V": "v", "W": "w",
    "Y": "j", "Z": "z", "ZH": "ʒ",
}
VOWELS = {"AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW"}
STRESSLESS_ALLOPHONES = {"AH": "ə", "ER": "ɚ"}
SPECIAL_TOKENS = {"<pad>": 0, "<s>": 1, "</s>": 2, "<unk>": 3}


class CanonicalPhonemeMapper:
    def __init__(self, vocabulary):
        if (not isinstance(vocabulary, dict) or not 4 < len(vocabulary) <= 4096
                or any(not isinstance(symbol, str) or not symbol or len(symbol) > 64
                       or isinstance(token, bool) or not isinstance(token, int)
                       or not 0 <= token < len(vocabulary) for symbol, token in vocabulary.items())
                or len(set(vocabulary.values())) != len(vocabulary)
                or any(vocabulary.get(symbol) != token for symbol, token in SPECIAL_TOKENS.items())):
            raise V2EvidenceError("PHONEME_INVENTORY_INVALID")
        needed = set(ARPABET_MODEL_SYMBOL.values()) | set(STRESSLESS_ALLOPHONES.values())
        if not needed.issubset(vocabulary):
            raise V2EvidenceError("PHONEME_MAPPING_UNSUPPORTED")
        self.vocabulary = dict(vocabulary)
        self.blank_id = SPECIAL_TOKENS["<pad>"]
        self.special_ids = frozenset(SPECIAL_TOKENS.values())
        self._reverse = {}
        for arpabet, symbol in ARPABET_MODEL_SYMBOL.items():
            self._reverse.setdefault(symbol, set()).add("cmu:" + arpabet)
        for arpabet, symbol in STRESSLESS_ALLOPHONES.items():
            self._reverse.setdefault(symbol, set()).add("cmu:" + arpabet)

    def canonical_ids_for_symbol(self, symbol):
        return sorted(self._reverse.get(symbol, ()))

    def map_phone(self, raw_arpabet, word_index=0, phone_index=0, word=None):
        if not isinstance(raw_arpabet, str):
            raise V2EvidenceError("PHONEME_MAPPING_UNSUPPORTED")
        parsed = re.fullmatch(r"([A-Z]+)([012])?", raw_arpabet)
        if parsed is None or parsed.group(1) not in ARPABET_MODEL_SYMBOL:
            raise V2EvidenceError("PHONEME_MAPPING_UNSUPPORTED")
        arpabet, digit = parsed.groups()
        stress = int(digit) if digit is not None else None
        if (stress is not None and arpabet not in VOWELS) or (stress is None and arpabet in STRESSLESS_ALLOPHONES):
            raise V2EvidenceError("PHONEME_MAPPING_UNSUPPORTED")
        if (isinstance(word_index, bool) or not isinstance(word_index, int) or not 0 <= word_index < 80
                or isinstance(phone_index, bool) or not isinstance(phone_index, int) or not 0 <= phone_index < 800
                or word is not None and (not isinstance(word, str) or not word or len(word) > 200)):
            raise V2EvidenceError("EXPECTED_PHONEME_CONTEXT_INVALID")
        symbol = STRESSLESS_ALLOPHONES[arpabet] if stress == 0 and arpabet in STRESSLESS_ALLOPHONES else ARPABET_MODEL_SYMBOL[arpabet]
        return {"index": phone_index, "phoneIndex": phone_index, "wordIndex": word_index,
            "word": word, "canonicalId": "cmu:" + arpabet, "rawArpabet": raw_arpabet,
            "arpabet": arpabet, "stress": stress, "ipa": symbol,
            "modelTokens": [{"symbol": symbol, "id": self.vocabulary[symbol]}],
            "mappingVersion": MAPPING_VERSION}

    def map_words(self, words, language="en", locale="en-US"):
        if language != "en" or locale not in ("en", "en-US"):
            raise V2EvidenceError("LANGUAGE_OR_LOCALE_NOT_SUPPORTED")
        if not isinstance(words, (list, tuple)) or not 1 <= len(words) <= 80:
            raise V2EvidenceError("EXPECTED_PHONEME_SEQUENCE_INVALID")
        result = []
        for word_index, word in enumerate(words):
            if (not isinstance(word, dict) or not isinstance(word.get("word"), str)
                    or not isinstance(word.get("arpabet"), (list, tuple))
                    or not 1 <= len(word["arpabet"]) <= 80):
                raise V2EvidenceError("EXPECTED_PHONEME_SEQUENCE_INVALID")
            for phone in word["arpabet"]:
                result.append(self.map_phone(phone, word_index, len(result), word["word"]))
        return result

    def validate_sequence(self, sequence):
        if not isinstance(sequence, (list, tuple)) or not 1 <= len(sequence) <= 800:
            raise V2EvidenceError("EXPECTED_PHONEME_SEQUENCE_INVALID")
        previous_word_index = -1
        for index, record in enumerate(sequence):
            if not isinstance(record, dict) or "rawArpabet" not in record or "wordIndex" not in record:
                raise V2EvidenceError("EXPECTED_PHONEME_SEQUENCE_INVALID")
            rebuilt = self.map_phone(record["rawArpabet"], record["wordIndex"], index, record.get("word"))
            if record["wordIndex"] < previous_word_index or any(record.get(key) != rebuilt[key] for key in
                ("index", "phoneIndex", "canonicalId", "arpabet", "stress", "ipa", "modelTokens", "mappingVersion")):
                raise V2EvidenceError("EXPECTED_PHONEME_SEQUENCE_INVALID")
            previous_word_index = record["wordIndex"]


def expected_words_with_stress(text, dictionary_path):
    """Add raw CMU stress to the existing lexicon/G2P output without changing V1.

    Only requested entries are retained in the supplemental lookup. OOV handling
    and tokenization remain the existing G2PAdapter's authoritative behavior.
    The immutable, licensed lexicon is supplied by the caller; none is fetched.
    """
    try:
        canonical = G2PAdapter(Path(dictionary_path)).convert(text)
        wanted = {item["word"] for item in canonical}
        raw = {}
        with Path(dictionary_path).open(encoding="utf-8") as dictionary:
            for line in dictionary:
                if line.startswith((";", "#")):
                    continue
                fields = line.strip().split()
                if len(fields) < 2 or re.search(r"\(\d+\)$", fields[0]):
                    continue
                word = fields[0].lower()
                if word in wanted and word not in raw:
                    raw[word] = fields[1:]
                    if len(raw) == len(wanted):
                        break
        result = []
        for item in canonical:
            phones = raw.get(item["word"])
            if not phones or [re.sub(r"\d$", "", phone) for phone in phones] != item["arpabet"]:
                raise V2EvidenceError("PHONEME_MAPPING_UNSUPPORTED")
            result.append({"word": item["word"], "arpabet": phones})
        return result
    except EvidenceError as error:
        raise V2EvidenceError(error.code) from None
    except (OSError, UnicodeError):
        raise V2EvidenceError("LEXICON_UNAVAILABLE") from None
