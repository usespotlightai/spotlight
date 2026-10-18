import { Plus } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { PillButton } from '@/components/shared/PillButton';
import { WRITE_PARAM } from '@/lib/memory';
import type { PillSize } from '@/lib/pill';

export function WriteMemoryButton({ size }: { size?: PillSize }) {
  const [, setParams] = useSearchParams();

  return (
    <PillButton
      size={size}
      onClick={() =>
        setParams(
          (was) => {
            const next = new URLSearchParams(was);
            next.set(WRITE_PARAM, '1');
            return next;
          },
          { replace: true },
        )
      }
    >
      <Plus aria-hidden className={size === 'regular' ? undefined : 'size-3'} />
      Write a memory
    </PillButton>
  );
}
