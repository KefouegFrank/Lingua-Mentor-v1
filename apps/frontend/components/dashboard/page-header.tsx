export interface PageHeaderProps {
	title: string;
	description?: string;
	action?: React.ReactNode;
}

/** Consistent title/description/action row for every page inside the
 * dashboard shell — dashboard, placement, writing practice, settings. */
export function PageHeader({ title, description, action }: PageHeaderProps) {
	return (
		<div className="flex flex-col gap-4 border-b border-border bg-card px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
			<div className="space-y-1">
				<h1 className="text-2xl font-bold tracking-tight">{title}</h1>
				{description && <p className="text-sm text-muted-foreground">{description}</p>}
			</div>
			{action}
		</div>
	);
}
