import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class ConfigPullRequestDetail implements ChangeDetail {
  private constructor(
    readonly searchId: string,
    readonly candidateId: string,
    readonly candidate: string,
  ) {}

  static of(input: {
    searchId: string;
    candidateId: string;
    candidate: string;
  }): ConfigPullRequestDetail {
    return new ConfigPullRequestDetail(
      input.searchId,
      input.candidateId,
      input.candidate,
    );
  }

  recorded(): RecordedDetail {
    return {
      search: this.searchId,
      candidateId: this.candidateId,
      candidate: this.candidate,
    };
  }
}
