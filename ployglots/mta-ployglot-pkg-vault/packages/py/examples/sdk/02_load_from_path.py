import sys

from polyglot_vault_file import VaultFileSDK

sdk = VaultFileSDK.create().build()
path = sys.argv[1] if len(sys.argv) > 1 else "./.env"
r = sdk.load_from_path(path)
print(r.data.model_dump_json(by_alias=True) if r.success else r.error)
