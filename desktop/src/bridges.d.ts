export interface DesktopBridge {
  readonly platform: string;
  setBadge(count: number): void;
  show(): void;
  authorize(url: string): void;
  setTheme(theme: string): void;
  close(): void;
  changeAddress(): void;
  openNotificationSettings(): void;
  onCommand(listener: (command: string) => void): () => void;
}

export interface ConnectBridge {
  current(): Promise<string>;
  save(address: string): Promise<boolean>;
  cancel(): void;
  fit(height: number): void;
}
