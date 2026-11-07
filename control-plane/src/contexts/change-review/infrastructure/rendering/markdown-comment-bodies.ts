import type { TaskDecisionsDto } from '@change-review/application/dto/decision.dto';
import type {
  CommentBodiesPort,
  CommentedStack,
} from '@change-review/application/ports/comment-bodies.port';
import {
  CHANGE_STACK_MARKER,
  ChangeStackComment,
} from '@change-review/infrastructure/rendering/change-stack-comment';
import {
  DECISIONS_MARKER,
  DecisionsComment,
} from '@change-review/infrastructure/rendering/decisions-comment';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export class MarkdownCommentBodies implements CommentBodiesPort {
  readonly changeStackMarker = CHANGE_STACK_MARKER;

  readonly decisionsMarker = DECISIONS_MARKER;

  changeStack(stack: CommentedStack, link: string): string {
    return ChangeStackComment.of(stack, link);
  }

  decisions(
    found: TaskDecisionsDto,
    repository: Repository,
    link: string,
  ): string {
    return DecisionsComment.of(found, repository, link);
  }
}
