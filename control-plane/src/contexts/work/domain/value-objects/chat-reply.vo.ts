import { firstOf, itemAt } from '@shared-kernel/domain/item-at';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import type { NumberedProposal } from '@work/domain/aggregates/chat.aggregate';
import type { TaskProposal } from '@work/domain/entities/task-proposal.entity';

export type ProposalDecision = 'accept' | 'dismiss';

const DECIDES = /^(accept|dismiss)(?:\s+#?(\d+))?[.!]?$/i;

const isProposalDecision = (
  value: string | undefined,
): value is ProposalDecision => value === 'accept' || value === 'dismiss';

export type ProposalPick =
  | { readonly kind: 'picked'; readonly proposal: TaskProposal }
  | { readonly kind: 'none-open' }
  | { readonly kind: 'unnamed'; readonly open: number }
  | { readonly kind: 'no-such'; readonly number: number };

export class ChatReply {
  private constructor(
    readonly text: string,
    readonly decision: ProposalDecision | null,
    readonly number: number | null,
  ) {}

  static read(text: string): ChatReply {
    const trimmed = text.trim();
    const decides = DECIDES.exec(trimmed);

    if (!decides) {
      return new ChatReply(trimmed, null, null);
    }

    const decision = itemAt(decides, 1)?.toLowerCase();
    const number = itemAt(decides, 2);

    return new ChatReply(
      trimmed,
      isProposalDecision(decision) ? decision : null,
      nonEmpty(number) ? Number(number) : null,
    );
  }

  pick(proposals: readonly NumberedProposal[]): ProposalPick {
    const open = proposals.filter((each) => each.proposal.isOpen);

    if (open.length === 0) {
      return { kind: 'none-open' };
    }

    if (this.number === null) {
      const only = firstOf(open);

      return open.length === 1 && only !== undefined
        ? { kind: 'picked', proposal: only.proposal }
        : { kind: 'unnamed', open: open.length };
    }

    const picked = open.find((each) => each.number === this.number);

    return picked
      ? { kind: 'picked', proposal: picked.proposal }
      : { kind: 'no-such', number: this.number };
  }
}
