import logging

from app_yaml_loader import load_files

logging.basicConfig(level=logging.WARNING)

m = load_files(
    [
        "./examples/fixtures/explicit/a.yml",
        "./examples/fixtures/explicit/b.yml",
        "./examples/fixtures/explicit/c.yml",
    ],
    missing="skip",
)
print("keys:", [p.rsplit("/", 1)[-1] for p in m.keys()])
