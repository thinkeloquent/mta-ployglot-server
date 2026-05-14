import polyglot_vault_file


def test_public_surface_exports_all_documented_names():
    for name in polyglot_vault_file.__all__:
        assert hasattr(polyglot_vault_file, name), f"missing public name: {name}"
        assert getattr(polyglot_vault_file, name) is not None


def test_all_list_length():
    assert len(polyglot_vault_file.__all__) == 22
