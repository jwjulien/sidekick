def test_app_exists(client):
    assert client.app is not None
