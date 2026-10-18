export const CONTROL_PLANE_RELEASE = Symbol('CONTROL_PLANE_RELEASE');

export interface ControlPlaneReleasePort {
  readonly release: string | null;
}
