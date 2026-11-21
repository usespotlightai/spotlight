// The caller authorises the operator of the deployment. The change is recorded as a change by Spotlight.
export class DisablePlatformPoolCommand {
  constructor(readonly workspaceId: string) {}
}

export class EnablePlatformPoolCommand {
  constructor(readonly workspaceId: string) {}
}
