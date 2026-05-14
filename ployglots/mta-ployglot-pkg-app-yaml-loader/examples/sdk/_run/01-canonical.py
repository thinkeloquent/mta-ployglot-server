from app_yaml_loader import load_from_config_dir

m = load_from_config_dir(config_dir="./examples/fixtures/canonical", app_env="test")
for path, parsed in m.items():
    print(path, "→", list(parsed.keys())[:3])
