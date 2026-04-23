import os
import tempfile

import pytest
import pytest_asyncio

from app.storage.file_storage import FileStorage


@pytest_asyncio.fixture()
async def storage(tmp_path):
    """Provide a FileStorage instance backed by a temporary directory."""
    return FileStorage(str(tmp_path))


@pytest.mark.asyncio
async def test_save_file_creates_file_and_returns_path(storage: FileStorage):
    content = b"hello world"
    path = await storage.save_file("test.txt", content)

    assert os.path.exists(path)
    assert path.endswith("test.txt")
    with open(path, "rb") as f:
        assert f.read() == content


@pytest.mark.asyncio
async def test_get_file_path_returns_path_for_existing_file(storage: FileStorage):
    await storage.save_file("exists.txt", b"data")

    result = await storage.get_file_path("exists.txt")
    assert result is not None
    assert result.endswith("exists.txt")


@pytest.mark.asyncio
async def test_get_file_path_returns_none_for_nonexistent_file(storage: FileStorage):
    result = await storage.get_file_path("no_such_file.txt")
    assert result is None


@pytest.mark.asyncio
async def test_delete_file_removes_the_file(storage: FileStorage):
    await storage.save_file("to_delete.txt", b"bye")

    deleted = await storage.delete_file("to_delete.txt")
    assert deleted is True

    # File should no longer exist
    result = await storage.get_file_path("to_delete.txt")
    assert result is None


@pytest.mark.asyncio
async def test_delete_file_returns_false_for_nonexistent_file(storage: FileStorage):
    deleted = await storage.delete_file("ghost.txt")
    assert deleted is False


@pytest.mark.asyncio
async def test_ensure_dir_creates_directory():
    with tempfile.TemporaryDirectory() as base:
        nested = os.path.join(base, "sub", "dir")
        fs = FileStorage(nested)

        assert not os.path.exists(nested)
        fs.ensure_dir()
        assert os.path.isdir(nested)
