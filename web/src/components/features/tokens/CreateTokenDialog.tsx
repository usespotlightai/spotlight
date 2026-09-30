import { type FormEvent, useId, useState } from 'react';
import { TokenAccessField } from '@/components/features/tokens/TokenAccessField';
import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import { FieldInput } from '@/components/shared/form/FieldInput';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  type CreatedWorkspaceToken,
  useCreateWorkspaceToken,
  WorkspaceTokenNameTakenError,
} from '@/hooks/api/useCreateWorkspaceToken';
import { messageOf } from '@/lib/error';
import { sanitizeSlug, slugify } from '@/lib/slug';
import {
  expiryAfter,
  LIFETIMES,
  scopesOf,
  type TokenGrant,
  type TokenReach,
  USUAL_LIFETIME,
} from '@/lib/token';

const LONGEST_NAME = 64;

const LONGEST_DESCRIPTION = 255;

const LABEL = 'font-medium text-foreground text-xs';

const refusal = (error: unknown): string =>
  error instanceof WorkspaceTokenNameTakenError
    ? `A token named ${error.token} already exists. Choose another name.`
    : messageOf(error);

type CreateTokenDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  onCreated: (created: CreatedWorkspaceToken) => void;
};

export function CreateTokenDialog({
  open,
  onOpenChange,
  workspaceId,
  onCreated,
}: CreateTokenDialogProps) {
  const create = useCreateWorkspaceToken(workspaceId);
  const nameId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [reach, setReach] = useState<TokenReach>('configure');
  const [grants, setGrants] = useState<ReadonlySet<TokenGrant>>(new Set());
  const [lifetime, setLifetime] = useState<string | null>(USUAL_LIFETIME);

  const named = slugify(name);
  const busy = create.isPending;

  const forget = () => {
    setName('');
    setDescription('');
    setReach('configure');
    setGrants(new Set());
    setLifetime(USUAL_LIFETIME);
    create.reset();
  };

  const grant = (which: TokenGrant, granted: boolean) => {
    const next = new Set(grants);

    if (granted) {
      next.add(which);
    } else {
      next.delete(which);
    }

    setGrants(next);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (!named || !workspaceId || busy) {
      return;
    }

    create.mutate(
      {
        name: named,
        description: description.trim(),
        scopes: scopesOf(reach, grants),
        expiresAt: expiryAfter(lifetime),
      },
      {
        onSuccess: (created) => {
          onCreated(created);
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(settled) => !settled && forget()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a token</DialogTitle>
          <DialogDescription>
            A token lets Terraform or a script act in this workspace. Its name,
            what it may do and when it expires can’t be changed later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="contents">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={nameId} className={LABEL}>
              Name
            </label>
            <FieldInput
              id={nameId}
              name="name"
              required
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="terraform"
              maxLength={LONGEST_NAME}
              disabled={busy}
              aria-describedby={create.isError ? errorId : undefined}
              aria-invalid={create.isError}
              value={name}
              onChange={(event) => {
                setName(sanitizeSlug(event.target.value));
                create.isError && create.reset();
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={descriptionId} className={LABEL}>
              What it is for{' '}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <FieldInput
              id={descriptionId}
              name="description"
              autoComplete="off"
              placeholder="Applies the platform repository from CI"
              maxLength={LONGEST_DESCRIPTION}
              disabled={busy}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <TokenAccessField
            reach={reach}
            grants={grants}
            disabled={busy}
            onReach={setReach}
            onGrant={grant}
          />

          <div className="flex items-center justify-between gap-3">
            <span className={LABEL}>Expires after</span>
            <ChoiceSelect
              label="Expires after"
              choices={LIFETIMES}
              value={lifetime}
              placeholder="Never"
              onChange={setLifetime}
              disabled={busy}
              className="w-32"
            />
          </div>

          {create.isError && (
            <p
              id={errorId}
              role="alert"
              className="whitespace-pre-line text-destructive text-xs"
            >
              {refusal(create.error)}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button type="submit" size="sm" disabled={!named || busy}>
              {busy ? 'Creating…' : 'Create token'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
