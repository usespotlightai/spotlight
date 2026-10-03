import { TrailLink } from '@/components/shell/layout/TrailLink';

type HealthTask = {
  readonly key: string;
  readonly title: string;
  readonly to: string;
  readonly said: string;
};

type HealthTasksProps = {
  label: string;
  tasks: readonly HealthTask[];
};

export function HealthTasks({ label, tasks }: HealthTasksProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <ul aria-label={label} className="flex flex-col gap-0.5 text-xs">
      {tasks.map((task) => (
        <li key={task.key} className="flex min-w-0 items-baseline gap-2">
          <TrailLink
            to={task.to}
            className="min-w-0 truncate text-foreground underline-offset-2 hover:underline"
          >
            {task.title}
          </TrailLink>
          <span className="shrink-0 text-muted-foreground tabular-nums">
            {task.said}
          </span>
        </li>
      ))}
    </ul>
  );
}
