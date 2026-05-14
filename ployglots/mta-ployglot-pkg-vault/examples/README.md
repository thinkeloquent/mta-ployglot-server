# Examples

Three classes of example, each progressing from "library user" to "platform
operator":

| Folder                                  | Audience                        | Content                                          |
| --------------------------------------- | ------------------------------- | ------------------------------------------------ |
| [sdk/](sdk/)                            | Library consumer                | 5 runnable SDK scenarios + twin scripts.         |
| [api/](api/)                            | Library consumer                | 8 API contract entries (Goal → Signature → Notes). |
| [integration/](integration/)            | Platform operator               | Fastify + FastAPI addons, compose override, e2e smoke. |

The SDK and API folders hold no state; the integration scenarios optionally
drive two sibling repos (`mta-ployglot-server-bootstrap`,
`mta-ployglot-server`) and gracefully skip when those are absent.
