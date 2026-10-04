import { ApprovalApproveButton } from '@/components/features/inbox/conversation/approval/ApprovalApproveButton';
import { ApprovalPill } from '@/components/features/inbox/conversation/approval/ApprovalPill';
import type { Approval } from '@/lib/approval';

type ApprovalDecisionProps = {
  approval: Approval;
  pending: boolean;
  onApprove: () => void;
  onDismiss: () => void;
};

export function ApprovalDecision({
  approval,
  pending,
  onApprove,
  onDismiss,
}: ApprovalDecisionProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      <ApprovalPill
        disabled={pending}
        onClick={onDismiss}
        aria-label={`Dismiss ${approval.name}`}
      >
        Dismiss
      </ApprovalPill>
      <ApprovalApproveButton
        approval={approval}
        disabled={pending}
        onApprove={onApprove}
      />
    </div>
  );
}
