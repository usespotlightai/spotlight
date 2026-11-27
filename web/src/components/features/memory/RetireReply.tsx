import { RetireInPlace } from '@/components/features/memory/RetireInPlace';
import { COLLAPSE_MS, Collapsible } from '@/components/shared/Collapsible';
import { useDelayedValue } from '@/hooks/useDelayedValue';

type RetireReplyProps = {
  open: boolean;
  retirable: { readonly teamId: string; readonly memoryId: string } | null;
  onCancel: () => void;
  className?: string;
};

export function RetireReply({
  open,
  retirable,
  onCancel,
  className,
}: RetireReplyProps) {
  const shown = useDelayedValue(open ? true : null, COLLAPSE_MS);

  if (!shown || !retirable) {
    return null;
  }

  return (
    <Collapsible open={open} appear>
      <div className={className}>
        <RetireInPlace {...retirable} onCancel={onCancel} />
      </div>
    </Collapsible>
  );
}
