export const CONNECTION_HOLDER_RULES = ['team', 'requester'] as const;

export type ConnectionHolderRuleKind = (typeof CONNECTION_HOLDER_RULES)[number];

export class ConnectionHolderRule {
  private constructor(readonly kind: ConnectionHolderRuleKind) {}

  static team(): ConnectionHolderRule {
    return new ConnectionHolderRule('team');
  }

  static requester(): ConnectionHolderRule {
    return new ConnectionHolderRule('requester');
  }

  static of(kind: ConnectionHolderRuleKind): ConnectionHolderRule {
    return kind === 'requester'
      ? ConnectionHolderRule.requester()
      : ConnectionHolderRule.team();
  }

  get byRequester(): boolean {
    return this.kind === 'requester';
  }

  equals(other: ConnectionHolderRule): boolean {
    return this.kind === other.kind;
  }
}
