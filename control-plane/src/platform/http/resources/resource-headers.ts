export const API_VERSION = '2026-09-23';

export const SUPPORTED_API_VERSIONS: readonly string[] = [API_VERSION];

export const API_VERSION_HEADER = 'Spotlight-Api-Version';

export const CLIENT_HEADER = 'Spotlight-Client';

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

export const IDEMPOTENT_REPLAY_HEADER = 'Idempotent-Replayed';

export const IF_MATCH_HEADER = 'If-Match';

export const ETAG_HEADER = 'ETag';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export const RESOURCE_EXTENSION = 'x-spotlight-resource';

const ENTITY_TAG = /^"(\d+)"$/;

export const entityTagOf = (version: number): string => `"${version}"`;

export const versionIn = (entityTag: string): number | null => {
  const found = ENTITY_TAG.exec(entityTag.trim());

  return found ? Number(found[1]) : null;
};

export type RequestHeaders = Readonly<
  Record<string, string | string[] | undefined>
>;

export const headerIn = (
  headers: RequestHeaders,
  name: string,
): string | undefined => {
  const held = headers[name.toLowerCase()];

  return Array.isArray(held) ? held[0] : held;
};
