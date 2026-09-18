import { createContext, useContext } from 'react';
import type { FileChange } from '@/lib/changes';

export interface ChangesPanel {
  readonly selected: FileChange | null;
  open(file: FileChange): void;
  close(): void;
}

const CLOSED: ChangesPanel = {
  selected: null,
  open: () => {},
  close: () => {},
};

export const ChangesPanelContext = createContext<ChangesPanel>(CLOSED);

export const useChangesPanel = (): ChangesPanel =>
  useContext(ChangesPanelContext);
