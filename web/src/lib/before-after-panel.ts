import { createContext, useContext } from 'react';
import type { ChangeAt } from '@/lib/insights-changes';

export interface BeforeAfterPanel {
  readonly shown: ChangeAt | null;
  show(change: ChangeAt): void;
  close(): void;
}

const CLOSED: BeforeAfterPanel = {
  shown: null,
  show: () => {},
  close: () => {},
};

export const BeforeAfterPanelContext = createContext<BeforeAfterPanel>(CLOSED);

export const useBeforeAfterPanel = (): BeforeAfterPanel =>
  useContext(BeforeAfterPanelContext);
