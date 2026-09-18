import { X } from 'lucide-react';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { type PaneConfig, SidePane } from '@/components/shared/SidePane';
import { Button } from '@/components/ui/button';
import { useAcceptProposal } from '@/hooks/api/useAcceptProposal';
import { useDismissProposal } from '@/hooks/api/useDismissProposal';
import type { Proposal } from '@/lib/chat';

const PROPOSAL_PANE: PaneConfig = {
  storageKey: 'spotlight.proposal-detail-width',
  min: 288,
  max: 960,
  initial: 520,
  label: 'Resize the proposal',
};

type ProposalDetailProps = {
  teamId: string;
  chatId: string;
  position: number;
  proposal: Proposal;
  open: boolean;
  onClose: () => void;
};

export function ProposalDetail({
  teamId,
  chatId,
  position,
  proposal,
  open,
  onClose,
}: ProposalDetailProps) {
  const accept = useAcceptProposal();
  const dismiss = useDismissProposal();

  const creating = proposal.state === 'accepted';
  const created = proposal.state === 'created';
  const dismissed = proposal.state === 'dismissed';
  const settled = proposal.state !== 'open';
  const settling = accept.isPending || dismiss.isPending;

  return (
    <SidePane pane={PROPOSAL_PANE} open={open}>
      <div className="flex items-center gap-1.5 px-4 py-2 text-muted-foreground text-xs">
        <span className="shrink-0">Proposed task</span>
        <span aria-hidden>·</span>
        <span
          className="min-w-0 flex-1 truncate"
          style={
            proposal.stationColor ? { color: proposal.stationColor } : undefined
          }
        >
          {proposal.stationName
            ? [proposal.lineName, proposal.stationName]
                .filter(Boolean)
                .join(' › ')
            : 'A station that is gone'}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the proposal"
          className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 scrollbar-hide">
        <h2 className="break-words font-medium text-foreground text-sm leading-5">
          {proposal.title}
        </h2>

        {proposal.description && (
          <MarkdownEditor
            key={position}
            readOnly
            initialValue={proposal.description}
            placeholder=""
            ariaLabel={`What ${proposal.title} is about`}
            className="border-none bg-transparent p-0"
          />
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-3">
        <Button
          size="sm"
          className="rounded-full"
          disabled={settled || settling || !proposal.stationName}
          onClick={() => accept.mutate({ teamId, chatId, position })}
        >
          {created
            ? 'Task created'
            : creating
              ? 'Creating task…'
              : 'Create task'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={settled || settling}
          onClick={() => dismiss.mutate({ teamId, chatId, position })}
        >
          {dismissed ? 'Dismissed' : 'Dismiss'}
        </Button>
      </div>
    </SidePane>
  );
}
