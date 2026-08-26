/** A field left out is left alone; a field given as null is cleared. */
export class CustomiseStationCommand {
  constructor(
    readonly lineId: string,
    readonly stationId: string,
    readonly changes: {
      readonly name?: string;
      readonly description?: string | null;
      readonly pool?: string | null;
      readonly agentPrompt?: string | null;
    },
  ) {}
}
