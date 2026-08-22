import { Link, useParams } from 'react-router';
import { useSignOut } from '@/hooks/api/useSignOut';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { WORKSPACE_URL_PREFIX } from '@/lib/workspace';

export function Workspace() {
  const { slug } = useParams();
  const { data: workspace, isPending } = useWorkspace(slug);
  const signOut = useSignOut();

  if (isPending) {
    return null;
  }

  if (!workspace) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4">
        <h1 className="font-medium text-2xl tracking-tight">
          Workspace not found
        </h1>
        <p className="max-w-sm text-center text-muted-foreground text-sm">
          There is no workspace at {WORKSPACE_URL_PREFIX}
          {slug}, or you are not a member of it.
        </p>
        <Link
          to="/workspaces/new"
          className="font-[450] text-foreground text-sm hover:underline"
        >
          Create a workspace
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-medium text-2xl text-foreground tracking-tight">
          {workspace.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          {WORKSPACE_URL_PREFIX}
          {workspace.slug}
        </p>
      </div>

      <ul className="flex w-72 flex-col gap-2">
        {workspace.teams.map((team) => (
          <li
            key={team.id}
            className="h-11 rounded-lg border-[0.5px] border-input bg-background px-3 text-sm leading-[2.75rem]"
          >
            {team.name}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => signOut.mutate()}
        disabled={signOut.isPending}
        className="h-11 rounded-full bg-primary px-6 font-medium text-primary-foreground text-sm outline-none transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {signOut.isPending ? 'Signing out…' : 'Sign out'}
      </button>
    </main>
  );
}
