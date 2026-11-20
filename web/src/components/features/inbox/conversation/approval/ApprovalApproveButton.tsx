import { use } from 'react';

import { DecisionButton } from '@/components/shared/DecisionButton';
import { DisabledReasonTooltip } from '@/components/shared/DisabledReasonTooltip';
import { ShortcutHint } from '@/components/shared/shortcut/ShortcutHint';
import { ShortcutKeys } from '@/components/shared/shortcut/ShortcutKeys';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Approval } from '@/lib/approval';
import { DockedContext } from '@/lib/decision-tray';

type ApprovalApproveButtonProps = {
  approval: Approval;
  disabled: boolean;
  disabledBecause?: string | null;
  keyed?: boolean;
  onApprove?: () => void;
};

export function ApprovalApproveButton({
  approval,
  disabled,
  disabledBecause = null,
  keyed = false,
  onApprove,
}: ApprovalApproveButtonProps) {
  const docked = use(DockedContext) !== null;

  if (docked && !disabled) {
    return (
      <DecisionButton
        variant="default"
        onClick={onApprove}
        aria-label={`Approve ${approval.name}`}
        className="gap-1.5"
      >
        Approve
        {keyed && (
          <ShortcutKeys
            id="approval.approve"
            plain
            className="[&_kbd]:text-primary-foreground/70"
          />
        )}
      </DecisionButton>
    );
  }

  if (!disabled) {
    return (
      <Tooltip disabled={!keyed}>
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
