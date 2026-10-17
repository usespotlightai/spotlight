export const EGRESS_TRAFFIC = ['all', 'bound'] as const;

export type EgressTrafficName = (typeof EGRESS_TRAFFIC)[number];

export class EgressTraffic {
  private readonly kind = 'egress-traffic';

  private constructor(readonly value: EgressTrafficName) {}

  static all(): EgressTraffic {
    return new EgressTraffic('all');
  }

  static of(value: EgressTrafficName): EgressTraffic {
    return new EgressTraffic(value);
  }

  get onlyBound(): boolean {
    return this.value === 'bound';
  }

  equals(other: EgressTraffic): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
