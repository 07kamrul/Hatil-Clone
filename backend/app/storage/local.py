from pathlib import Path

from app.storage.base import StorageService


class LocalStorage(StorageService):
    def __init__(self, root: str, url_prefix: str) -> None:
        self.root = Path(root).resolve()
        self.url_prefix = url_prefix.rstrip("/")
        self.root.mkdir(parents=True, exist_ok=True)

    def _path_for(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError("Invalid storage key")
        return path

    def put(self, key: str, data: bytes, content_type: str) -> str:
        path = self._path_for(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return f"{self.url_prefix}/{key}"

    def delete(self, url: str) -> None:
        if not url or not url.startswith(self.url_prefix + "/"):
            return
        path = self._path_for(url[len(self.url_prefix) + 1 :])
        path.unlink(missing_ok=True)
