import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
	value: T;
	label: string;
}

export interface SegmentedControlProps<T extends string> {
	options: SegmentedOption<T>[];
	value: T;
	onChange: (value: T) => void;
	name: string;
	className?: string;
}

/** A small, fixed set of mutually exclusive choices rendered as a button
 * group — used for target language now, and the same shape fits accent
 * target / persona selection later without a new component. */
export function SegmentedControl<T extends string>({
	options,
	value,
	onChange,
	name,
	className,
}: SegmentedControlProps<T>) {
	return (
		<div
			role="radiogroup"
			aria-label={name}
			className={cn("inline-flex rounded-md border border-input bg-secondary/50 p-1", className)}
		>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					role="radio"
					aria-checked={value === option.value}
					onClick={() => onChange(option.value)}
					className={cn(
						"flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
						value === option.value
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
