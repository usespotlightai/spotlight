// For the admin API. The caller authorises the operator of the deployment, and the change shows as made by Spotlight. A field that is not given stays as it is.
export class SetPlatformPoolCommand {
  constructor(
    readonly workspaceId: string,
    readonly change: {
      readonly enabled?: boolean;
      readonly allowsSecrets?: boolean;
      readonly allowsReviewWork?: boolean;
    },
  ) {}
}
