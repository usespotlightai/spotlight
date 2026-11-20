import type {
  GitAnswerDto,
  GitCallDto,
} from '@work/application/dto/git-call.dto';
import type { RefUpdate } from '@work/domain/value-objects/ref-update.vo';

export const RECEIVE_PACK = Symbol('RECEIVE_PACK');

export interface Push {
  readonly updates: readonly RefUpdate[];
  readonly call: GitCallDto;
  refused(reason: string): Promise<GitAnswerDto>;
}

export type PushRead =
  | { readonly kind: 'read'; readonly push: Push }
  | { readonly kind: 'unreadable'; readonly answer: GitAnswerDto };

export interface ReceivePackPort {
  read(call: GitCallDto): Promise<PushRead>;
}
