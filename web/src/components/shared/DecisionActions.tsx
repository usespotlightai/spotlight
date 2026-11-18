import { Pencil, Undo2 } from 'lucide-react';

import { CopyIconAction } from '@/components/shared/CopyIconAction';
import { IconAction } from '@/components/shared/IconAction';

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
}: DecisionActionsProps) {
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

      <CopyIconAction text={copy.text} label={copy.label} />
    </div>
  );
}
