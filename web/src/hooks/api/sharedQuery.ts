import type {
  QueryKey,
  QueryKeyWithDataTag,
  UnusedSkipTokenOptions,
} from '@tanstack/react-query';

export type SharedQuery<T, K extends QueryKey> = UnusedSkipTokenOptions<
  T,
  Error,
  T,
  K
> &
  QueryKeyWithDataTag<K, T>;
