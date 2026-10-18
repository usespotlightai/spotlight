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
import type { InviteToWorkspaceRequestDto } from '@/lib/api';
import {
  INVITE_ROLES,
  type InviteRole,
  MAX_INVITED_AT_ONCE,
  parseEmails,
  USUAL_INVITE_ROLE,
} from '@/lib/members';
import type { Team } from '@/lib/team';

const LABEL = 'font-medium text-foreground text-xs';

const CONTROL = 'w-44';

type InviteFormProps = {
  teams: readonly Team[];
  teamIds: readonly string[];
  sending: boolean;
  failure: string | null;
  onSend: (spec: InviteToWorkspaceRequestDto) => void;
  onEdit: () => void;
};

export function InviteForm({
  teams,
  teamIds,
  sending,
  failure,
  onSend,
  onEdit,
}: InviteFormProps) {
  const [emails, setEmails] = useState('');
  const [checked, setChecked] = useState(false);
  const [role, setRole] = useState<InviteRole>(USUAL_INVITE_ROLE);
  const [chosen, setChosen] = useState<string[]>([...teamIds]);

  const parsed = parseEmails(emails);
  const tooMany = parsed.valid.length > MAX_INVITED_AT_ONCE;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setChecked(true);

    if (parsed.valid.length === 0 || parsed.invalid.length > 0 || tooMany) {
      return;
    }

    onSend({ emails: parsed.valid, role, teamIds: chosen });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Invite people</DialogTitle>
        <DialogDescription>
          Spotlight emails a link to each address. People join when they sign in
          with that address.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={submit} className="contents">
        <InviteEmailsField
          value={emails}
          onChange={(next) => {
            setEmails(next);
            onEdit();
          }}
          onBlur={() => setChecked(emails.trim().length > 0)}
          invalid={checked ? parsed.invalid : []}
          disabled={sending}
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
            disabled={sending}
            className={CONTROL}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className={LABEL}>Teams</span>
          <TeamsSelect
            teams={teams}
            value={chosen}
            onChange={setChosen}
            disabled={sending}
            className={CONTROL}
          />
        </div>

        {tooMany && (
          <p role="alert" className="text-destructive text-xs">
            Sorry, the list has {parsed.valid.length} addresses. Please invite
            at most {MAX_INVITED_AT_ONCE} at once.
          </p>
        )}

        {failure && (
          <p role="alert" className="text-destructive text-xs">
            {failure}
          </p>
        )}

        <DialogFooter>
          <DialogClose
            disabled={sending}
            render={<Button variant="outline" size="sm" />}
          >
            Cancel
          </DialogClose>
          <Button
            type="submit"
            size="sm"
            disabled={sending || tooMany || parsed.valid.length === 0}
          >
            {sending ? 'Sending…' : 'Send invites'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
