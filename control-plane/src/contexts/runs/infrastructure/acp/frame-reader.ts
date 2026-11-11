import type { Content } from '@runs/infrastructure/acp/content';
import { decoded } from '@runs/infrastructure/journal/journalled';

export interface HarnessNotification {
  sessionId?: string;
  update?: {
    _meta?: { claudeCode?: { toolName?: unknown } };
    sessionUpdate?: string;
    sessionId?: string;
    toolCallId?: string;
    title?: string;
    description?: string;
    status?: string;
    kind?: string;
    used?: number;
    size?: number;
    cost?: { amount?: number; currency?: string };
    locations?: { path?: string; line?: number }[];
    rawInput?: unknown;
    rawOutput?: unknown;
    entries?: { content?: string; priority?: string; status?: string }[];
    content?: Content;
    state?: { state?: string; stopReason?: string | null };
    senderSessionId?: string;
    recipientSessionId?: string;
  };
}

export interface FrameReader {
  read(data: string): HarnessNotification | null;
}

const ACP_1: FrameReader = {
  read(data: string): HarnessNotification | null {
    try {
      const parsed: unknown = JSON.parse(decoded(data));
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as HarnessNotification)
        : null;
    } catch {
      return null;
    }
  },
};

const READERS: ReadonlyMap<string, FrameReader> = new Map([['acp/1', ACP_1]]);

export const frameReaderFor = (protocol: string | null): FrameReader | null =>
  protocol === null ? ACP_1 : (READERS.get(protocol) ?? null);
