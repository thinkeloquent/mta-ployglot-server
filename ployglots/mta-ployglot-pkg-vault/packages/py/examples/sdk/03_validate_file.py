import sys

from polyglot_vault_file import VaultFileSDK

sdk = VaultFileSDK.create().build()
path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/missing.env"
r = sdk.validate_file(path)
print(r.data.model_dump_json(indent=2))
