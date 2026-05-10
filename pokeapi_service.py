import json
import urllib.error
import urllib.request


class PokeApiError(RuntimeError):
    pass


def _fetch_json(url, timeout=10):
    request = urllib.request.Request(url, headers={'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw_body = response.read()
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise PokeApiError(f'failed to fetch {url}') from exc

    try:
        return json.loads(raw_body.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PokeApiError(f'invalid pokeapi response from {url}') from exc


def _extract_front_default(sprites):
    if not isinstance(sprites, dict):
        return None
    other = sprites.get('other') or {}
    artwork = other.get('official-artwork') or {}
    return {
        'front_default': sprites.get('front_default'),
        'other': {
            'official-artwork': {
                'front_default': artwork.get('front_default'),
            }
        },
    }


def _extract_japanese_name(names):
    preferred_languages = ('ja-Hrkt', 'ja')
    name_map = {}
    for item in names or []:
        language = item.get('language') or {}
        language_name = language.get('name')
        name = item.get('name')
        if language_name and name:
            name_map[language_name] = name
    for language_name in preferred_languages:
        if name_map.get(language_name):
            return name_map[language_name]
    return None


def getPokemonSpeciesById(pokemon_id, timeout=10):
    try:
        normalized_id = int(pokemon_id)
    except (TypeError, ValueError):
        raise PokeApiError('pokemon_id must be an integer')

    if normalized_id <= 0:
        raise PokeApiError('pokemon_id must be positive')

    url = f'https://pokeapi.co/api/v2/pokemon-species/{normalized_id}/'
    payload = _fetch_json(url, timeout=timeout)
    generation = payload.get('generation') or {}
    return {
        'id': payload.get('id'),
        'name': payload.get('name'),
        'name_jp': _extract_japanese_name(payload.get('names') or []),
        'generation': generation.get('name'),
    }


def getPokemonById(pokemon_id, timeout=10):
    try:
        normalized_id = int(pokemon_id)
    except (TypeError, ValueError):
        raise PokeApiError('pokemon_id must be an integer')

    if normalized_id <= 0:
        raise PokeApiError('pokemon_id must be positive')

    pokemon_url = f'https://pokeapi.co/api/v2/pokemon/{normalized_id}/'
    payload = _fetch_json(pokemon_url, timeout=timeout)
    species = getPokemonSpeciesById(normalized_id, timeout=timeout)

    sprites = payload.get('sprites') or {}
    types = []
    for item in payload.get('types') or []:
        type_info = item.get('type') or {}
        types.append(
            {
                'slot': item.get('slot'),
                'name': type_info.get('name'),
            }
        )

    return {
        'id': payload.get('id'),
        'name': payload.get('name'),
        'name_jp': species.get('name_jp'),
        'generation': species.get('generation'),
        'sprites': _extract_front_default(sprites),
        'types': types,
    }
