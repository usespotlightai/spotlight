import { createContext, useContext, useEffect } from 'react';

export type ReportTitle = (title: string) => () => void;

export const TabTitleContext = createContext<ReportTitle>(() => () => {});

export function useTabTitle(title: string | undefined) {
  const report = useContext(TabTitleContext);

  useEffect(() => (title ? report(title) : undefined), [report, title]);
}
