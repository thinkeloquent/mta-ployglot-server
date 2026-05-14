"""REQUEST — {{fn:request_token_001}}."""
import uuid
def compute(_ctx, _path=None): return f"req-001-{uuid.uuid4()}"
scope = "REQUEST"
