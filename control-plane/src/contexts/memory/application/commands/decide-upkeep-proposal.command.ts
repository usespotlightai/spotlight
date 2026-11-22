const UPKEEP_DECISIONS = ['approve', 'reject'] as const;

export type UpkeepDecision = (typeof UPKEEP_DECISIONS)[number];

export class DecideUpkeepProposalCommand {
  constructor(
    readonly teamId: string,
    readonly upkeepId: string,
    readonly proposalId: string,
    readonly decision: UpkeepDecision,
    readonly viewerId: string,
  ) {}
}
