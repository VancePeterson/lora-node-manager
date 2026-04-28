import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


async def test_list_nodes_empty(client: AsyncClient):
    response = await client.get("/api/nodes")
    assert response.status_code == 200
    assert response.json() == []


async def test_get_gateway(client: AsyncClient):
    response = await client.get("/api/gateway")
    assert response.status_code == 200
    data = response.json()
    assert "online" in data
    assert "message_count" in data
