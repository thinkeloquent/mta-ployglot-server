// REQUEST — {{fn:test_case_002}}. Used as Authorization header in test_providers.localhost_test_case_002.
export default function compute(_ctx, _path) {
  return `Basic ${Buffer.from("test-user:test-token-002").toString("base64")}`;
}
export const scope = "REQUEST";
