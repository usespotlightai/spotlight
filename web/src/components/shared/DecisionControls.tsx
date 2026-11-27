import { type ReactNode, use } from 'react';
import { createPortal } from 'react-dom';

import { DockedContext } from '@/lib/decision-tray';

export function DecisionControls({ children }: { children: ReactNode }) {
  const docked = use(DockedContext);
  const row = (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {children}
    </div>
  );

  return docked?.controls ? createPortal(row, docked.controls) : row;
}
