import { ApprovalApproveButton } from '@/components/features/inbox/conversation/approval/ApprovalApproveButton';
import { DecisionButton } from '@/components/shared/DecisionButton';
import { DecisionControls } from '@/components/shared/DecisionControls';
import type { Approval } from '@/lib/approval';
import { nonEmpty } from '@/lib/non-empty';

type ApprovalDecisionProps = {
  approval: Approval;
  pending: boolean;
  onlyFor?: string | null;
  keyed?: boolean;
  onApprove?: () => void;
  onDismiss?: () => void;
};

export function ApprovalDecision({
  approval,
  pending,
  onlyFor = null,
  keyed = false,
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
        disabledBecause={
          nonEmpty(onlyFor) ? `Only ${onlyFor} can approve this` : null
        }
        keyed={keyed}
        onApprove={onApprove}
      />
    </DecisionControls>
  );
}
