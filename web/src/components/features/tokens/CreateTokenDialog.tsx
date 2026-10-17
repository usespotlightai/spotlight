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
} from '@/hooks/api/useCreateWorkspaceToken';
import { sanitizeSlug, slugify } from '@/lib/slug';
import {
  expiryAfter,
  LIFETIMES,
  scopesOf,
  type TokenGrant,
  type TokenLevel,
  USUAL_LIFETIME,
} from '@/lib/token';

const LONGEST_NAME = 64;

const LONGEST_DESCRIPTION = 255;

const LABEL = 'font-medium text-foreground text-xs';

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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<TokenLevel>('configure');
  const [grants, setGrants] = useState<ReadonlySet<TokenGrant>>(new Set());
  const [lifetime, setLifetime] = useState<string | null>(USUAL_LIFETIME);

  const named = slugify(name);
  const busy = create.isPending;

  const reset = () => {
    setName('');
    setDescription('');
    setLevel('configure');
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
        scopes: scopesOf(level, grants),
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
      onOpenChangeComplete={(open) => !open && reset()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a token</DialogTitle>
          <DialogDescription>
            A token lets Terraform or a script act in this workspace. Its name,
            access and expiry are permanent.
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
            level={level}
            grants={grants}
            disabled={busy}
            onLevel={setLevel}
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
