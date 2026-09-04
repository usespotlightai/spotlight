import { useLocation } from 'react-router';
import { installUrlFor } from '@/lib/github';

type ConnectGitHubProps = {
  slug: string | undefined;
  teamId: string;
  installUrl: string | null;
};

/**
 * The one host Spotlight reaches through something of its own, so connecting
 * it is a button rather than a file. Everything else is declared in the
 * repository this opens the way to.
 */
export function ConnectGitHub({
  slug,
  teamId,
  installUrl,
}: ConnectGitHubProps) {
  const here = useLocation();

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex h-6 items-center font-medium text-muted-foreground text-xs">
        GitHub
      </h2>

      <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-4">
        <p className="text-muted-foreground text-xs leading-5">
          Spotlight reads this team’s configuration from a repository and writes
          changes back as pull requests. Until the App is installed there is
          nothing to read and nowhere to write.
        </p>

        {slug && installUrl ? (
          <a
            href={installUrlFor(installUrl, {
              slug,
              teamId,
              from: `${here.pathname}${here.search}`,
            })}
            className="inline-flex h-8 items-center rounded-full bg-primary px-3 font-medium text-primary-foreground text-xs outline-none transition-opacity hover:opacity-90"
          >
            Install it on GitHub
          </a>
        ) : (
          <p className="text-muted-foreground text-xs">
            Spotlight could not reach GitHub to ask where its App is installed
            from.
          </p>
        )}
      </div>
    </section>
  );
}
