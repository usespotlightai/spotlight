import { type ChangeEvent, type SubmitEvent, useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { useCreateWorkspace } from '@/hooks/api/useCreateWorkspace';
import { useSession } from '@/hooks/api/useSession';
import { useSignOut } from '@/hooks/api/useSignOut';
import { inboxPath } from '@/lib/inbox';
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
  const [slugTakenOver, setSlugTakenOver] = useState(false);

  const onNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setName(next);
    if (!slugTakenOver) {
      setSlug(slugify(next));
    }
  };

  const onSlugChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = sanitizeSlug(event.target.value);
    setSlug(next);
    setSlugTakenOver(next !== '');
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
    <div className="flex min-h-svh flex-col">
      <header className="flex items-start justify-between gap-4 p-4">
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

      <main className="flex flex-1 items-center justify-center px-4 pb-20">
        <div className="flex w-72 flex-col gap-6">
          <h1 className="text-center font-medium text-2xl text-foreground leading-tight tracking-tight">
            {step === 'workspace' ? 'Create workspace' : 'Name your first team'}
          </h1>
          <p className="text-center text-muted-foreground text-sm">
            {step === 'workspace'
              ? 'A workspace is a shared environment your team works in.'
              : `A team has its own board, its own repository and its own integrations. You can add more teams later.`}
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {step === 'workspace' ? (
              <>
                <label htmlFor={nameId} className="sr-only">
                  Workspace Name
                </label>
                <input
                  id={nameId}
                  name="name"
                  type="text"
                  required
                  autoComplete="off"
                  placeholder="Workspace name"
                  value={name}
                  onChange={onNameChange}
                  className="h-11 rounded-lg border-[0.5px] border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border focus:border-ring"
                />

                <label htmlFor={slugId} className="sr-only">
                  Workspace URL
                </label>
                <div className="flex h-11 items-center rounded-lg border-[0.5px] border-input bg-background pl-3 text-sm focus-within:border focus-within:border-ring">
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
                    className="h-full min-w-0 flex-1 bg-transparent pr-3 text-foreground outline-none"
                  />
                </div>
              </>
            ) : (
              <>
                <label htmlFor={teamId} className="sr-only">
                  Team Name
                </label>
                <input
                  id={teamId}
                  name="teamName"
                  type="text"
                  required
                  // biome-ignore lint/a11y/noAutofocus: the step just changed under the cursor
                  autoFocus
                  autoComplete="off"
                  placeholder="Product"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  className="h-11 rounded-lg border-[0.5px] border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border focus:border-ring"
                />
              </>
            )}

            {createWorkspace.isError && (
              <p role="alert" className="text-center text-destructive text-sm">
                {createWorkspace.error.message}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="h-11 rounded-full bg-primary font-medium text-primary-foreground text-sm outline-none transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {step === 'workspace'
                ? 'Continue'
                : createWorkspace.isPending
                  ? 'Creating workspace…'
                  : 'Create workspace'}
            </button>

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
          </form>
        </div>
      </main>
    </div>
  );
}
