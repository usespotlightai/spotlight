export const PULL_REQUEST_MARK = 'git.pull-request';

export const REVIEW_MARK = 'github.review';

export const REVIEW_ROLE = 'review';

export type ReviewAsking = 'opened' | 'mentioned';

type HappeningState = 'raised' | 'resolved';

export interface MarkWorn {
  readonly kind: string;
  readonly value: string;
}

interface SaidWord {
  readonly body: string;
  readonly path?: string | null;
  readonly from?: number | null;
  readonly to?: number | null;
  readonly remark?: string | null;
}

interface ConcernsWord {
  readonly branch: string | null;
  readonly marks: readonly MarkWorn[];
}

export interface ReviewWord {
  readonly asking: ReviewAsking;
  readonly pullRequest: string;
  readonly author: string | null;
  readonly draft: boolean;
  readonly branch: string | null;
}

interface OpensWord {
  readonly onto: string;
  readonly at: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly assignEmail: string | null;
  readonly marks: readonly MarkWorn[];
  readonly review?: ReviewWord | null;
}

export interface Arriving {
  readonly name: string;
  readonly contentType: string | null;
  readonly size: number | null;
  fetch(): Promise<Uint8Array>;
}

export interface Happened {
  readonly happening: string;
  readonly told: string;
  readonly spoken: boolean;
  readonly state: HappeningState;
  readonly concerns: ConcernsWord;
  readonly said: SaidWord | null;
  readonly ourOwn: boolean;
  readonly opens: OpensWord | null;
  readonly attachments?: readonly Arriving[];
}
