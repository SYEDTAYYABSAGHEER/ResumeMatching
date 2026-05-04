from io import BytesIO
from uuid import uuid4

from minio import Minio
from minio.error import S3Error

from app.core.config import settings


def _minio_client() -> Minio:
    secure = settings.minio_endpoint.startswith('https://')
    endpoint = settings.minio_endpoint.replace('https://', '').replace('http://', '')
    return Minio(
        endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=secure,
    )


def upload_bytes_to_minio(file_bytes: bytes, filename: str, content_type: str = 'application/octet-stream') -> str:
    client = _minio_client()
    bucket_name = settings.minio_bucket

    found = client.bucket_exists(bucket_name)
    if not found:
        client.make_bucket(bucket_name)

    object_name = f'candidate-docs/{uuid4()}-{filename}'
    data = BytesIO(file_bytes)
    client.put_object(
        bucket_name,
        object_name,
        data,
        length=len(file_bytes),
        content_type=content_type,
    )
    return object_name


def safe_upload_bytes_to_minio(file_bytes: bytes, filename: str, content_type: str = 'application/octet-stream') -> str | None:
    try:
        return upload_bytes_to_minio(file_bytes, filename, content_type)
    except S3Error:
        return None
    except Exception:
        return None
