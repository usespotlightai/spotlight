import { ReplaysHeading } from '@/components/features/replays/ReplaysHeading';
import { CopyBlock } from '@/components/shared/CopyBlock';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { PROPOSE_ANCHOR, proposeCommand } from '@/lib/replay';
import { tokensPath } from '@/lib/token';

type ProposeCandidateProps = {
  slug: string;
  address: string;
};

export function ProposeCandidate({ slug, address }: ProposeCandidateProps) {
  return (
    <div className="flex flex-col gap-2">
      <ReplaysHeading title="Propose a candidate" id={PROPOSE_ANCHOR} />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-sm">
        <p className="text-muted-foreground leading-6">
          Write the station as you would like to try it, as JSON in the shape
          the line resource holds a station, and propose it with the CLI. It is
          checked as a change to the line would be, and never applied.
        </p>

        <CopyBlock text={proposeCommand(address)} label="Copy command" />

        <p className="text-muted-foreground text-xs leading-5">
          The CLI reads <code className="font-mono">SPOTLIGHT_URL</code> and{' '}
          <code className="font-mono">SPOTLIGHT_API_TOKEN</code>, a{' '}
          <TrailLink
            to={tokensPath(slug)}
            className="text-foreground underline-offset-2 hover:underline"
          >
            workspace token
          </TrailLink>{' '}
          that may plan.
        </p>
      </div>
    </div>
  );
}
