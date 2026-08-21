import { useGreeting } from '@/hooks/api/useGreeting';
import { useSession } from '@/hooks/api/useSession';
import { useSignOut } from '@/hooks/api/useSignOut';

export function Home() {
  const { data: session } = useSession();
  const {
    data: greeting,
    isPending,
    isError,
  } = useGreeting(session?.user?.name);
  const signOut = useSignOut();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4">
      <h1 className="font-medium text-title">
        {isPending
          ? 'Loading…'
          : isError
            ? 'Could not reach the control-plane.'
            : greeting?.message}
      </h1>

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
