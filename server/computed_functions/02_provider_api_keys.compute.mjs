// 02_provider_api_keys — STARTUP. Composite returning { gemini_openai, openai, anthropic, ... }.
// Accessed by server.dev.yaml as {{fn:provider_api_keys.<provider>}}. Each value is the
// corresponding *_API_KEY env var, or a "(unset:<name>)" placeholder so the resolver fills
// the field instead of leaving the literal template string.
const fromEnv = (name) => process.env[name] ?? `(unset:${name})`;

export default function compute(_ctx, _path) {
  return {
    gemini_openai: fromEnv("GEMINI_API_KEY"),
    openai: fromEnv("OPENAI_API_KEY"),
    openai_embeddings: fromEnv("OPENAI_API_KEY"),
    anthropic: fromEnv("ANTHROPIC_API_KEY"),
    figma: fromEnv("FIGMA_API_TOKEN"),
    github: fromEnv("GITHUB_API_TOKEN"),
    jira: fromEnv("JIRA_API_TOKEN"),
    confluence: fromEnv("CONFLUENCE_API_TOKEN"),
    saucelabs: fromEnv("SAUCE_ACCESS_KEY"),
    servicenow: fromEnv("SERVICENOW_PASSWORD"),
    rally: fromEnv("RALLY_API_KEY"),
    statsig: fromEnv("STATSIG_API_KEY"),
    sonar: fromEnv("SONAR_TOKEN"),
  };
}

export const scope = "STARTUP";
