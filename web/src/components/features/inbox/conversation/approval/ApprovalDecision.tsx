import { ApprovalApproveButton } from '@/components/features/inbox/conversation/approval/ApprovalApproveButton';
import { DecisionButton } from '@/components/shared/DecisionButton';
import { DecisionControls } from '@/components/shared/DecisionControls';
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
      <DecisionButton
        disabled={pending || !onDismiss}
        onClick={onDismiss}
        aria-label={`Dismiss ${approval.name}`}
      >
        Dismiss
      </DecisionButton>
      <ApprovalApproveButton
        approval={approval}
        disabled={pending || !onApprove}
        disabledBecause={onlyFor ? `Only ${onlyFor} can approve this` : null}
        onApprove={onApprove}
      />
    </DecisionControls>
  );
}
