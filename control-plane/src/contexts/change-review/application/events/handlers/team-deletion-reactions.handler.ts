import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { QuestionAnswerRepository } from '@change-review/domain/repositories/question-answer.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class TeamDeletionReactions {
  constructor(
    private readonly checks: StackCheckRepository,
    private readonly answers: QuestionAnswerRepository,
    private readonly stacks: ChangeStackRepository,
    private readonly clock: ClockPort,
  ) {}

  async removeChecks(teamId: TeamId): Promise<void> {
    for (const check of await this.checks.ofTeam(teamId)) {
      await this.checks.remove(check.delete(this.clock.now()));
    }
  }

  async removeAnswers(teamId: TeamId): Promise<void> {
    for (const answer of await this.answers.ofTeam(teamId)) {
      await this.answers.remove(answer);
    }
  }

  async removeStacks(teamId: TeamId): Promise<void> {
    for (const stack of await this.stacks.ofTeam(teamId)) {
      await this.stacks.remove(stack);
    }
  }
}
