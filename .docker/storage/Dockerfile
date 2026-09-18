ARG MINIO_VERSION=RELEASE.2025-04-22T22-12-26Z

FROM quay.io/minio/minio:${MINIO_VERSION} AS storage

EXPOSE 9000

FROM quay.io/minio/minio:${MINIO_VERSION} AS bucket

COPY .docker/storage/bucket /usr/local/bin/bucket
ENTRYPOINT [ "/usr/local/bin/bucket" ]
