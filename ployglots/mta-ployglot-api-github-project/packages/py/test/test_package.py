"""Package-level tests mirroring @mta/github-projects test/index.test.mjs."""
import unittest

import polyglot_github_projects
from polyglot_github_projects import __version__, create_client
from polyglot_github_projects.client import Client


class TestPackageSurface(unittest.TestCase):
    def test_exports_version(self):
        self.assertEqual(__version__, "0.1.0")
        self.assertEqual(polyglot_github_projects.__version__, "0.1.0")

    def test_all_exports(self):
        self.assertIn("create_client", polyglot_github_projects.__all__)
        self.assertIn("__version__", polyglot_github_projects.__all__)

    def test_create_client_raises_not_implemented(self):
        with self.assertRaises(NotImplementedError) as ctx:
            create_client(token="ghp_xxx")
        self.assertIn("placeholder", str(ctx.exception))

    def test_create_client_accepts_documented_kwargs(self):
        with self.assertRaises(NotImplementedError):
            create_client(token="t", host="api.github.com", proxy=None)

    def test_create_client_without_args_raises_not_implemented(self):
        with self.assertRaises(NotImplementedError):
            create_client()

    def test_client_class_raises_not_implemented(self):
        with self.assertRaises(NotImplementedError):
            Client()


if __name__ == "__main__":
    unittest.main()
