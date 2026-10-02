import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class ConfigPullRequestDetail implements ChangeDetail {
  private constructor(
    readonly searchId: string,
    readonly candidateId: string,
    readonly candidate: string,
    readonly attempt: number,
  ) {}

  static of(input: {
    searchId: string;
    candidateId: string;
    candidate: string;
    attempt: number;
  }): ConfigPullRequestDetail {
    return new ConfigPullRequestDetail(
      input.searchId,
      input.candidateId,
      input.candidate,
      input.attempt,
    );
  }

  recorded(): RecordedDetail {
    return {
      search: this.searchId,
      candidateId: this.candidateId,
      candidate: this.candidate,
      attempt: this.attempt,
    };
  }
}
