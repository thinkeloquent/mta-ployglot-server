"""Coverage for the 5 new domain resources + the extended
Files/Comments endpoints on the py side.
"""

import pytest

from figma_api import FigmaClient

from ._helpers import FakeFetchClient, FakeResponse


def _ok_fake():
    return FakeFetchClient(lambda _: FakeResponse(status=200, body={}))


@pytest.mark.asyncio
async def test_components_list_for_team():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.components.list_for_team("42", page_size=100)
    assert fake.calls[0].method == "GET"
    assert fake.calls[0].path == "/v1/teams/42/components"
    assert fake.calls[0].kwargs["params"] == {"page_size": 100}


@pytest.mark.asyncio
async def test_components_list_for_file_and_get():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.components.list_for_file("FILE")
    await client.components.get("abc")
    assert fake.calls[0].path == "/v1/files/FILE/components"
    assert fake.calls[1].path == "/v1/components/abc"


@pytest.mark.asyncio
async def test_components_styles_and_sets_routes():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.components.list_styles_for_team("42")
    await client.components.get_style("S")
    await client.components.list_component_sets_for_team("42")
    await client.components.get_component_set("CS")
    paths = [c.path for c in fake.calls]
    assert paths == [
        "/v1/teams/42/styles",
        "/v1/styles/S",
        "/v1/teams/42/component_sets",
        "/v1/component_sets/CS",
    ]


@pytest.mark.asyncio
async def test_variables_enterprise():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.variables.list_local("FILE")
    await client.variables.list_published("FILE")
    await client.variables.post_variables("FILE", {"variables": [{"id": "v1"}]})
    paths = [(c.method, c.path) for c in fake.calls]
    assert paths == [
        ("GET", "/v1/files/FILE/variables/local"),
        ("GET", "/v1/files/FILE/variables/published"),
        ("POST", "/v1/files/FILE/variables"),
    ]
    assert fake.calls[2].kwargs["json"] == {"variables": [{"id": "v1"}]}


@pytest.mark.asyncio
async def test_dev_resources():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.dev_resources.list("F", ["1:2", "3:4"])
    await client.dev_resources.create(
        [{"name": "x", "url": "https://a", "file_key": "F", "node_id": "1:2"}]
    )
    await client.dev_resources.delete("F", "DR1")
    assert fake.calls[0].path == "/v1/files/F/dev_resources"
    assert fake.calls[0].kwargs["params"] == {"node_ids": "1:2,3:4"}
    assert fake.calls[1].method == "POST"
    assert fake.calls[1].path == "/v1/dev_resources"
    assert fake.calls[1].kwargs["json"] == {
        "dev_resources": [{"name": "x", "url": "https://a", "file_key": "F", "node_id": "1:2"}]
    }
    assert fake.calls[2].method == "DELETE"
    assert fake.calls[2].path == "/v1/files/F/dev_resources/DR1"


@pytest.mark.asyncio
async def test_library_analytics_enterprise():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.library_analytics.component_actions(
        "FILE", group_by="team", order="desc", start_date="2026-01-01"
    )
    await client.library_analytics.component_usages("FILE", group_by="file")
    await client.library_analytics.style_actions("FILE", group_by="style")
    await client.library_analytics.style_usages("FILE", group_by="style")
    await client.library_analytics.variable_actions("FILE", group_by="variable")
    await client.library_analytics.variable_usages("FILE", group_by="variable")

    suffixes = [c.path.replace("/v1/analytics/libraries/FILE/", "") for c in fake.calls]
    assert suffixes == [
        "component/actions",
        "component/usages",
        "style/actions",
        "style/usages",
        "variable/actions",
        "variable/usages",
    ]
    assert fake.calls[0].kwargs["params"] == {
        "group_by": "team",
        "order": "desc",
        "start_date": "2026-01-01",
    }


@pytest.mark.asyncio
async def test_webhooks_v2():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.webhooks.create(
        {
            "event_type": "FILE_UPDATE",
            "team_id": "T",
            "endpoint": "https://a.example",
            "passcode": "p",
        }
    )
    await client.webhooks.get("W")
    await client.webhooks.delete("W")
    await client.webhooks.list_for_team("T")
    await client.webhooks.requests("W")
    routes = [(c.method, c.path) for c in fake.calls]
    assert routes == [
        ("POST", "/v2/webhooks"),
        ("GET", "/v2/webhooks/W"),
        ("DELETE", "/v2/webhooks/W"),
        ("GET", "/v2/teams/T/webhooks"),
        ("GET", "/v2/webhooks/W/requests"),
    ]


@pytest.mark.asyncio
async def test_files_extended():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.files.versions("F", page_size=10)
    await client.files.meta("F")
    await client.files.image_fills("F")
    assert [c.path for c in fake.calls] == [
        "/v1/files/F/versions",
        "/v1/files/F/meta",
        "/v1/files/F/images",
    ]


@pytest.mark.asyncio
async def test_comments_reactions():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.comments.reactions("F", "C1")
    await client.comments.add_reaction("F", "C1", "🎉")
    await client.comments.remove_reaction("F", "C1", "🎉")
    routes = [(c.method, c.path) for c in fake.calls]
    assert routes == [
        ("GET", "/v1/files/F/comments/C1/reactions"),
        ("POST", "/v1/files/F/comments/C1/reactions"),
        ("DELETE", "/v1/files/F/comments/C1/reactions"),
    ]
    assert fake.calls[1].kwargs["json"] == {"emoji": "🎉"}
    assert fake.calls[2].kwargs["params"] == {"emoji": "🎉"}


