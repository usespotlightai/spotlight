import type { ReactElement } from 'react';

import { ApprovalDecision } from '@/components/features/inbox/conversation/approval/ApprovalDecision';
import { ApprovalDismissal } from '@/components/features/inbox/conversation/approval/ApprovalDismissal';
import { ApprovalEditControls } from '@/components/features/inbox/conversation/approval/ApprovalEditControls';
import type { Approval, ApprovalAnswer, ApprovalMode } from '@/lib/approval';
import { nonEmpty } from '@/lib/non-empty';

type ApprovalControlsProps = {
  approval: Approval;
  mode: ApprovalMode;
  pending: boolean;
  onlyFor: string | null;
  blank: boolean;
  keyed: boolean;
  reason: string;
  onReason: (reason: string) => void;
  onMode: (mode: ApprovalMode) => void;
  onApproveEdited: () => void;
  outdated?: boolean;
  onDecide?: (answer: ApprovalAnswer) => void;
};

export function ApprovalControls({
  approval,
  mode,
  pending,
  onlyFor,
  blank,
  keyed,
  reason,
  onReason,
  onMode,
  onApproveEdited,
  outdated = false,
  onDecide,
}: ApprovalControlsProps): ReactElement | null {
  if (!onDecide) {
    return outdated ? (
      <p className="text-muted-foreground text-xs">
        The run asked for something newer since.
      </p>
    ) : null;
  }

  if (mode === 'editing') {
    return (
      <ApprovalEditControls
        approval={approval}
        pending={pending}
        blank={blank}
        keyed={keyed}
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
      keyed={keyed}
      onApprove={
        nonEmpty(onlyFor)
          ? undefined
          : () => onDecide({ approve: true, body: '' })
      }
      onDismiss={() => onMode('dismissing')}
    />
  );
}
