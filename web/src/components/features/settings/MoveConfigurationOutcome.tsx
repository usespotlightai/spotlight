import { GitPullRequest } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import type { MovedConfigurationResponseDto } from '@/lib/api';

type MoveConfigurationOutcomeProps = {
  moved: MovedConfigurationResponseDto;
  repository: string;
  onDone: () => void;
};

export function MoveConfigurationOutcome({
  moved,
  repository,
  onDone,
}: MoveConfigurationOutcomeProps) {
  return (
    <>
      <p className="text-muted-foreground text-sm leading-6">
        {moved.kind === 'carried' && (
          <>
            Opened a pull request in {repository} carrying this team’s
            configuration. The team reads from there once it merges.{' '}
            {moved.url && (
              <a
                href={moved.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-foreground hover:underline"
              >
                <GitPullRequest className="size-3.5 shrink-0" aria-hidden />
                View pull request
              </a>
            )}
          </>
        )}
        {moved.kind === 'adopted' &&
          `${repository} already holds Spotlight configuration, so this team reads from it now. Nothing was written over it.`}
        {moved.kind === 'repointed' &&
          `There was no configuration to carry, so this team reads from ${repository} now.`}
      </p>

      <DialogFooter>
        <Button size="sm" onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
