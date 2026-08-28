export class CustomiseStationCommand {
  constructor(
    readonly lineId: string,
    readonly stationId: string,
    readonly changes: {
      readonly name?: string;
      readonly color?: string;
      readonly description?: string | null;
      readonly pool?: string | null;
      readonly agentPrompt?: string | null;
    },
  ) {}
}
