export type Ask = (
  peer: string,
  message: Readonly<Record<string, unknown>>,
) => void;

export interface TunnelDirectory {
  readonly address: string | null;

  claimPeer(peer: string): Promise<void>;
  renewPeer(peer: string): Promise<void>;
  releasePeer(peer: string): Promise<void>;
  ownerOfPeer(peer: string): Promise<string | null>;

  claimStream(stream: string): Promise<void>;
  ownerOfStream(stream: string): Promise<string | null>;

  ask(
    owner: string,
    peer: string,
    message: Readonly<Record<string, unknown>>,
  ): Promise<boolean>;
  onAsk(ask: Ask): void;
  stopAsking(): Promise<void>;
}

export const NO_TUNNEL_DIRECTORY: TunnelDirectory = {
  address: null,
  claimPeer: async () => {},
  renewPeer: async () => {},
  releasePeer: async () => {},
  ownerOfPeer: async () => null,
  claimStream: async () => {},
  ownerOfStream: async () => null,
  ask: async () => false,
  onAsk: () => {},
  stopAsking: async () => {},
};
