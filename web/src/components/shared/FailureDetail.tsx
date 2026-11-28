type FailureDetailProps = {
  line: string;
};

export function FailureDetail({ line }: FailureDetailProps) {
  return (
    <code className="break-all font-mono text-muted-foreground text-xs">
      {line}
    </code>
  );
}
