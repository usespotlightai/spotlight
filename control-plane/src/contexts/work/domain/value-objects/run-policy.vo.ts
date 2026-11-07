export type RunAsks = 'requester' | 'recorded';

export interface RunPolicyParts {
  readonly holdsTurn: boolean;
  readonly gated: boolean;
  readonly actsBeyondItself: boolean;
  readonly asks: RunAsks;
  readonly listed: boolean;
  readonly exclusive: boolean;
}

export class RunPolicy implements RunPolicyParts {
  private constructor(
    readonly holdsTurn: boolean,
    readonly gated: boolean,
    readonly actsBeyondItself: boolean,
    readonly asks: RunAsks,
    readonly listed: boolean,
    readonly exclusive: boolean,
  ) {}

  static of(parts: RunPolicyParts): RunPolicy {
    return new RunPolicy(
      parts.holdsTurn,
      parts.gated,
      parts.actsBeyondItself,
      parts.asks,
      parts.listed,
      parts.exclusive,
    );
  }

  get parts(): RunPolicyParts {
    return {
      holdsTurn: this.holdsTurn,
      gated: this.gated,
      actsBeyondItself: this.actsBeyondItself,
      asks: this.asks,
      listed: this.listed,
      exclusive: this.exclusive,
    };
  }
}
