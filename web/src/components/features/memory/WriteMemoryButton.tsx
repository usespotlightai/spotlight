import { Plus } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { WRITE_PARAM } from '@/lib/memory';

export function WriteMemoryButton() {
  const [, setParams] = useSearchParams();

  return (
    <Button
      size="sm"
      variant="outline"
      className="rounded-full bg-card shadow-none"
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
      <Plus aria-hidden className="size-3.5" />
      Write a memory
    </Button>
  );
}
