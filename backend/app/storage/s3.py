import boto3

from app.storage.base import StorageService


class S3Storage(StorageService):
    """S3-compatible storage. Credentials come from the standard AWS env vars / instance role."""

    def __init__(self, bucket: str, region: str, public_url: str) -> None:
        if not bucket:
            raise ValueError("S3_BUCKET must be set when STORAGE_BACKEND=s3")
        self.bucket = bucket
        self.public_url = (public_url or f"https://{bucket}.s3.{region}.amazonaws.com").rstrip("/")
        self.client = boto3.client("s3", region_name=region or None)

    def put(self, key: str, data: bytes, content_type: str) -> str:
        self.client.put_object(
            Bucket=self.bucket, Key=key, Body=data, ContentType=content_type,
            CacheControl="public, max-age=31536000, immutable",
        )
        return f"{self.public_url}/{key}"

    def delete(self, url: str) -> None:
        if url.startswith(self.public_url + "/"):
            self.client.delete_object(Bucket=self.bucket, Key=url[len(self.public_url) + 1 :])
