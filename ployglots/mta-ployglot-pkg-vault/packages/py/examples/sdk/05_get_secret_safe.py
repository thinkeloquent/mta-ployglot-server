from polyglot_vault_file import VaultFileSDK

sdk = VaultFileSDK.create().with_env_path("packages/py/tests/fixtures/.env.mixed").build()
sdk.load_config()
print("known:", sdk.get_secret_safe("SHARED").model_dump_json())
print("missing:", sdk.get_secret_safe("NOT_PRESENT").model_dump_json())
