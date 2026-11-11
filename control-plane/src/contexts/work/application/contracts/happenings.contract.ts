import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import {
  PULL_REQUEST_MARK_KIND,
  REVIEW_MARK_KIND,
} from '@work/domain/value-objects/mark.vo';

export const PULL_REQUEST_MARK: string = PULL_REQUEST_MARK_KIND;

export const REVIEW_MARK: string = REVIEW_MARK_KIND;

export const REVIEW_ROLE: string = LineRole.REVIEW.value;

type ReviewTrigger = 'opened' | 'mentioned' | 'labelled';

type HappeningState = 'raised' | 'resolved';

export interface TaskMark {
  readonly kind: string;
  readonly value: string;
}

interface MessagePayload {
  readonly body: string;
  readonly path?: string | null;
  readonly from?: number | null;
  readonly to?: number | null;
  readonly reviewComment?: string | null;
  readonly pullRequest?: string | null;
}

interface CorrelationKeysPayload {
  readonly branch: string | null;
  readonly marks: readonly TaskMark[];
}

export interface ReviewPayload {
  readonly trigger: ReviewTrigger;
  readonly label?: string | null;
  readonly pullRequest: string;
  readonly author: string | null;
  readonly outside: boolean;
  readonly draft: boolean;
  readonly branch: string | null;
}

interface OpensPayload {
  readonly lineRole: string;
  readonly station: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly assignEmail: string | null;
  readonly marks: readonly TaskMark[];
  readonly review?: ReviewPayload | null;
}

interface StartsChatPayload {
  readonly email: string | null;
  readonly harness: string | null;
  readonly marks: readonly ChatMarkPayload[];
}

interface ChatMarkPayload extends TaskMark {
  readonly finds: boolean;
}

export interface InboundAttachment {
  readonly name: string;
  readonly contentType: string | null;
  readonly size: number | null;
  fetch(): Promise<Uint8Array>;
}

export interface Happened {
  readonly happening: string;
  readonly summary: string;
  readonly answers: boolean;
  readonly state: HappeningState;
  readonly correlationKeys: CorrelationKeysPayload;
  readonly message: MessagePayload | null;
  readonly authorEmail?: string | null;
  readonly ourOwn: boolean;
  readonly opens: OpensPayload | null;
  readonly chat?: StartsChatPayload | null;
  readonly attachments?: readonly InboundAttachment[];
  readonly closedPullRequest?: string | null;
}
