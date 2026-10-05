export const CONNECTION_HOLDINGS = ['team', 'requester'] as const;

export type ConnectionHoldingKind = (typeof CONNECTION_HOLDINGS)[number];

export class ConnectionHolding {
  private constructor(readonly kind: ConnectionHoldingKind) {}

  static team(): ConnectionHolding {
    return new ConnectionHolding('team');
  }

  static requester(): ConnectionHolding {
    return new ConnectionHolding('requester');
  }

  static of(kind: ConnectionHoldingKind): ConnectionHolding {
    return kind === 'requester'
      ? ConnectionHolding.requester()
      : ConnectionHolding.team();
  }

  get byRequester(): boolean {
    return this.kind === 'requester';
  }

  equals(other: ConnectionHolding): boolean {
    return this.kind === other.kind;
  }
}
