import { ThisWasWrong } from '@/components/features/runs/remembered/ThisWasWrong';
import { Pill } from '@/components/shared/Pill';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  askedByAgent,
  KIND_LABELS,
  memoryPath,
  proposalStateOf,
  type RunProposal,
} from '@/lib/memory';

type RememberedProposalProps = {
  slug: string;
  teamId: string;
  proposal: RunProposal;
};

export function RememberedProposal({
  slug,
  teamId,
  proposal,
}: RememberedProposalProps) {
  return (
    <li
      data-slot="remembered-proposal"
      className="flex flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
        {proposal.handle && (
          <TrailLink
            to={memoryPath(slug, teamId, proposal.id)}
            className="font-mono text-foreground underline-offset-4 hover:underline"
          >
            {proposal.handle}
          </TrailLink>
        )}
        <Pill className="px-1.5 py-0">{KIND_LABELS[proposal.kind]}</Pill>
        <span>{proposalStateOf(proposal)}</span>
        {askedByAgent(proposal) && <span>· the agent asked to keep it</span>}
        <span className="flex-1" />
        {proposal.standing === 'stands' && (
          <ThisWasWrong teamId={teamId} memoryId={proposal.id} />
        )}
      </div>
      <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-6">
        {proposal.body}
      </p>
    </li>
  );
}
