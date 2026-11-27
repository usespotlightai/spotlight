import { Pencil, Undo2 } from 'lucide-react';
import { use, type ReactElement } from 'react';

import { CopyIconAction } from '@/components/shared/CopyIconAction';
import { IconAction } from '@/components/shared/IconAction';
import { DockedContext } from '@/lib/decision-tray';

type DecisionActionsProps = {
  copy: { text: string; label: string };
  editLabel: string;
  pending: boolean;
  onEdit?: () => void;
  restoreLabel?: string;
  onRestore?: () => void;
};

export function DecisionActions({
  copy,
  editLabel,
  pending,
  onEdit,
  restoreLabel,
  onRestore,
}: DecisionActionsProps): ReactElement {
  const docked = use(DockedContext) !== null;

  return (
    <div className="flex items-center gap-0.5">
      {onRestore && (
        <IconAction
          label={restoreLabel ?? 'Restore'}
          tip="Restore"
          disabled={pending}
          focusNext
          onClick={onRestore}
        >
          <Undo2 />
        </IconAction>
      )}

      {onEdit && (
        <IconAction
          label={editLabel}
          tip="Edit"
          disabled={pending}
          onClick={onEdit}
        >
          <Pencil />
        </IconAction>
      )}

      {!docked && <CopyIconAction text={copy.text} label={copy.label} />}
    </div>
  );
}
