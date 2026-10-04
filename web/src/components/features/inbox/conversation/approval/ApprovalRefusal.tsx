import { ApprovalPill } from '@/components/features/inbox/conversation/approval/ApprovalPill';
import { FieldInput } from '@/components/shared/form/FieldInput';
import type { Approval } from '@/lib/approval';

type ApprovalRefusalProps = {
  approval: Approval;
  pending: boolean;
  reason: string;
  onReason: (reason: string) => void;
  onRefuse: () => void;
  onCancel: () => void;
};

export function ApprovalRefusal({
  approval,
  pending,
  reason,
  onReason,
  onRefuse,
  onCancel,
}: ApprovalRefusalProps) {
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        onRefuse();
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
      <ApprovalPill type="button" disabled={pending} onClick={onCancel}>
        Cancel
      </ApprovalPill>
      <ApprovalPill
        type="submit"
        variant="default"
        disabled={pending}
        aria-label={`Dismiss ${approval.name}`}
      >
        Dismiss
      </ApprovalPill>
    </form>
  );
}
