from polyglot_vault_file import VaultFileSDK

sdk = VaultFileSDK.create().with_env_path(".env").build()
result = sdk.load_config()
if not result.success:
    print(f"load failed: {result.error}")
    raise SystemExit(1)
print(result.data.model_dump_json(by_alias=True))
