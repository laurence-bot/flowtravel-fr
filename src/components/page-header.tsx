export function PageHeader({
  title,
  description,
  action,
  numero,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  numero?: string | null;
}) {
  return (
    <header className="flex flex-wrap items-start md:items-end justify-between gap-3 md:gap-4 pb-6 border-b border-border">
      <div className="min-w-0">
        {numero && (
          <div className="text-xs font-mono text-muted-foreground tracking-wide mb-1">
            N° {numero}
          </div>
        )}
        <h1 className="font-display text-2xl md:text-4xl text-foreground break-words">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1.5">{description}</p>
        )}
      </div>
      {action && <div className="w-full md:w-auto flex flex-wrap gap-2">{action}</div>}
    </header>
  );
}