@pytest.mark.asyncio
async def test_comments_crud_create_minimal_and_full():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)

    # Minimal — only `message`.
    await client.comments.create("F", message="hi")
    assert fake.calls[0].method == "POST"
    assert fake.calls[0].path == "/v1/files/F/comments"
    assert fake.calls[0].kwargs["json"] == {"message": "hi"}

    # Full — with client_meta + comment_id threaded into body.
    await client.comments.create(
        "F", message="reply", client_meta={"x": 1}, comment_id="PARENT"
    )
    assert fake.calls[1].kwargs["json"] == {
        "message": "reply",
        "client_meta": {"x": 1},
        "comment_id": "PARENT",
    }


@pytest.mark.asyncio
async def test_comments_list_fallback_on_missing_envelope():
    """API returns a dict without `comments` → client returns []."""
    fake = FakeFetchClient(lambda _: FakeResponse(status=200, body={}))
    client = FigmaClient(token="t", fetch_client=fake)
    assert await client.comments.list("F") == []


@pytest.mark.asyncio
async def test_comments_list_fallback_on_non_dict():
    """API returns a non-dict shape → client still returns []."""
    fake = FakeFetchClient(lambda _: FakeResponse(status=200, body=["not", "a", "dict"]))
    client = FigmaClient(token="t", fetch_client=fake)
    assert await client.comments.list("F") == []


@pytest.mark.asyncio
async def test_comments_delete():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.comments.delete("F", "C42")
    assert fake.calls[0].method == "DELETE"
    assert fake.calls[0].path == "/v1/files/F/comments/C42"


@pytest.mark.asyncio
async def test_files_nodes_and_images_variants():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.files.nodes("F", ["1:2", "3:4"])
    await client.files.images("F", ["1:2"], format="png", scale=2)
    await client.files.images("F", ["1:2"])  # no format/scale
    assert fake.calls[0].path == "/v1/files/F/nodes"
    assert fake.calls[0].kwargs["params"] == {"ids": "1:2,3:4"}
    assert fake.calls[1].kwargs["params"] == {"ids": "1:2", "format": "png", "scale": 2}
    assert fake.calls[2].kwargs["params"] == {"ids": "1:2"}


@pytest.mark.asyncio
async def test_files_get_with_all_options():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.files.get(
        "F",
        version="V1",
        ids=["1:2"],
        depth=3,
        geometry="paths",
        plugin_data="all",
        branch_data=True,
    )
    assert fake.calls[0].kwargs["params"] == {
        "version": "V1",
        "ids": "1:2",
        "depth": 3,
        "geometry": "paths",
        "plugin_data": "all",
        "branch_data": True,
    }


@pytest.mark.asyncio
async def test_files_versions_before_after_and_empty():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.files.versions("F", before="B", after="A")
    await client.files.versions("F")
    assert fake.calls[0].kwargs["params"] == {"before": "B", "after": "A"}
    assert fake.calls[1].kwargs["params"] == {}


@pytest.mark.asyncio
async def test_components_list_component_sets_for_file():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.components.list_component_sets_for_file("F")
    assert fake.calls[0].path == "/v1/files/F/component_sets"


@pytest.mark.asyncio
async def test_components_list_styles_for_file():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.components.list_styles_for_file("F")
    assert fake.calls[0].path == "/v1/files/F/styles"


@pytest.mark.asyncio
async def test_components_page_cursor_branches():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.components.list_for_team("T", after="CURSOR", before="OTHER")
    assert fake.calls[0].kwargs["params"] == {"after": "CURSOR", "before": "OTHER"}


@pytest.mark.asyncio
async def test_dev_resources_update_and_list_no_nodes():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.dev_resources.update([{"id": "D1", "name": "new"}])
    await client.dev_resources.list("F")  # no node_ids
    assert fake.calls[0].method == "POST"
    assert fake.calls[0].kwargs["json"] == {"dev_resources": [{"id": "D1", "name": "new"}]}
    assert fake.calls[1].kwargs["params"] == {}


@pytest.mark.asyncio
async def test_projects_list_files_and_no_pagination():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.projects.list_files("P1")
    await client.projects.list_for_team("T1")
    assert fake.calls[0].path == "/v1/projects/P1/files"
    assert fake.calls[1].path == "/v1/teams/T1/projects"


@pytest.mark.asyncio
async def test_webhooks_update():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    await client.webhooks.update("W", {"endpoint": "https://b.example"})
    assert fake.calls[0].method == "POST"
    assert fake.calls[0].path == "/v2/webhooks/W"
    assert fake.calls[0].kwargs["json"] == {"endpoint": "https://b.example"}


@pytest.mark.asyncio
async def test_library_analytics_param_branches():
    fake = _ok_fake()
    client = FigmaClient(token="t", fetch_client=fake)
    # group_by only.
    await client.library_analytics.component_actions("F", group_by="team")
    # group_by + cursor.
    await client.library_analytics.component_actions("F", group_by="team", cursor="C1")
    # group_by + end_date only (start_date undefined).
    await client.library_analytics.component_actions(
        "F", group_by="team", end_date="2026-02-01"
    )
    assert fake.calls[0].kwargs["params"] == {"group_by": "team"}
    assert fake.calls[1].kwargs["params"] == {"group_by": "team", "cursor": "C1"}
    assert fake.calls[2].kwargs["params"] == {"group_by": "team", "end_date": "2026-02-01"}
