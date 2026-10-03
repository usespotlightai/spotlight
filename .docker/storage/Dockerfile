# MinIO no longer publishes images to quay.io or Docker Hub, so this uses
# Chainguard's build, pinned by digest. It ships minio, mc and sh.
ARG MINIO_IMAGE=cgr.dev/chainguard/minio@sha256:0f95aa412a12351a95bb43c3b54b66440eb0aa022bb3f3458942678a489e915b

FROM ${MINIO_IMAGE} AS storage

# The image runs as a non-root user; the storage volume was written as root.
USER root

EXPOSE 9000

FROM ${MINIO_IMAGE} AS bucket

COPY .docker/storage/bucket /usr/local/bin/bucket
ENTRYPOINT [ "/usr/local/bin/bucket" ]
