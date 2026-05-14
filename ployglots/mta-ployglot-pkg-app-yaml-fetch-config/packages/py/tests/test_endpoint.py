from app_yaml_fetch_config import get_endpoint, load_config, resolve_intent

FIXTURE = {
    "endpoints": {
        "llm001": {"baseUrl": "https://api.example.com/v1/chat", "method": "POST", "tags": ["llm"]},
        "llm002": {"baseUrl": "https://api.alt.com/v1/chat", "method": "POST", "tags": ["llm"]},
    },
    "intent_mapping": {
        "default_intent": "llm001",
        "mappings": {"storybook": "llm002", "summary": "llm001"},
    },
}


def test_get_endpoint_known_id():
    load_config(FIXTURE)
    ep = get_endpoint("llm001")
    assert ep["key"] == "llm001"
    assert ep["baseUrl"] == "https://api.example.com/v1/chat"
    assert ep["method"] == "POST"


def test_get_endpoint_dotted_prefix_accepted():
    load_config(FIXTURE)
    ep = get_endpoint("endpoints.llm001")
    assert ep["key"] == "llm001"
    assert ep["baseUrl"] == "https://api.example.com/v1/chat"


def test_get_endpoint_unknown_returns_none():
    load_config(FIXTURE)
    assert get_endpoint("nope") is None


def test_resolve_intent_mapped():
    load_config(FIXTURE)
    assert resolve_intent("storybook") == "llm002"
    assert resolve_intent("summary") == "llm001"


def test_resolve_intent_unmapped_uses_default():
    load_config(FIXTURE)
    assert resolve_intent("unknown") == "llm001"


def test_resolve_intent_without_default_falls_back_to_llm001():
    load_config({"endpoints": {}, "intent_mapping": {"mappings": {}}})
    assert resolve_intent("unknown") == "llm001"
