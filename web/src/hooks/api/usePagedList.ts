import {
  type InfiniteData,
  type QueryKey,
  type UseInfiniteQueryResult,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';

export type Page<T> = {
  readonly items: readonly T[];
  readonly next: string | null;
};

type PagedListOptions<T> = {
  readonly queryKey: QueryKey;
  readonly enabled: boolean;
  readonly fetchPage: (before: string | undefined) => Promise<Page<T>>;
  readonly keyOf: (item: NoInfer<T>) => string;
  readonly pollMs?: number;
  readonly staleTime?: () => number;
};

export type PagedList<T> = {
  readonly data: T[] | undefined;
  readonly isPending: boolean;
  readonly isFetching: boolean;
  readonly errorUpdateCount: number;
  readonly refetch: UseInfiniteQueryResult<InfiniteData<Page<T>>>['refetch'];
  readonly more: {
    readonly available: boolean;
    readonly loading: boolean;
    readonly failed: boolean;
    readonly load: () => void;
  };
};

const distinct = <T>(items: readonly T[], keyOf: (item: T) => string): T[] => {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = keyOf(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

export function usePagedList<T>({
  queryKey,
  enabled,
  fetchPage,
  keyOf,
  pollMs,
  staleTime,
}: PagedListOptions<T>): PagedList<T> {
  const queryClient = useQueryClient();
  const list = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: (last) => last.next ?? undefined,
    ...(staleTime === undefined ? {} : { staleTime }),
  });
  const head = useQuery({
    queryKey: [...queryKey, 'head'],
    enabled: enabled && pollMs !== undefined && list.isSuccess,
    queryFn: () => fetchPage(undefined),
    refetchInterval: pollMs,
    staleTime: staleTime ?? pollMs,
    initialData: () =>
      queryClient.getQueryData<InfiniteData<Page<T>>>(queryKey)?.pages[0],
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(queryKey)?.dataUpdatedAt,
  });

  const data = list.data
    ? distinct(
        [
          ...(head.data?.items ?? []),
          ...list.data.pages.flatMap((page) => page.items),
        ],
        keyOf,
      )
    : undefined;

  return {
    data,
    isPending: list.isPending,
    isFetching: list.isFetching,
    errorUpdateCount: list.errorUpdateCount,
    refetch: list.refetch,
    more: {
      available: list.hasNextPage,
      loading: list.isFetchingNextPage,
      failed: list.isFetchNextPageError,
      load: () => void list.fetchNextPage({ cancelRefetch: false }),
    },
  };
}

export function useReadEveryPage(
  list: PagedList<unknown>,
  when: boolean,
): boolean {
  const { available, loading, failed, load } = list.more;
  const reading = when && available && !failed;

  useEffect(() => {
    if (reading && !loading) {
      load();
    }
  }, [reading, loading, load]);

  return reading;
}
