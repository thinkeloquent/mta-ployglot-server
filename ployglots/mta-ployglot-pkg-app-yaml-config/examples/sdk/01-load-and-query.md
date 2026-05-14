# SDK Example: Load and query

## Goal

Load a config dir via `AppYamlConfigSDK.fromDirectory` and query providers.

## Prerequisites

- `examples/fixtures/canonical/` populated with a base.yml + server.test.yaml + endpoint.test.yaml.
- `app-yaml-loader` installed (mjs `npm install app-yaml-loader`, py `pip install app_yaml_loader`).

## Code

```js
import { AppYamlConfig, AppYamlConfigSDK } from '@ployglot/app-yaml-config';

AppYamlConfig._resetForTesting();
const sdk = await AppYamlConfigSDK.fromDirectory('./examples/fixtures/canonical');

console.log('providers:', sdk.listProviders());
console.log('gemini.api_key:', sdk.get('providers.gemini.api_key', '(none)'));
```

## Expected outcome

```
providers: [ 'gemini', 'openai' ]
gemini.api_key: <value-from-yaml>
```

## Notes

- Singleton state is process-local; reset between examples.
