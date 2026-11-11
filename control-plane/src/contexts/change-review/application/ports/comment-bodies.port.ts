import type {
  OutlinedCohortDto,
  StackCheckDto,
} from '@change-review/application/dto/change-stack.dto';
import type { TaskDecisionsDto } from '@change-review/application/dto/decision.dto';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export const COMMENT_BODIES = Symbol('COMMENT_BODIES');

export interface CommentedStack {
  readonly cohorts: readonly OutlinedCohortDto[];
  readonly check: StackCheckDto | null;
}

export interface CommentBodiesPort {
  readonly changeStackMarker: string;

  readonly decisionsMarker: string;

  changeStack(stack: CommentedStack, link: string): string;

  decisions(
    found: TaskDecisionsDto,
    repository: Repository,
    link: string,
  ): string;
}
