import { InfoTooltip } from '@/components/features/insights/InfoTooltip';
import { WarningTooltip } from '@/components/shared/WarningTooltip';
import type { SetupCiResponseDto } from '@/lib/api/types.gen';

type SetupCiProps = {
  repository: string;
  ci: SetupCiResponseDto;
};

export function SetupCi({ repository, ci }: SetupCiProps) {
  const branch = ci.defaultBranch;

  return (
    <div className="flex flex-col text-muted-foreground text-sm leading-6">
      <p className="flex items-center gap-1.5">
        <span>
          GitHub Actions: pull requests in{' '}
          <span className="text-foreground">{repository}</span> plan, and pushes
          to <span className="text-foreground">{branch}</span> apply.
        </span>
        {!ci.defaultBranchProtected && (
          <WarningTooltip
            tone="warning"
            label={`${branch} has no branch protection`}
            tooltip={`${branch} has no branch protection. Anyone who can push to ${branch} can change this workspace’s configuration. Please require a pull request review.`}
          />
        )}
      </p>
      {ci.variables === 'not-permitted' && (
        <p className="flex items-center gap-1.5">
          Add the repository variables that the pull request lists.
          <InfoTooltip tooltip="The GitHub App may not write variables. Grant it “Variables: read and write” to let Spotlight set them." />
        </p>
      )}
    </div>
  );
}
