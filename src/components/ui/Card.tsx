import type {ReactNode} from 'react';
import {cn} from '../../lib/utils';

type CardPadding = 'none' | 'sm' | 'md' | 'lg';
type CardVariant = 'default' | 'muted';

interface CardProps {
    title?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    interactive?: boolean;
    padding?: CardPadding;
    variant?: CardVariant;
}

const paddingStyles: Record<CardPadding, string> = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
};

const variantStyles: Record<CardVariant, string> = {
    default: 'bg-panel',
    muted: 'bg-panel-muted',
};

export const Card = ({
    title,
    action,
    children,
    className,
    interactive = false,
    padding = 'md',
    variant = 'default',
}: CardProps) => {
    const hasHeader = Boolean(title || action);

    return (
        <div className={cn(
            'group relative overflow-hidden rounded-card border border-line shadow-card transition-all duration-200',
            variantStyles[variant],
            interactive && 'cursor-pointer hover:border-line-strong hover:bg-panel-hover',
        )}>
            <div className={cn('relative z-10', paddingStyles[padding], className)}>
                {hasHeader && (
                    <div className="flex flex-col gap-3 border-b border-line pb-3 sm:flex-row sm:items-start sm:justify-between sm:pb-4">
                        {title && <h2 className="min-w-0 text-base font-semibold text-content sm:text-lg">{title}</h2>}
                        {action && <div className="shrink-0">{action}</div>}
                    </div>
                )}
                <div className={cn(hasHeader && 'pt-4')}>{children}</div>
            </div>
        </div>
    );
};
