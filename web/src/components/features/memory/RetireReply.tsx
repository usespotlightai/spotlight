import { RetireInPlace } from '@/components/features/memory/RetireInPlace';
import { UNFOLD_MS, Unfold } from '@/components/shared/Unfold';
import { useLingering } from '@/hooks/useLingering';

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
  const shown = useLingering(open ? true : null, UNFOLD_MS);

  if (!shown || !retirable) {
    return null;
  }

  return (
    <Unfold open={open} appear>
      <div className={className}>
        <RetireInPlace {...retirable} onCancel={onCancel} />
      </div>
    </Unfold>
  );
}
