import { createContext, useContext, useEffect } from 'react';

export type TabReports = {
  readonly title: (title: string) => () => void;
  readonly label: (label: string) => void;
  readonly missing: () => void;
};

export const TabTitleContext = createContext<TabReports>({
  title: () => () => {},
  label: () => {},
  missing: () => {},
});

export function useTabTitle(title: string | undefined) {
  const { title: report } = useContext(TabTitleContext);

  useEffect(() => (title ? report(title) : undefined), [report, title]);
}

export function useTabLabel(label: string | undefined) {
  const { label: report } = useContext(TabTitleContext);

  useEffect(() => {
    if (label) {
      report(label);
    }
  }, [report, label]);
}

export function useMissingTab() {
  const { missing } = useContext(TabTitleContext);

  useEffect(() => missing(), [missing]);
}
