import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { InvalidChatTransitionError } from '@work/domain/exceptions/invalid-chat-transition.error';
import type { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import type { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import type { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import type { TaskTitle } from '@work/domain/value-objects/task-title.vo';

export const PROPOSAL_STATES = [
  'open',
  'accepted',
  'created',
  'dismissed',
] as const;

export type ProposalState = (typeof PROPOSAL_STATES)[number];

export class TaskProposal {
  private constructor(
    readonly position: MessagePosition,
    readonly placement: ProposalPlacement,
    readonly title: TaskTitle,
    readonly description: TaskDescription | null,
    readonly state: ProposalState,
    readonly taskId: TaskId | null,
    readonly settledAt: Date | null,
  ) {}

  static open(input: {
    position: MessagePosition;
    placement: ProposalPlacement;
    title: TaskTitle;
    description: TaskDescription | null;
  }): TaskProposal {
    return new TaskProposal(
      input.position,
      input.placement,
      input.title,
      input.description,
      'open',
      null,
      null,
    );
  }

  static rehydrate(input: {
    position: MessagePosition;
    placement: ProposalPlacement;
    title: TaskTitle;
    description: TaskDescription | null;
    state: ProposalState;
    taskId: TaskId | null;
    settledAt: Date | null;
  }): TaskProposal {
    return new TaskProposal(
      input.position,
      input.placement,
      input.title,
      input.description,
      input.state,
      input.taskId,
      input.settledAt,
    );
  }

  get isOpen(): boolean {
    return this.state === 'open';
  }

  accepted(at: Date): TaskProposal {
    this.require('open', 'accepted');

    return this.with({ state: 'accepted', settledAt: at });
  }

  createdAs(taskId: TaskId, at: Date): TaskProposal {
    this.require('accepted', 'created');

    return this.with({ state: 'created', taskId, settledAt: at });
  }

  reopened(): TaskProposal {
    this.require('accepted', 'reopened');

    return this.with({ state: 'open', settledAt: null });
  }

  dismissed(at: Date): TaskProposal {
    this.require('open', 'dismissed');

    return this.with({ state: 'dismissed', settledAt: at });
  }

  equals(other: TaskProposal): boolean {
    return this.position.equals(other.position);
  }

  private require(state: ProposalState, becoming: string): void {
    if (this.state !== state) {
      throw new InvalidChatTransitionError(
        `has a proposal that is ${this.state}, so it cannot be ${becoming}`,
      );
    }
  }

  private with(part: {
    state: ProposalState;
    taskId?: TaskId | null;
    settledAt: Date | null;
  }): TaskProposal {
    return new TaskProposal(
      this.position,
      this.placement,
      this.title,
      this.description,
      part.state,
      part.taskId !== undefined ? part.taskId : this.taskId,
      part.settledAt,
    );
  }
}
