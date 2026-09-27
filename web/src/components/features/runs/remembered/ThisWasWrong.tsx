import { useState } from 'react';
import { RetireMemoryDialog } from '@/components/features/memory/RetireMemoryDialog';
import { Button } from '@/components/ui/button';
import { useRetireMemory } from '@/hooks/api/useRetireMemory';

type ThisWasWrongProps = {
  teamId: string;
  memoryId: string;
};

export function ThisWasWrong({ teamId, memoryId }: ThisWasWrongProps) {
  const retire = useRetireMemory();
  const [retiring, setRetiring] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-xs"
        onClick={() => {
          retire.reset();
          setRetiring(true);
        }}
      >
        This was wrong
      </Button>

      {retiring && (
        <RetireMemoryDialog
          open={retiring}
          onOpenChange={setRetiring}
          pending={retire.isPending}
          failed={retire.isError}
          onRetire={(reason) =>
            retire.mutate(
              { teamId, memoryId, reason },
              { onSuccess: () => setRetiring(false) },
            )
          }
        />
      )}
    </>
  );
}
