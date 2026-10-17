import {
  type ChangeEvent,
  type SubmitEvent,
  useId,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router';
import { FieldInput } from '@/components/shared/form/FieldInput';
import { AuthScreen } from '@/components/shell/auth/AuthScreen';
import { AuthTitle } from '@/components/shell/auth/AuthTitle';
import { Button } from '@/components/ui/button';
import { useCreateWorkspace } from '@/hooks/api/useCreateWorkspace';
import { useSession } from '@/hooks/api/useSession';
import { useSignOut } from '@/hooks/api/useSignOut';
import { inboxPath } from '@/lib/inbox';
import { markCreatedHere } from '@/lib/provisioning';
import { sanitizeSlug, slugify } from '@/lib/slug';
import { WORKSPACE_URL_PREFIX } from '@/lib/workspace';

type Step = 'workspace' | 'team';

export function CreateWorkspace() {
  const nameId = useId();
  const slugId = useId();
  const prefixId = useId();
  const teamId = useId();
  const { data: session } = useSession();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const createWorkspace = useCreateWorkspace();

  const [step, setStep] = useState<Step>('workspace');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [teamName, setTeamName] = useState('');
  const slugTakenOver = useRef(false);

  const onNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setName(next);
    if (!slugTakenOver.current) {
      setSlug(slugify(next));
    }
  };

  const onSlugChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = sanitizeSlug(event.target.value);
    setSlug(next);
    slugTakenOver.current = next !== '';
  };

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step === 'workspace') {
      setStep('team');
      return;
    }

    createWorkspace.mutate(
      { name: name.trim(), slug: slugify(slug), teamName: teamName.trim() },
      {
        onSuccess: (workspace) => {
          markCreatedHere(workspace.slug);
          void navigate(inboxPath(workspace.slug), { replace: true });
        },
      },
    );
  };

  const namedWorkspace = name.trim() !== '' && slugify(slug) !== '';
  const canSubmit =
    step === 'workspace'
      ? namedWorkspace
      : teamName.trim() !== '' && !createWorkspace.isPending;

  return (
    <>
      <header className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
        <button
          type="button"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
          className="text-foreground text-sm outline-none transition-opacity hover:opacity-70 disabled:opacity-60"
        >
          {signOut.isPending ? 'Logging out…' : 'Log out'}
        </button>

        <p className="text-right text-sm leading-5">
          <span className="block text-muted-foreground">Logged in as:</span>
          <span className="font-[450] text-foreground">
            {session?.user?.email}
          </span>
        </p>
      </header>

      <AuthScreen logo={false} className="w-72">
        {step === 'workspace' ? (
          <AuthTitle title="Create workspace" large>
            A workspace is the shared space your company’s teams work in.
          </AuthTitle>
        ) : (
          <AuthTitle title="Name your first team" large>
            A team has its own board, repository and integrations.
          </AuthTitle>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {step === 'workspace' ? (
              <>
                <label htmlFor={nameId} className="sr-only">
                  Workspace name
                </label>
                <FieldInput
                  id={nameId}
                  name="name"
                  type="text"
                  required
                  autoComplete="off"
                  placeholder="Workspace name"
                  value={name}
                  onChange={onNameChange}
                  className="h-9 bg-card"
                />

                <label htmlFor={slugId} className="sr-only">
                  Workspace URL
                </label>
                <div className="flex h-9 items-center rounded-md border-[0.5px] border-border bg-card pl-2.5 text-sm focus-within:border-input">
                  <span id={prefixId} className="text-muted-foreground">
                    {WORKSPACE_URL_PREFIX}
                  </span>
                  <input
                    id={slugId}
                    name="slug"
                    type="text"
                    required
                    autoComplete="off"
                    aria-describedby={prefixId}
                    value={slug}
                    onChange={onSlugChange}
                    className="h-full min-w-0 flex-1 bg-transparent pr-2.5 text-foreground outline-none"
                  />
                </div>
              </>
            ) : (
              <>
                <label htmlFor={teamId} className="sr-only">
                  Team name
                </label>
                <FieldInput
                  id={teamId}
                  name="teamName"
                  type="text"
                  required
                  autoFocus
                  autoComplete="off"
                  placeholder="Product"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  className="h-9 bg-card"
                />
              </>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit}
              className="rounded-full px-6"
            >
              {step === 'workspace'
                ? 'Continue'
                : createWorkspace.isPending
                  ? 'Creating workspace…'
                  : 'Create workspace'}
            </Button>

            {step === 'team' && (
              <button
                type="button"
                onClick={() => setStep('workspace')}
                disabled={createWorkspace.isPending}
                className="text-muted-foreground text-sm outline-none transition-opacity hover:opacity-70 disabled:opacity-60"
              >
                Back
              </button>
            )}
          </div>
        </form>
      </AuthScreen>
    </>
  );
}
