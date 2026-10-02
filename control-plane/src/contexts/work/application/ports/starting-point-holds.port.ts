export const STARTING_POINT_HOLDS = Symbol('STARTING_POINT_HOLDS');

export interface StartingPointHoldsPort {
  hold(
    holder: string,
    workspaceId: string,
    runIds: readonly string[],
  ): Promise<void>;

  release(holder: string): Promise<void>;
}
