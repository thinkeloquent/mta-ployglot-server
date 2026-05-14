# SDK Example: Globalize providers

## Goal

Show that a `global.timeout: 5000` declared in `base.yml` appears under every provider after `mergeGlobalIntoProviders`.

## Prerequisites

- `examples/fixtures/canonical/base.yml` contains:
```yaml
global:
  timeout: 5000
providers:
  gemini: {}
  openai:
    timeout: 1000
```

## Code

```js
import { AppYamlConfig, AppYamlConfigSDK } from '@ployglot/app-yaml-config';
AppYamlConfig._resetForTesting();
const sdk = await AppYamlConfigSDK.fromDirectory('./examples/fixtures/canonical');
console.log('gemini.timeout:', sdk.get('providers.gemini.timeout'));   // inherits global → 5000
console.log('openai.timeout:', sdk.get('providers.openai.timeout'));   // overrides → 1000
```

## Expected outcome

```
gemini.timeout: 5000
openai.timeout: 1000
```

## Notes

- This is the propagation step. Without it, `gemini.timeout` would be `undefined`.
