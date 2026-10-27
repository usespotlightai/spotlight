import { createContext, useContext } from 'react';
import type { PendingAttachment } from '@/lib/attachment';
import type { SharedTrace, TargetStation } from '@/lib/chat';

type ReferenceKind = 'file' | 'trace' | 'station';

export interface Reference {
  readonly kind: ReferenceKind;
  readonly key: string;
  readonly name: string;
}

export interface Written {
  readonly text: string;
  readonly references: readonly Reference[];
}

export interface Outgoing {
  readonly body: string;
  readonly attachments: string[];
  readonly traces: string[];
  readonly targetStation: string | null;
  readonly coAuthors?: string[];
  readonly draftGeneration?: number;
}

const CODE = new Set([
  'json',
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'go',
  'rb',
  'rs',
  'java',
  'yml',
  'yaml',
  'toml',
  'sh',
  'sql',
  'html',
  'css',
]);

export const traceReference = (trace: SharedTrace): Reference => ({
  kind: 'trace',
  key: trace.taskId,
  name: trace.title,
});

export const stationReference = (station: TargetStation): Reference => ({
  kind: 'station',
  key: station.stationId,
  name: `${station.stationName} on ${station.lineName}`,
});

export const targetStationIdIn = (
  references: readonly Reference[],
): string | null =>
  references.find((each) => each.kind === 'station')?.key ?? null;

export const isCode = (name: string): boolean =>
  CODE.has(name.slice(name.lastIndexOf('.') + 1).toLowerCase());

export const ReferenceStates = createContext<
  ReadonlyMap<string, PendingAttachment>
>(new Map());

export const useReferenceState = (key: string): PendingAttachment | undefined =>
  useContext(ReferenceStates).get(key);
