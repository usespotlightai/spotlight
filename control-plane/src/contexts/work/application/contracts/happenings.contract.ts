export const PULL_REQUEST_MARK = 'git.pull-request';

export const REVIEW_MARK = 'github.review';

export const REVIEW_ROLE = 'review';

export type ReviewTrigger = 'opened' | 'mentioned' | 'labelled';

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
}

interface ConcernsPayload {
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
  readonly onto: string;
  readonly at: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly assignEmail: string | null;
  readonly marks: readonly TaskMark[];
  readonly review?: ReviewPayload | null;
}

export interface Arriving {
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
  readonly concerns: ConcernsPayload;
  readonly message: MessagePayload | null;
  readonly ourOwn: boolean;
  readonly opens: OpensPayload | null;
  readonly attachments?: readonly Arriving[];
}
