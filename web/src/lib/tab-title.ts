import { createContext, useContext, useEffect } from 'react';

import { nonEmpty } from '@/lib/non-empty';

export type ReportTitle = (title: string) => () => void;

export const TabTitleContext = createContext<ReportTitle>(() => () => {});

export function useTabTitle(title: string | undefined): void {
  const report = useContext(TabTitleContext);

  useEffect(
    () => (nonEmpty(title) ? report(title) : undefined),
    [report, title],
  );
}
