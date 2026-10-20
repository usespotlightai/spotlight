import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { MessageCard } from '@/components/features/inbox/conversation/MessageCard';
import { NOTE_BOX, PersonNote } from '@/components/features/memory/PersonNote';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
import { PillButton } from '@/components/shared/PillButton';
import { useRetireMemory } from '@/hooks/api/useRetireMemory';
import { useMe } from '@/hooks/useMe';
import { MAX_RETIRE_REASON } from '@/lib/memory';
import { YOU } from '@/lib/person';

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
  const me = useMe() ?? YOU;
  const retire = useRetireMemory();
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
        <MessageCard className={NOTE_BOX}>
          <AutoGrowTextarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Why it no longer applies"
            aria-label="Why it no longer applies"
            maxLength={MAX_RETIRE_REASON}
            className="max-h-72 text-foreground text-sm leading-5"
          />
        </MessageCard>

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
