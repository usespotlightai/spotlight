import { createContext, useContext, useEffect } from 'react';

export type ReportTitle = (title: string) => () => void;

export const TabTitleContext = createContext<ReportTitle>(() => () => {});

export function useTabTitle(title: string | undefined): void {
  const report = useContext(TabTitleContext);

  useEffect(
    () => (title !== undefined && title !== '' ? report(title) : undefined),
    [report, title],
  );
}
