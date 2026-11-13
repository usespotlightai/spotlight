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
      className={
        size === 'regular'
          ? undefined
          : 'h-7 w-7 px-0 text-sm @md/pane:w-auto @md/pane:px-3'
      }
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
      <Plus
        aria-hidden
        className={size === 'regular' ? undefined : 'size-3.5'}
      />
      {size === 'regular' ? (
        'Write a memory'
      ) : (
        <span className="sr-only @md/pane:not-sr-only">Write a memory</span>
      )}
    </PillButton>
  );
}
