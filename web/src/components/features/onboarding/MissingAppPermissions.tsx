import { TriangleAlert } from 'lucide-react';
import { useLocation } from 'react-router';

import { useGitHub } from '@/hooks/api/useGitHub';
import type { OnboardingResponseDto } from '@/lib/api/types.gen';
import { installUrlFor } from '@/lib/github';
import { nonEmpty } from '@/lib/non-empty';

type MissingPermission = OnboardingResponseDto['missingPermissions'][number];

type MissingAppPermissionsProps = {
  slug: string;
  teamId: string;
  missing: readonly MissingPermission[];
};

const WHAT_IS_LEFT = (missing: readonly MissingPermission[]): string => {
  const workflows = missing.includes('workflows');
  const variables = missing.includes('variables');

  if (workflows && variables) {
    return 'The GitHub App can’t add workflows or set repository variables, so the pull request will leave its workflow and variables for you to add.';
  }

  return workflows
    ? 'The GitHub App can’t add workflows, so the pull request will leave its workflow for you to add.'
    : 'The GitHub App can’t set repository variables, so the pull request will list them for you to add.';
};

export function MissingAppPermissions({
  slug,
  teamId,
  missing,
}: MissingAppPermissionsProps) {
  const here = useLocation();
  const { data: github } = useGitHub(slug);

  if (missing.length === 0) {
    return null;
  }

  return (
    <div className="flex items-start gap-2 text-muted-foreground text-sm leading-6">
      <TriangleAlert
        aria-hidden
        className="mt-1 size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
      />
      <p>
        {WHAT_IS_LEFT(missing)} To allow this, accept the App’s updated
        permissions on GitHub.
        {nonEmpty(github?.installUrl) && (
          <>
            {' '}
            <a
              href={installUrlFor(github.installUrl, {
                slug,
                teamId,
                from: `${here.pathname}${here.search}`,
              })}
              className="text-foreground underline underline-offset-2 hover:text-foreground/80"
            >
              Review permissions on GitHub
            </a>
          </>
        )}
      </p>
    </div>
  );
}
