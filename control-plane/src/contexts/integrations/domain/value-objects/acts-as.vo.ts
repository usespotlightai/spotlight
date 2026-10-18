export const ACTS_AS = ['team', 'requester'] as const;

export type ActsAsKind = (typeof ACTS_AS)[number];

export class ActsAs {
  private constructor(readonly kind: ActsAsKind) {}

  static team(): ActsAs {
    return new ActsAs('team');
  }

  static requester(): ActsAs {
    return new ActsAs('requester');
  }

  static of(kind: ActsAsKind): ActsAs {
    return kind === 'requester' ? ActsAs.requester() : ActsAs.team();
  }

  get byRequester(): boolean {
    return this.kind === 'requester';
  }

  equals(other: ActsAs): boolean {
    return this.kind === other.kind;
  }
}
