import { useCommands } from '@/hooks/useCommands';
import { type FocusWithinResult, useFocusWithin } from '@/hooks/useFocusWithin';
import type { ApprovalMode } from '@/lib/approval';

type ApproveKey = {
  mode: ApprovalMode;
  docked: boolean;
  ready: boolean;
  blank: boolean;
  onlyFor: string | null;
  onApprove: () => void;
  onApproveEdited: () => void;
};

const approvalOf = ({
  mode,
  ready,
  blank,
  onlyFor,
  onApprove,
  onApproveEdited,
}: ApproveKey): (() => void) | null => {
  if (!ready) {
    return null;
  }
  if (mode === 'editing') {
    return blank ? null : onApproveEdited;
  }

  return mode === 'viewing' && (onlyFor === null || onlyFor === '')
    ? onApprove
    : null;
};

type ApproveKeyResult = {
  handlers: FocusWithinResult['handlers'];
  keyed: boolean;
};

export function useApproveKey(key: ApproveKey): ApproveKeyResult {
  const { focused, handlers } = useFocusWithin();
  const approve = approvalOf(key);

  const keyed = (focused || key.docked) && approve !== null;

  useCommands(keyed ? [{ id: 'approval.approve', run: approve }] : []);

  return { handlers, keyed };
}
