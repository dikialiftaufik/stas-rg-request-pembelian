import { cva } from 'class-variance-authority';
export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-input bg-background text-foreground hover:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'bg-transparent text-foreground hover:bg-accent',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline',
        export: 'bg-primary text-primary-foreground hover:bg-primary/90',
      },
      size: {
        default: 'min-h-[var(--ui-control-height)] px-4 py-2',
        sm: 'min-h-8 px-3 py-1.5 text-xs',
        icon: 'size-[var(--ui-icon-target)] p-1.5',
        'icon-sm': 'size-8 p-1.5',
        'icon-lg': 'size-10 p-2',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
