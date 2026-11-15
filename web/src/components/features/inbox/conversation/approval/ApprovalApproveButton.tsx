import { DecisionButton } from '@/components/shared/DecisionButton';
import { DisabledReasonTooltip } from '@/components/shared/DisabledReasonTooltip';
import { ShortcutHint } from '@/components/shared/shortcut/ShortcutHint';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Approval } from '@/lib/approval';

type ApprovalApproveButtonProps = {
  approval: Approval;
  disabled: boolean;
  disabledBecause?: string | null;
  onApprove?: () => void;
};

export function ApprovalApproveButton({
  approval,
  disabled,
  disabledBecause = null,
  onApprove,
}: ApprovalApproveButtonProps) {
  if (!disabled) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <DecisionButton
              variant="default"
              onClick={onApprove}
              aria-label={`Approve ${approval.name}`}
            />
          }
        >
          Approve
        </TooltipTrigger>
        <TooltipContent side="top">
          <ShortcutHint id="approval.approve">Approve</ShortcutHint>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DisabledReasonTooltip reason={disabledBecause}>
      {(describedBy) => (
        <DecisionButton
          variant="default"
          disabled={disabled}
          aria-describedby={describedBy}
          onClick={onApprove}
          aria-label={`Approve ${approval.name}`}
        >
          Approve
        </DecisionButton>
      )}
    </DisabledReasonTooltip>
  );
}
