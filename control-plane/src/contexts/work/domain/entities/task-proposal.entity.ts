import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { InvalidChatTransitionError } from '@work/domain/exceptions/invalid-chat-transition.error';
import type { Branch } from '@work/domain/value-objects/branch.vo';
import type { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import type { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import type { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import type { TaskTitle } from '@work/domain/value-objects/task-title.vo';

export const PROPOSAL_STATES = [
  'open',
  'accepted',
  'created',
  'dismissed',
  'replaced',
] as const;

export type ProposalState = (typeof PROPOSAL_STATES)[number];

export const proposalBlocks = (state: ProposalState): boolean =>
  state !== 'dismissed' && state !== 'replaced';

const assertEarlier = (
  position: MessagePosition,
  blockedBy: readonly MessagePosition[],
): void => {
  if (blockedBy.some((each) => each.value >= position.value)) {
    throw new InconsistentStateError(
      'task proposal',
      'waits for a proposal that comes after it',
    );
  }
};

export class TaskProposal {
  private constructor(
    readonly position: MessagePosition,
    readonly placement: ProposalPlacement,
    readonly title: TaskTitle,
    readonly description: TaskDescription | null,
    readonly base: Branch | null,
    readonly state: ProposalState,
    readonly taskId: TaskId | null,
    readonly decidedAt: Date | null,
    readonly blockedBy: readonly MessagePosition[] = [],
  ) {}

  static open(input: {
    position: MessagePosition;
    placement: ProposalPlacement;
    title: TaskTitle;
    description: TaskDescription | null;
    base: Branch | null;
    blockedBy?: readonly MessagePosition[];
  }): TaskProposal {
    assertEarlier(input.position, input.blockedBy ?? []);

    return new TaskProposal(
      input.position,
      input.placement,
      input.title,
      input.description,
      input.base,
      'open',
      null,
      null,
      input.blockedBy ?? [],
    );
  }

  static rehydrate(input: {
    position: MessagePosition;
    placement: ProposalPlacement;
    title: TaskTitle;
    description: TaskDescription | null;
    base: Branch | null;
    state: ProposalState;
    taskId: TaskId | null;
    decidedAt: Date | null;
    blockedBy?: readonly MessagePosition[];
  }): TaskProposal {
    if ((input.state === 'created') !== (input.taskId !== null)) {
      throw new InconsistentStateError(
        'task proposal',
        `is ${input.state} ${input.taskId ? 'with' : 'without'} a task`,
      );
    }

    const blockedBy = input.blockedBy ?? [];

    assertEarlier(input.position, blockedBy);

    return new TaskProposal(
      input.position,
      input.placement,
      input.title,
      input.description,
      input.base,
      input.state,
      input.taskId,
      input.decidedAt,
      blockedBy,
    );
  }

  get isOpen(): boolean {
    return this.state === 'open';
  }

  get blocks(): boolean {
    return proposalBlocks(this.state);
  }

  get becameTask(): boolean {
    return this.state === 'created';
  }

  accept(at: Date): TaskProposal {
    this.require('open', 'accepted');

    return this.with({ state: 'accepted', decidedAt: at });
  }

  createdAs(taskId: TaskId, at: Date): TaskProposal {
    this.require('accepted', 'created');

    return this.with({ state: 'created', taskId, decidedAt: at });
  }

  reopen(): TaskProposal {
    this.require('accepted', 'reopened');

    return this.with({ state: 'open', decidedAt: null });
  }

  dismiss(at: Date): TaskProposal {
    this.require('open', 'dismissed');

    return this.with({ state: 'dismissed', decidedAt: at });
  }

  replace(at: Date): TaskProposal {
    this.require('open', 'replaced');

    return this.with({ state: 'replaced', decidedAt: at });
  }

  restore(): TaskProposal {
    if (this.state !== 'dismissed' && this.state !== 'replaced') {
      throw new InvalidChatTransitionError(
        `Proposal is ${this.state}. It cannot be restored.`,
      );
    }

    return this.with({ state: 'open', decidedAt: null });
  }

  equals(other: TaskProposal): boolean {
    return this.position.equals(other.position);
  }

  private require(state: ProposalState, becoming: string): void {
    if (this.state !== state) {
      throw new InvalidChatTransitionError(
        `Proposal is ${this.state}. It cannot be ${becoming}.`,
      );
    }
  }

  private with(part: {
    state: ProposalState;
    taskId?: TaskId | null;
    decidedAt: Date | null;
  }): TaskProposal {
    return new TaskProposal(
      this.position,
      this.placement,
      this.title,
      this.description,
      this.base,
      part.state,
      part.taskId !== undefined ? part.taskId : this.taskId,
      part.decidedAt,
      this.blockedBy,
    );
  }
}
