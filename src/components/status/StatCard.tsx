import type {ReactNode} from 'react';
import type {LucideIcon} from 'lucide-react';
import {cn} from '../../lib/utils';

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const toneStyles: Record<Tone, string> = {
    neutral: 'text-content-secondary',
    accent: 'text-brand',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
};

const toneSurfaces: Record<Tone, string> = {
    neutral: '',
    accent: 'border-brand/20 bg-brand-muted/40',
    success: 'dark:border-emerald-500/30 dark:bg-emerald-500/5',
    warning: 'dark:border-amber-500/30 dark:bg-amber-500/5',
    danger: 'dark:border-rose-500/30 dark:bg-rose-500/5',
};

interface StatCardProps {
    label: string;
    value: ReactNode;
    unit?: string;
    icon?: LucideIcon;
    tone?: Tone;
    className?: string;
}

export const StatCard = ({label, value, unit, icon: Icon, tone = 'neutral', className}: StatCardProps) => (
    <div className={cn('relative overflow-hidden rounded-card border border-line bg-panel p-4 shadow-card backdrop-blur-md sm:p-5', toneSurfaces[tone], className)}>
        {Icon && <Icon className={cn('absolute -bottom-4 -right-4 h-20 w-20 -rotate-12 opacity-10 sm:h-24 sm:w-24', toneStyles[tone])}/>} 
        <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-xs font-medium text-content-secondary">{label}</p>
                <p className="mt-2 flex items-baseline gap-1 text-3xl font-bold tracking-tight text-content sm:text-4xl">
                    {value}
                    {unit && <span className="text-sm font-normal text-content-muted">{unit}</span>}
                </p>
            </div>
            {Icon && <span className={cn('p-2.5', toneStyles[tone])}><Icon className="h-6 w-6"/></span>}
        </div>
    </div>
);
