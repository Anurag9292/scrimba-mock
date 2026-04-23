import os

import aiofiles


class FileStorage:
    def __init__(self, upload_dir: str) -> None:
        self.upload_dir = upload_dir

    def ensure_dir(self) -> None:
        os.makedirs(self.upload_dir, exist_ok=True)

    async def save_file(self, filename: str, content: bytes) -> str:
        self.ensure_dir()
        path = os.path.join(self.upload_dir, filename)
        async with aiofiles.open(path, "wb") as f:
            await f.write(content)
        return path

    async def get_file_path(self, filename: str) -> str | None:
        path = os.path.join(self.upload_dir, filename)
        if os.path.exists(path):
            return path
        return None

    async def delete_file(self, filename: str) -> bool:
        path = os.path.join(self.upload_dir, filename)
        if os.path.exists(path):
            os.remove(path)
            return True
        return False
