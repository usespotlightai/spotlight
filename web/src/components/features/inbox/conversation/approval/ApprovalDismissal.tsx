import { DecisionPill } from '@/components/shared/DecisionPill';
import { FieldInput } from '@/components/shared/form/FieldInput';
import type { Approval } from '@/lib/approval';

type ApprovalDismissalProps = {
  approval: Approval;
  pending: boolean;
  reason: string;
  onReason: (reason: string) => void;
  onDismiss: () => void;
  onCancel: () => void;
};

export function ApprovalDismissal({
  approval,
  pending,
  reason,
  onReason,
  onDismiss,
  onCancel,
}: ApprovalDismissalProps) {
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        onDismiss();
      }}
    >
      <FieldInput
        autoFocus
        value={reason}
        disabled={pending}
        onChange={(event) => onReason(event.target.value)}
        placeholder="Tell the agent why (optional)"
        aria-label={`Why dismiss ${approval.name}`}
        className="h-6 w-auto min-w-0 flex-1 border-0 bg-transparent px-0"
      />
      <DecisionPill type="button" disabled={pending} onClick={onCancel}>
        Cancel
      </DecisionPill>
      <DecisionPill
        type="submit"
        variant="default"
        disabled={pending}
        aria-label={`Dismiss ${approval.name}`}
      >
        Dismiss
      </DecisionPill>
    </form>
  );
}
