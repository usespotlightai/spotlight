import { createContext, useContext, useMemo } from 'react';

import type { ChangeAt } from '@/lib/insights-changes';

export interface BeforeAfterActions {
  show: (change: ChangeAt) => void;
  close: () => void;
}

export interface BeforeAfterPanel extends BeforeAfterActions {
  readonly shown: ChangeAt | null;
}

const CLOSED: BeforeAfterActions = {
  show: () => {},
  close: () => {},
};

export const BeforeAfterActionsContext =
  createContext<BeforeAfterActions>(CLOSED);

export const BeforeAfterShownContext = createContext<ChangeAt | null>(null);

export const useBeforeAfterActions = (): BeforeAfterActions =>
  useContext(BeforeAfterActionsContext);

export const useBeforeAfterShown = (): ChangeAt | null =>
  useContext(BeforeAfterShownContext);

export const useBeforeAfterPanel = (): BeforeAfterPanel => {
  const { show, close } = useBeforeAfterActions();
  const shown = useBeforeAfterShown();

  return useMemo(() => ({ shown, show, close }), [shown, show, close]);
};
