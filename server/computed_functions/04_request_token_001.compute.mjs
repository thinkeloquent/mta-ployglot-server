// REQUEST scope — fresh per call. Referenced as {{fn:request_token_001}} in server.dev.yaml.
import { randomUUID } from "node:crypto";
export default function compute(_ctx, _path) { return `req-001-${randomUUID()}`; }
export const scope = "REQUEST";
