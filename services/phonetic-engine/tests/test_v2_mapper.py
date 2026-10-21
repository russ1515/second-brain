"""CMU39/stress mapping, with optional read-only audited real vocabulary check."""

import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from v2.mapper import CanonicalPhonemeMapper, expected_words_with_stress
from v2.errors import V2EvidenceError


# Deliberately independent inventory fixture: not a runtime fallback vocabulary.
SYMBOLS = "ɑː æ ʌ ɔː aʊ aɪ b tʃ d ð ɛ ɜː eɪ f ɡ h ɪ iː dʒ k l m n ŋ oʊ ɔɪ p ɹ s ʃ t θ ʊ uː v w j z ʒ ə ɚ".split()


def vocabulary():
    return {"<pad>": 0, "<s>": 1, "</s>": 2, "<unk>": 3,
            **{symbol: index + 4 for index, symbol in enumerate(SYMBOLS)}}


class MapperTests(unittest.TestCase):
    def setUp(self):
        self.mapper = CanonicalPhonemeMapper(vocabulary())

    def test_all_39_canonical_ids_map_without_dropping_units(self):
        arpabet = "AA AE AH AO AW AY B CH D DH EH ER EY F G HH IH IY JH K L M N NG OW OY P R S SH T TH UH UW V W Y Z ZH".split()
        records = [self.mapper.map_phone(phone + "1" if phone in ("AH", "ER") else phone, phone_index=index)
                   for index, phone in enumerate(arpabet)]
        self.assertEqual(len({record["canonicalId"] for record in records}), 39)
        self.assertTrue(all(len(record["modelTokens"]) == 1 for record in records))
        self.mapper.validate_sequence(records)

    def test_stress_changes_required_schwa_and_rhotic_variants_without_new_canonical_ids(self):
        ah0, ah1 = self.mapper.map_phone("AH0"), self.mapper.map_phone("AH1")
        er0, er1 = self.mapper.map_phone("ER0"), self.mapper.map_phone("ER1")
        self.assertEqual((ah0["ipa"], ah1["ipa"]), ("ə", "ʌ"))
        self.assertEqual((er0["ipa"], er1["ipa"]), ("ɚ", "ɜː"))
        self.assertEqual(ah0["canonicalId"], ah1["canonicalId"])
        self.assertEqual(er0["canonicalId"], er1["canonicalId"])
        self.assertEqual(self.mapper.map_phone("AH2")["ipa"], "ʌ")
        self.assertEqual(self.mapper.map_phone("ER2")["ipa"], "ɜː")

    def test_vowels_affricates_diphthongs_and_ipa_g_are_explicit(self):
        for arpabet, ipa in {"IY1": "iː", "UW1": "uː", "AA1": "ɑː", "CH": "tʃ",
                             "JH": "dʒ", "AY1": "aɪ", "AW1": "aʊ", "OY1": "ɔɪ",
                             "EY1": "eɪ", "OW1": "oʊ", "G": "ɡ", "R": "ɹ"}.items():
            with self.subTest(arpabet=arpabet):
                self.assertEqual(self.mapper.map_phone(arpabet)["modelTokens"][0]["symbol"], ipa)

    def test_unknown_or_ambiguous_stress_is_never_guessed(self):
        for value in ("AX", "AH", "ER", "AH3", "B1", "SIL", "", "ə", None):
            with self.subTest(value=value), self.assertRaisesRegex(V2EvidenceError, "PHONEME_MAPPING_UNSUPPORTED"):
                self.mapper.map_phone(value)

    def test_sequence_tracks_words_and_phone_indices(self):
        result = self.mapper.map_words([{"word": "synthetic", "arpabet": ["SH", "IY1"]},
                                        {"word": "fixture", "arpabet": ["W", "ER1", "K", "S"]}])
        self.assertEqual([phone["wordIndex"] for phone in result], [0, 0, 1, 1, 1, 1])
        self.assertEqual([phone["phoneIndex"] for phone in result], list(range(6)))
        self.mapper.validate_sequence(result)
        result[0]["modelTokens"][0]["id"] = 0
        with self.assertRaisesRegex(V2EvidenceError, "EXPECTED_PHONEME_SEQUENCE_INVALID"):
            self.mapper.validate_sequence(result)

    def test_missing_symbol_or_invalid_inventory_is_explicit(self):
        missing = vocabulary()
        del missing["θ"]
        with self.assertRaises(V2EvidenceError):
            CanonicalPhonemeMapper(missing)
        wrong_blank = vocabulary()
        wrong_blank["<pad>"] = 3
        with self.assertRaisesRegex(V2EvidenceError, "PHONEME_INVENTORY_INVALID"):
            CanonicalPhonemeMapper(wrong_blank)
        self.assertEqual(self.mapper.canonical_ids_for_symbol("not-a-supported-expected-phone"), [])

    def test_only_english_model_locale_allowed(self):
        for language, locale in (("fr", "fr-FR"), ("en", "en-GB"), ("ln", "en-US")):
            with self.subTest(language=language), self.assertRaisesRegex(V2EvidenceError, "LANGUAGE_OR_LOCALE_NOT_SUPPORTED"):
                self.mapper.map_words([{"word": "fixture", "arpabet": ["F"]}], language, locale)

    def test_existing_g2p_tokenization_and_lexicon_are_reused_with_raw_stress(self):
        with tempfile.TemporaryDirectory() as directory:
            lexicon = Path(directory) / "technical.dict"
            lexicon.write_text("technical T EH1 K N IH0 K AH0 L\nfixture F IH1 K S CH ER0\nfixture(2) F IH2 K S CH ER0\n", encoding="utf-8")
            words = expected_words_with_stress("Technical fixture.", lexicon)
        self.assertEqual(words[0]["arpabet"][-2:], ["AH0", "L"])
        self.assertEqual(words[1]["arpabet"][-1], "ER0")
        result = self.mapper.map_words(words)
        self.assertTrue(any(record["ipa"] == "ə" for record in result))
        self.assertTrue(any(record["ipa"] == "ɚ" for record in result))

    @unittest.skipUnless(os.environ.get("PHONETIC_V2_VOCAB_PATH"), "Audited actual model vocabulary not supplied")
    def test_actual_audited_inventory_exact_ids(self):
        import hashlib
        binary = Path(os.environ["PHONETIC_V2_VOCAB_PATH"]).read_bytes()
        self.assertEqual(hashlib.sha256(binary).hexdigest(), "d732ab2456c0c017930001dc9af0b41b3b93d25b2eb9740bf9d925508d7d87d0")
        mapper = CanonicalPhonemeMapper(json.loads(binary))
        self.assertEqual(len(mapper.vocabulary), 392)
        for phone, token in {"IH1": 17, "IY1": 30, "UW1": 46, "AA1": 41,
                             "AH0": 7, "AH1": 33, "ER0": 43, "ER1": 63,
                             "AO1": 67, "JH": 60, "CH": 66, "EY1": 44}.items():
            with self.subTest(phone=phone):
                self.assertEqual(mapper.map_phone(phone)["modelTokens"][0]["id"], token)


if __name__ == "__main__":
    unittest.main()
