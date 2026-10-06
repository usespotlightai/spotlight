import { Plus } from 'lucide-react';
import { useState } from 'react';
import { MemoryForm } from '@/components/features/memory/MemoryForm';
import { Button } from '@/components/ui/button';
import { useLines } from '@/hooks/api/useLines';
import { useWriteMemory } from '@/hooks/api/useWriteMemory';

type WriteMemoryButtonProps = {
  teamId: string;
};

export function WriteMemoryButton({ teamId }: WriteMemoryButtonProps) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const lines = useLines(teamId);
  const write = useWriteMemory();

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="rounded-full bg-card shadow-none"
        onClick={() => {
          write.reset();
          setRound((each) => each + 1);
          setOpen(true);
        }}
      >
        <Plus aria-hidden className="size-3.5" />
        Write a memory
      </Button>

      <MemoryForm
        key={round}
        open={open}
        onOpenChange={setOpen}
        title="Write a memory"
        submitLabel="Keep it"
        initial={null}
        lines={lines.data ?? []}
        pending={write.isPending}
        onSave={(memory) =>
          write.mutate({ teamId, memory }, { onSuccess: () => setOpen(false) })
        }
      />
    </>
  );
}
