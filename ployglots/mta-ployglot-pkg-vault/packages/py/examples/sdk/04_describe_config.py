import sys

from polyglot_vault_file import VaultFileSDK

env_path = sys.argv[1] if len(sys.argv) > 1 else ".env"
sdk = VaultFileSDK.create().with_env_path(env_path).build()
sdk.load_config()
r = sdk.describe_config()
print(r.data.model_dump_json(indent=2, by_alias=True))
