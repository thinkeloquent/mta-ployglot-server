"""REQUEST — {{fn:test_case_002}}."""
import base64
def compute(_ctx, _path=None):
    return "Basic " + base64.b64encode(b"test-user:test-token-002").decode()
scope = "REQUEST"
