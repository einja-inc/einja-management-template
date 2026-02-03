import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import type React from "react";

import { cn } from "./lib/utils";

const typographyVariants = cva("", {
	variants: {
		variant: {
			h1: "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
			h2: "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
			h3: "scroll-m-20 text-2xl font-semibold tracking-tight",
			h4: "scroll-m-20 text-xl font-semibold tracking-tight",
			h5: "scroll-m-20 text-lg font-semibold tracking-tight",
			h6: "scroll-m-20 text-base font-semibold tracking-tight",
			p: "leading-7 [&:not(:first-child)]:mt-6",
			blockquote: "mt-6 border-l-2 pl-6 italic",
			code: "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
			lead: "text-xl text-muted-foreground",
			large: "text-lg font-semibold",
			small: "text-sm font-medium leading-none",
			muted: "text-sm text-muted-foreground",
		},
		align: {
			left: "text-left",
			center: "text-center",
			right: "text-right",
			justify: "text-justify",
		},
		color: {
			default: "",
			muted: "text-muted-foreground",
			primary: "text-primary",
			secondary: "text-secondary-foreground",
			accent: "text-accent-foreground",
			destructive: "text-destructive",
		},
	},
	defaultVariants: {
		variant: "p",
		align: "left",
		color: "default",
	},
});

interface TypographyProps
	extends Omit<React.HTMLAttributes<HTMLElement>, "color">,
		VariantProps<typeof typographyVariants> {
	asChild?: boolean;
	as?: React.ElementType;
}

function Typography({
	className,
	variant,
	align,
	color,
	asChild = false,
	as,
	...props
}: TypographyProps) {
	const Component = asChild ? Slot : as || getDefaultElement(variant || "p");

	return (
		<Component
			className={cn(typographyVariants({ variant, align, color }), className)}
			{...props}
		/>
	);
}

function getDefaultElement(variant: string): React.ElementType {
	switch (variant) {
		case "h1":
		case "h2":
		case "h3":
		case "h4":
		case "h5":
		case "h6":
			return variant;
		case "blockquote":
			return "blockquote";
		case "code":
			return "code";
		default:
			return "p";
	}
}

// 個別のコンポーネントも提供
const H1 = ({
	className,
	...props
}: Omit<React.HTMLAttributes<HTMLHeadingElement>, "color">) => (
	<Typography variant="h1" as="h1" className={className} {...props} />
);

const H2 = ({
	className,
	...props
}: Omit<React.HTMLAttributes<HTMLHeadingElement>, "color">) => (
	<Typography variant="h2" as="h2" className={className} {...props} />
);

const H3 = ({
	className,
	...props
}: Omit<React.HTMLAttributes<HTMLHeadingElement>, "color">) => (
	<Typography variant="h3" as="h3" className={className} {...props} />
);

const H4 = ({
	className,
	...props
}: Omit<React.HTMLAttributes<HTMLHeadingElement>, "color">) => (
	<Typography variant="h4" as="h4" className={className} {...props} />
);

const P = ({
	className,
	...props
}: Omit<React.HTMLAttributes<HTMLParagraphElement>, "color">) => (
	<Typography variant="p" as="p" className={className} {...props} />
);

const Lead = ({
	className,
	...props
}: Omit<React.HTMLAttributes<HTMLParagraphElement>, "color">) => (
	<Typography variant="lead" as="p" className={className} {...props} />
);

const Large = ({
	className,
	...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, "color">) => (
	<Typography variant="large" as="div" className={className} {...props} />
);

const Small = ({
	className,
	...props
}: Omit<React.HTMLAttributes<HTMLElement>, "color">) => (
	<Typography variant="small" as="small" className={className} {...props} />
);

const Muted = ({
	className,
	...props
}: Omit<React.HTMLAttributes<HTMLParagraphElement>, "color">) => (
	<Typography variant="muted" as="p" className={className} {...props} />
);

const Blockquote = ({
	className,
	...props
}: Omit<React.HTMLAttributes<HTMLQuoteElement>, "color">) => (
	<Typography
		variant="blockquote"
		as="blockquote"
		className={className}
		{...props}
	/>
);

const InlineCode = ({
	className,
	...props
}: Omit<React.HTMLAttributes<HTMLElement>, "color">) => (
	<Typography variant="code" as="code" className={className} {...props} />
);

export {
	Typography,
	typographyVariants,
	H1,
	H2,
	H3,
	H4,
	P,
	Lead,
	Large,
	Small,
	Muted,
	Blockquote,
	InlineCode,
};
