import { createContext, useContext } from 'react';
import type { FileChange } from '@/lib/changes';

export interface ChangesPanel {
  readonly selected: FileChange | null;
  open(file: FileChange): void;
  close(): void;
}

// Defaults to a closed, inert panel so a row still renders without a provider.
const CLOSED: ChangesPanel = {
  selected: null,
  open: () => {},
  close: () => {},
};

export const ChangesPanelContext = createContext<ChangesPanel>(CLOSED);

export const useChangesPanel = (): ChangesPanel =>
  useContext(ChangesPanelContext);
