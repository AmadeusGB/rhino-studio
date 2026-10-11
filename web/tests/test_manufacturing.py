import unittest
from server import manufacturing_settings


class ManufacturingTests(unittest.TestCase):
    def test_defaults_and_roundtrip(self):
        self.assertEqual(manufacturing_settings({}), {'scope': 'body', 'thickness_mm': '', 'tolerance': 0.01})
        self.assertEqual(manufacturing_settings({'scope': 'assembly', 'thickness': '2.5', 'tolerance': '0.005'}),
                         {'scope': 'assembly', 'thickness_mm': 2.5, 'tolerance': 0.005})

    def test_reject_invalid_parameters(self):
        for payload in ({'scope': 'x'}, {'thickness': 'nan'}, {'thickness': -1},
                        {'thickness': 101}, {'tolerance': 'nan'}, {'tolerance': 0}, {'tolerance': 0.1}):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                manufacturing_settings(payload)
