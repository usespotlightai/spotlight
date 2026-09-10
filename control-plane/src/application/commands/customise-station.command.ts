export class CustomiseStationCommand {
  constructor(
    readonly teamId: string,
    readonly viewerId: string,
    readonly lineId: string,
    readonly stationId: string,
    readonly changes: {
      readonly name?: string;
      readonly color?: string;
      readonly description?: string | null;
      readonly harness?: string | null;
      readonly model?: string | null;
      readonly effort?: string | null;
      readonly agentPrompt?: string | null;
    },
  ) {}
}
