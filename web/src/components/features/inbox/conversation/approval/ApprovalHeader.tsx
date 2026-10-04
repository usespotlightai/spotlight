import { RotateCwFadingClock } from 'lucide-react';
import { ApprovalActions } from '@/components/features/inbox/conversation/approval/ApprovalActions';
import type { Approval } from '@/lib/approval';

type ApprovalHeaderProps = {
  approval: Approval;
  pending: boolean;
  acting: boolean;
  onEdit?: () => void;
};

export function ApprovalHeader({
  approval,
  pending,
  acting,
  onEdit,
}: ApprovalHeaderProps) {
  const waiting = approval.standing === 'asked';

  if (!waiting && !acting) {
    return null;
  }

  return (
    <div className="mb-1 flex min-h-6 items-center gap-2">
      {waiting && (
        <h3 className="flex min-w-0 items-center gap-2 font-medium text-foreground text-sm">
          <RotateCwFadingClock aria-hidden className="size-4 shrink-0" />
          <span className="truncate">Waiting for your approval</span>
        </h3>
      )}

      {acting && (
        <div className="ml-auto">
          <ApprovalActions
            approval={approval}
            pending={pending}
            onEdit={onEdit}
          />
        </div>
      )}
    </div>
  );
}
