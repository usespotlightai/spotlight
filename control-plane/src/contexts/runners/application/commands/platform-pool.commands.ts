// For the admin API. The caller authorises the operator of the deployment, and the change shows as made by Spotlight.
export class DisablePlatformPoolCommand {
  constructor(readonly workspaceId: string) {}
}

export class EnablePlatformPoolCommand {
  constructor(readonly workspaceId: string) {}
}
