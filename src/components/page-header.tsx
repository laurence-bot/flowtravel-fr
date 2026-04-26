export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-border">
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1.5">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}
