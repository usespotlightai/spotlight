export const BINDABLE_TASK_EVENTS = [
  'task.opened',
  'task.pull-request-opened',
  'task.asked',
] as const;

export type BindableTaskEvent = (typeof BINDABLE_TASK_EVENTS)[number];

export const isBindableTaskEvent = (kind: string): kind is BindableTaskEvent =>
  (BINDABLE_TASK_EVENTS as readonly string[]).includes(kind);
