import { createContext, useContext } from 'react';
import type { PendingAttachment } from '@/lib/attachment';

export type ReferenceKind = 'file' | 'trace';

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

export const isCode = (name: string): boolean =>
  CODE.has(name.slice(name.lastIndexOf('.') + 1).toLowerCase());

export const ReferenceStates = createContext<
  ReadonlyMap<string, PendingAttachment>
>(new Map());

export const useReferenceState = (key: string): PendingAttachment | undefined =>
  useContext(ReferenceStates).get(key);
