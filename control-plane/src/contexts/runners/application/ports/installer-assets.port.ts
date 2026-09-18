export const INSTALLER_ASSETS = Symbol('INSTALLER_ASSETS');

export interface InstallerAssetsPort {
  script(): string;
}
