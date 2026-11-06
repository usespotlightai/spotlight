import {
  type InfiniteData,
  type QueryKey,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

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
}: PagedListOptions<T>) {
  const queryClient = useQueryClient();
  const list = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: (last) => last.next ?? undefined,
  });
  const head = useQuery({
    queryKey: [...queryKey, 'head'],
    enabled: enabled && pollMs !== undefined && list.isSuccess,
    queryFn: () => fetchPage(undefined),
    refetchInterval: pollMs,
    staleTime: pollMs,
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
      load: () => void list.fetchNextPage(),
    },
  };
}

export type PagedList<T> = ReturnType<typeof usePagedList<T>>;
