"""Resource stub tests — every resource class must raise NotImplementedError."""
import unittest

from polyglot_github_projects.resources.access import Access
from polyglot_github_projects.resources.attachments import Attachments
from polyglot_github_projects.resources.bulk import (
    Bulk,
    bulk_add_items,
    bulk_assign,
    bulk_move,
    bulk_update,
)
from polyglot_github_projects.resources.field_values import FieldValues
from polyglot_github_projects.resources.fields import Fields
from polyglot_github_projects.resources.items import Items
from polyglot_github_projects.resources.projects import Projects
from polyglot_github_projects.resources.relationships import Relationships
from polyglot_github_projects.resources.views import Views

RESOURCE_CLASSES = [
    Access,
    Attachments,
    Bulk,
    FieldValues,
    Fields,
    Items,
    Projects,
    Relationships,
    Views,
]

BULK_FUNCTIONS = [bulk_update, bulk_assign, bulk_move, bulk_add_items]


class TestResourceStubs(unittest.TestCase):
    def test_every_resource_class_raises(self):
        for cls in RESOURCE_CLASSES:
            with self.subTest(cls=cls.__name__):
                with self.assertRaises(NotImplementedError) as ctx:
                    cls()
                self.assertIn("placeholder", str(ctx.exception))

    def test_resource_classes_ignore_positional_and_keyword_args(self):
        for cls in RESOURCE_CLASSES:
            with self.subTest(cls=cls.__name__):
                with self.assertRaises(NotImplementedError):
                    cls("client", extra="kw")

    def test_bulk_functions_raise(self):
        for fn in BULK_FUNCTIONS:
            with self.subTest(fn=fn.__name__):
                with self.assertRaises(NotImplementedError) as ctx:
                    fn()
                self.assertIn("placeholder", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
