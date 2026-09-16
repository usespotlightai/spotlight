export type SetupAboutProps = {
  readonly title: string;
  readonly description: string | null;
};

export function SetupAbout({ title, description }: SetupAboutProps) {
  return (
    <div>
      <h1 className="font-medium text-foreground text-sm leading-6">{title}</h1>

      {description && (
        <p className="text-muted-foreground text-sm leading-6">{description}</p>
      )}
    </div>
  );
}
