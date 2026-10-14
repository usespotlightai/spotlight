import { Plus } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { PillButton } from '@/components/shared/PillButton';
import { WRITE_PARAM } from '@/lib/memory';

export function WriteMemoryButton() {
  const [, setParams] = useSearchParams();

  return (
    <PillButton
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
      <Plus aria-hidden className="size-3" />
      Write a memory
    </PillButton>
  );
}
