import { ApprovalDecision } from '@/components/features/inbox/conversation/approval/ApprovalDecision';
import { ApprovalDismissal } from '@/components/features/inbox/conversation/approval/ApprovalDismissal';
import { ApprovalEditControls } from '@/components/features/inbox/conversation/approval/ApprovalEditControls';
import type { Approval, ApprovalAnswer, ApprovalMode } from '@/lib/approval';

type ApprovalControlsProps = {
  approval: Approval;
  mode: ApprovalMode;
  pending: boolean;
  onlyFor: string | null;
  blank: boolean;
  reason: string;
  onReason: (reason: string) => void;
  onMode: (mode: ApprovalMode) => void;
  onApproveEdited: () => void;
  onDecide?: (answer: ApprovalAnswer) => void;
};

export function ApprovalControls({
  approval,
  mode,
  pending,
  onlyFor,
  blank,
  reason,
  onReason,
  onMode,
  onApproveEdited,
  onDecide,
}: ApprovalControlsProps) {
  if (!onDecide) {
    return <ApprovalDecision approval={approval} pending={false} />;
  }

  if (mode === 'editing') {
    return (
      <ApprovalEditControls
        approval={approval}
        pending={pending}
        blank={blank}
        onApprove={onApproveEdited}
        onCancel={() => onMode('viewing')}
      />
    );
  }

  if (mode === 'dismissing') {
    return (
      <ApprovalDismissal
        approval={approval}
        pending={pending}
        reason={reason}
        onReason={onReason}
        onDismiss={() => onDecide({ approve: false, body: reason })}
        onCancel={() => onMode('viewing')}
      />
    );
  }

  return (
    <ApprovalDecision
      approval={approval}
      pending={pending}
      onlyFor={onlyFor}
      onApprove={
        onlyFor ? undefined : () => onDecide({ approve: true, body: '' })
      }
      onDismiss={() => onMode('dismissing')}
    />
  );
}
