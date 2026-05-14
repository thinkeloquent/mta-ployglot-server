"""polyglot-github-projects — Python placeholder package.

The functional implementation lives in the sibling Node package
`@mta/github-projects`. This package locks the public surface for
a future Python port.
"""
from polyglot_github_projects.client import create_client

__version__ = "0.1.0"
__all__ = ["create_client", "__version__"]
