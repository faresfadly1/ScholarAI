from pathlib import Path

import boto3
from botocore.config import Config

from app.core.config import settings


class Storage:
    def __init__(self):
        self.client = (
            boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint,
                aws_access_key_id=settings.s3_access_key,
                aws_secret_access_key=settings.s3_secret_key,
                region_name="us-east-1",
                config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
            )
            if settings.storage_backend == "s3"
            else None
        )
        self.root = Path(settings.storage_path).resolve()

    def path(self, key):
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError("Invalid storage key")
        return path

    def put(self, key, data, mime):
        if self.client:
            self.client.put_object(Bucket=settings.s3_bucket, Key=key, Body=data, ContentType=mime)
        else:
            path = self.path(key)
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            path.write_bytes(data)
            path.chmod(0o600)

    def get(self, key):
        if self.client:
            return self.client.get_object(Bucket=settings.s3_bucket, Key=key)["Body"].read()
        return self.path(key).read_bytes()

    def signed_url(self, key, mime, filename, expires_in=90):
        if not self.client:
            return None
        safe_filename = filename.replace('"', "").replace("\\", "_").replace("\r", "").replace("\n", "")[:200]
        return self.client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.s3_bucket,
                "Key": key,
                "ResponseContentType": mime,
                "ResponseContentDisposition": f'attachment; filename="{safe_filename}"',
            },
            ExpiresIn=expires_in,
        )

    def delete(self, key):
        if self.client:
            self.client.delete_object(Bucket=settings.s3_bucket, Key=key)
        else:
            self.path(key).unlink(missing_ok=True)


storage = Storage()
