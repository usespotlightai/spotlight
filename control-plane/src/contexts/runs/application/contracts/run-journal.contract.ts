type StepKind =
  | 'message'
  | 'thought'
  | 'tool'
  | 'planned'
  | 'hook'
  | 'subagent'
  | 'waited'
  | 'lost'
  | 'reminded'
  | 'turn';

export interface SpentCost {
  readonly amount: number;
  readonly currency: string;
}

export type EgressEnforcement = 'enforced' | 'not-enforced';

export interface StepLocation {
  readonly path: string;
  readonly line: number | null;
}

export interface StepChange {
  readonly path: string | null;
  readonly before: string;
  readonly after: string;
}

export interface JournalStep {
  readonly kind: StepKind;
  readonly text: string;
  readonly status: string | null;
  readonly tool: string | null;
  readonly detail: string | null;
  readonly ms: number;
  readonly startedAt: Date;
  readonly locations: readonly StepLocation[];
  readonly input: string | null;
  readonly output: string | null;
  readonly change: StepChange | null;
}

interface RunSpent {
  readonly used: number;
  readonly size: number;
  readonly cost: SpentCost | null;
}

export interface RunMarks {
  readonly startedAt: Date | null;
  readonly readyAt: Date | null;
  readonly firstAgentUpdateAt: Date | null;
  readonly lastAgentUpdateAt: Date | null;
  readonly agentStoppedAt: Date | null;
  readonly endedAt: Date | null;
}

export interface SpanAttribute {
  readonly name: string;
  readonly value: string;
}

export interface RunSpan {
  readonly id: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly startedAt: Date;
  readonly ms: number;
  readonly failed: boolean;
  readonly attributes: readonly SpanAttribute[];
}

type SessionStatus = 'running' | 'needs-action' | 'idle';

export type BackgroundKind = 'command' | 'monitor' | 'subagent' | 'other';

interface BackgroundTask {
  readonly id: string;
  readonly kind: BackgroundKind;
  readonly description: string;
}

export interface RunJournal {
  readonly runId: string;
  readonly attempt: number;
  readonly steps: readonly JournalStep[];
  readonly spans: readonly RunSpan[];
  readonly ms: number | null;
  readonly marks: RunMarks;
  readonly spent: RunSpent | null;
  readonly egressEnforcement: EgressEnforcement | null;
  readonly sessionStatus: SessionStatus | null;
  readonly background: readonly BackgroundTask[];
}

export interface RunChanges {
  readonly runId: string;
  readonly checkouts: readonly string[];
  readonly paths: readonly string[];
}

export interface RunStepCounts {
  readonly stepCount: number;
  readonly messageCount: number;
}

export interface JournalledRun extends RunStepCounts {
  readonly runId: string;
  readonly createdAt: Date;
}

export interface FileChange {
  readonly path: string;
  readonly before: string;
  readonly after: string;
  readonly omitted: boolean;
}

export interface ChangeHunk {
  readonly id: string;
  readonly path: string;
  readonly index: number;
  readonly header: string;
  readonly lines: readonly string[];
}
