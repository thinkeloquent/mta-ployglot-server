# Examples

End-to-end runnable samples for `app-yaml-config`. CLI surface omitted (library-only).

| Surface | Folder         | When to use                                                   |
| ------- | -------------- | ------------------------------------------------------------- |
| SDK     | [`sdk/`](sdk/) | Embedding the config store inside another library or service. |
| API     | [`api/`](api/) | Reference for `AppYamlConfig`, `AppYamlConfigSDK`, merge fns. |

## Conventions

- Examples assume `make build` has been run in both packages.
- Examples between scenarios call `AppYamlConfig._resetForTesting()` to keep the singleton fresh.
