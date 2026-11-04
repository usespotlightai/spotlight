import { createContext, use, useEffect, useRef } from 'react';

export type TakeFiles = (files: readonly File[]) => void;

export const FileDropContext = createContext<
  ((take: TakeFiles | null) => void) | null
>(null);

type Closed = { readonly disabled: boolean; readonly pending: boolean };

export function useFileDropTarget(
  take: TakeFiles,
  { disabled, pending }: Closed,
) {
  const register = use(FileDropContext);
  const latest = useRef(take);
  const taking = !disabled && !pending;

  useEffect(() => {
    latest.current = take;
  });

  useEffect(() => {
    if (!register || !taking) {
      return;
    }

    register((files) => latest.current(files));

    return () => register(null);
  }, [register, taking]);
}
