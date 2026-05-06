// REQUEST scope — {{fn:request_token_005}}.
import { randomUUID } from "node:crypto";
export default function compute(_ctx, _path) { return `req-005-${randomUUID()}`; }
export const scope = "REQUEST";
