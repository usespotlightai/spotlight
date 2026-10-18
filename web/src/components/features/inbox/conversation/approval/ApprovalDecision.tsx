import { ApprovalApproveButton } from '@/components/features/inbox/conversation/approval/ApprovalApproveButton';
import { DecisionControls } from '@/components/shared/DecisionControls';
import { DecisionPill } from '@/components/shared/DecisionPill';
import type { Approval } from '@/lib/approval';

type ApprovalDecisionProps = {
  approval: Approval;
  pending: boolean;
  onlyFor?: string | null;
  onApprove?: () => void;
  onDismiss?: () => void;
};

export function ApprovalDecision({
  approval,
  pending,
  onlyFor = null,
  onApprove,
  onDismiss,
}: ApprovalDecisionProps) {
  return (
    <DecisionControls>
      <DecisionPill
        disabled={pending || !onDismiss}
        onClick={onDismiss}
        aria-label={`Dismiss ${approval.name}`}
      >
        Dismiss
      </DecisionPill>
      <ApprovalApproveButton
        approval={approval}
        disabled={pending || !onApprove}
        disabledBecause={onlyFor ? `Only ${onlyFor} can approve this` : null}
        onApprove={onApprove}
      />
    </DecisionControls>
  );
}
