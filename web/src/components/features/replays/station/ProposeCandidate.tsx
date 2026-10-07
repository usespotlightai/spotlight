import { ChevronRight } from 'lucide-react';
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
    <details id={PROPOSE_ANCHOR} className="group scroll-mt-4">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded py-0.5 text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-3.5 transition-transform duration-200 group-open:rotate-90"
        />
        Propose a candidate with the CLI
      </summary>

      <div className="mt-2 flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground leading-6">
          Write the station you want to try as JSON, in the line resource’s
          station shape. Propose it with the CLI. It’s checked like a line
          change and never applied.
        </p>

        <CopyBlock text={proposeCommand(address)} label="Copy command" />

        <p className="text-muted-foreground text-xs leading-5">
          The CLI reads <code className="font-mono">SPOTLIGHT_URL</code> and{' '}
          <code className="font-mono">SPOTLIGHT_API_TOKEN</code>. Token
          required: a{' '}
          <TrailLink
            to={tokensPath(slug)}
            className="text-foreground underline-offset-2 hover:underline"
          >
            workspace token
          </TrailLink>{' '}
          with the plan scope
        </p>
      </div>
    </details>
  );
}
