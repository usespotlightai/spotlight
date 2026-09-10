/**
 * The task events a team may bind an outbound action to — the vocabulary shared
 * by what the aggregate records (each event's `kind`), what a configuration is
 * allowed to name in its `on:` bindings, and what the notifier carries out. One
 * list, so the three cannot drift: a new kind of chatter is added here once.
 */
export const BINDABLE_TASK_EVENTS = [
  'task.opened',
  'task.pull-request-opened',
  'task.asked',
] as const;

export type BindableTaskEvent = (typeof BINDABLE_TASK_EVENTS)[number];

export const isBindableTaskEvent = (kind: string): kind is BindableTaskEvent =>
  (BINDABLE_TASK_EVENTS as readonly string[]).includes(kind);
