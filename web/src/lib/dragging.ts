import type { Task } from '@/lib/task';

type Landing = { stationId: string; afterTaskId: string | null };

type Over = {
  kind: 'task' | 'station';
  id: string;
  stationId: string;
};

const idsAt = (tasks: readonly Task[], stationId: string): string[] =>
  tasks.filter((each) => each.stationId === stationId).map((each) => each.id);

const following = (order: readonly string[], taskId: string) => {
  const at = order.indexOf(taskId);
  return at <= 0 ? null : (order[at - 1] as string);
};

export const landingFor = (
  tasks: readonly Task[],
  taskId: string,
  over: Over,
): Landing | null => {
  const moving = tasks.find((each) => each.id === taskId);

  if (!moving) {
    return null;
  }

  const standing = idsAt(tasks, over.stationId);

  if (over.kind === 'station') {
    const rest = standing.filter((each) => each !== taskId);
    return {
      stationId: over.stationId,
      afterTaskId: rest.length === 0 ? null : (rest[rest.length - 1] as string),
    };
  }

  const to = standing.indexOf(over.id);

  if (to === -1) {
    return null;
  }

  if (moving.stationId !== over.stationId) {
    return {
      stationId: over.stationId,
      afterTaskId: to === 0 ? null : (standing[to - 1] as string),
    };
  }

  const from = standing.indexOf(taskId);

  if (from === -1) {
    return null;
  }

  const order = [...standing];
  order.splice(from, 1);
  order.splice(to, 0, taskId);

  return { stationId: over.stationId, afterTaskId: following(order, taskId) };
};

export const reordered = (
  ids: readonly string[],
  activeId: string,
  overId: string,
): string[] => {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);

  if (from === -1 || to === -1 || from === to) {
    return [...ids];
  }

  const order = [...ids];
  order.splice(from, 1);
  order.splice(to, 0, activeId);

  return order;
};
