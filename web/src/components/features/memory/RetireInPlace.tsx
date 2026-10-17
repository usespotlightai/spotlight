import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { SaidCard } from '@/components/features/inbox/conversation/SaidCard';
import { NOTE_BOX, PersonNote } from '@/components/features/memory/PersonNote';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
import { PillButton } from '@/components/shared/PillButton';
import { useRetireMemory } from '@/hooks/api/useRetireMemory';
import { useSession } from '@/hooks/api/useSession';
import { MAX_RETIRE_REASON } from '@/lib/memory';

type RetireInPlaceProps = {
  teamId: string;
  memoryId: string;
  onCancel: () => void;
};

export function RetireInPlace({
  teamId,
  memoryId,
  onCancel,
}: RetireInPlaceProps) {
  const { data: session } = useSession();
  const retire = useRetireMemory();
  const me = {
    name: session?.user.name ?? 'You',
    image: session?.user.image ?? null,
  };
  const [reason, setReason] = useState('');
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    form.current?.querySelector('textarea')?.focus({ preventScroll: true });
  }, []);
  const ready = reason.trim().length > 0 && !retire.isPending;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();

    if (ready) {
      retire.mutate({ teamId, memoryId, reason: reason.trim() });
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      submit();
    }
    if (event.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <form ref={form} aria-label="Retire this memory" onSubmit={submit}>
      <PersonNote
        avatar={<PersonAvatar person={me} size="md" />}
        name={me.name}
        about={<span className="text-muted-foreground">retiring this</span>}
      >
        <SaidCard className={NOTE_BOX}>
          <AutoGrowTextarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Why it no longer holds"
            aria-label="Why it no longer holds"
            maxLength={MAX_RETIRE_REASON}
            className="max-h-72 text-foreground text-sm leading-5"
          />
        </SaidCard>

        <div className="flex items-center justify-end gap-2 pt-1">
          <PillButton type="button" onClick={onCancel}>
            Cancel
          </PillButton>
          <PillButton type="submit" variant="default" disabled={!ready}>
            Retire
          </PillButton>
        </div>
      </PersonNote>
    </form>
  );
}
