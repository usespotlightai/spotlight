import { type FormEvent, useState } from 'react';
import { InviteEmailsField } from '@/components/features/members/InviteEmailsField';
import { TeamsSelect } from '@/components/features/members/TeamsSelect';
import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import { Button } from '@/components/ui/button';
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useInviteToWorkspace } from '@/hooks/api/useInviteToWorkspace';
import {
  INVITE_ROLES,
  type InviteOutcome,
  type InviteRole,
  parseEmails,
  USUAL_INVITE_ROLE,
} from '@/lib/members';
import type { Team } from '@/lib/team';

const LABEL = 'font-medium text-foreground text-xs';

const CONTROL = 'w-44';

type InviteFormProps = {
  slug: string | undefined;
  teams: readonly Team[];
  teamIds: readonly string[];
  onSent: (outcomes: InviteOutcome[]) => void;
};

export function InviteForm({ slug, teams, teamIds, onSent }: InviteFormProps) {
  const invite = useInviteToWorkspace(slug);
  const [emails, setEmails] = useState('');
  const [checked, setChecked] = useState(false);
  const [role, setRole] = useState<InviteRole>(USUAL_INVITE_ROLE);
  const [chosen, setChosen] = useState<string[]>([...teamIds]);

  const parsed = parseEmails(emails);
  const busy = invite.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);

    if (busy || !slug || parsed.valid.length === 0 || parsed.invalid.length) {
      return;
    }

    invite.mutate(
      { emails: parsed.valid, role, teamIds: chosen },
      { onSuccess: onSent },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Invite people</DialogTitle>
        <DialogDescription>
          Each address gets a link by email. They join by signing in with that
          address.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={submit} className="contents">
        <InviteEmailsField
          value={emails}
          onChange={(next) => {
            setEmails(next);
            invite.isError && invite.reset();
          }}
          onBlur={() => setChecked(emails.trim().length > 0)}
          invalid={checked ? parsed.invalid : []}
          disabled={busy}
        />

        <div className="flex items-center justify-between gap-3">
          <span className={LABEL}>Invite as</span>
          <ChoiceSelect
            label="Invite as"
            choices={INVITE_ROLES}
            value={role}
            placeholder="Member"
            clearable={false}
            onChange={(next) => next && setRole(next as InviteRole)}
            disabled={busy}
            className={CONTROL}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className={LABEL}>Teams</span>
          <TeamsSelect
            teams={teams}
            value={chosen}
            onChange={setChosen}
            disabled={busy}
            className={CONTROL}
          />
        </div>

        {invite.isError && (
          <p role="alert" className="text-destructive text-xs">
            {invite.error.message}
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            size="sm"
            disabled={busy || parsed.valid.length === 0}
          >
            {busy ? 'Sending…' : 'Send invites'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
