import json
import unittest
import urllib.error
from io import BytesIO
from unittest.mock import patch

import pokeapi_service as service


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def read(self):
        return json.dumps(self._payload).encode('utf-8')

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class PokeApiServiceTests(unittest.TestCase):
    def test_get_pokemon_by_id_returns_selected_fields(self):
        payload = {
            'id': 52,
            'name': 'meowth',
            'sprites': {
                'front_default': 'https://example.com/front.png',
                'other': {
                    'official-artwork': {
                        'front_default': 'https://example.com/art.png',
                    }
                },
            },
            'types': [
                {'slot': 1, 'type': {'name': 'normal'}},
            ],
        }
        species_payload = {
            'id': 52,
            'name': 'meowth',
            'generation': {'name': 'generation-i'},
            'names': [
                {'language': {'name': 'en'}, 'name': 'Meowth'},
                {'language': {'name': 'ja'}, 'name': '繝九Ε繝ｼ繧ｹ'},
                {'language': {'name': 'ja-Hrkt'}, 'name': '繝九Ε繝ｼ繧ｹ'},
            ],
        }

        with patch('urllib.request.urlopen', side_effect=[FakeResponse(payload), FakeResponse(species_payload)]) as mocked_urlopen:
            result = service.getPokemonById(52)

        self.assertEqual(2, mocked_urlopen.call_count)
        self.assertEqual(52, result['id'])
        self.assertEqual('meowth', result['name'])
        self.assertEqual('繝九Ε繝ｼ繧ｹ', result['name_jp'])
        self.assertEqual('generation-i', result['generation'])
        self.assertEqual('https://example.com/front.png', result['sprites']['front_default'])
        self.assertEqual(
            'https://example.com/art.png',
            result['sprites']['other']['official-artwork']['front_default'],
        )
        self.assertEqual([{'slot': 1, 'name': 'normal'}], result['types'])

    def test_get_pokemon_by_id_prefers_ja_hrkt_then_ja(self):
        species_payload = {
            'id': 52,
            'name': 'meowth',
            'names': [
                {'language': {'name': 'ja'}, 'name': '繝九Ε繝ｼ繧ｹ'},
                {'language': {'name': 'ja-Hrkt'}, 'name': '・・ｽｬ・ｰ・ｽ'},
            ],
        }

        with patch('urllib.request.urlopen') as mocked_urlopen:
            mocked_urlopen.side_effect = [
                FakeResponse({
                    'id': 52,
                    'name': 'meowth',
                    'sprites': {'front_default': None, 'other': {'official-artwork': {'front_default': None}}},
                    'types': [],
                }),
                FakeResponse(species_payload),
            ]
            result = service.getPokemonById(52)

        self.assertEqual('・・ｽｬ・ｰ・ｽ', result['name_jp'])

    def test_get_pokemon_by_id_rejects_invalid_id(self):
        with self.assertRaises(service.PokeApiError):
            service.getPokemonById('abc')

    def test_get_pokemon_by_id_wraps_http_errors(self):
        error = urllib.error.HTTPError(
            url='https://pokeapi.co/api/v2/pokemon/9999/',
            code=404,
            msg='Not Found',
            hdrs=None,
            fp=BytesIO(b''),
        )
        with patch('urllib.request.urlopen', side_effect=error):
            with self.assertRaises(service.PokeApiError):
                service.getPokemonById(9999)


if __name__ == '__main__':
    unittest.main()

