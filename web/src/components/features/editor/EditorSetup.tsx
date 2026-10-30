import { CopyIconAction } from '@/components/shared/CopyIconAction';
import { EDITOR_NAMES, type EditorApp, editorSetupSteps } from '@/lib/editor';

type EditorSetupProps = {
  app: EditorApp;
  origin: string;
};

export function EditorSetup({ app, origin }: EditorSetupProps) {
  const name = EDITOR_NAMES[app];

  return (
    <div className="flex w-80 flex-col gap-3 p-2">
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground text-sm">
          Set up this computer once
        </p>
        <p className="text-muted-foreground text-xs leading-5">
          If {name} did not open, this computer needs the Spotlight CLI, an SSH
          configuration and a longer connect timeout.
        </p>
      </div>

      <ol className="flex flex-col gap-2.5">
        {editorSetupSteps(origin, app).map((step, at) => (
          <li key={step.title} className="flex items-start gap-2">
            <span className="w-3 shrink-0 pt-px text-muted-foreground text-xs tabular-nums">
              {at + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">
                {step.title}
              </span>
              <span className="select-text break-all text-foreground text-sm">
                {step.command}
              </span>
              {step.note && (
                <span className="text-muted-foreground text-xs leading-5">
                  {step.note}
                </span>
              )}
            </div>
            <CopyIconAction text={step.command} label={`Copy: ${step.title}`} />
          </li>
        ))}
      </ol>

      <p className="text-muted-foreground text-xs leading-5">
        {name} also needs the Remote - SSH extension.
      </p>
    </div>
  );
}
