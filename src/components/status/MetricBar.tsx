import type {LucideIcon} from 'lucide-react';
import {cn} from '../../lib/utils';

type MetricType = 'cpu' | 'memory' | 'disk';

const metricColors: Record<MetricType, string> = {
    cpu: 'bg-chart-1',
    memory: 'bg-chart-4',
    disk: 'bg-chart-2',
};

interface MetricBarProps {
    type: MetricType;
    value?: number;
    label: string;
    icon: LucideIcon;
    detail?: string;
}

export const MetricBar = ({type, value, label, icon: Icon, detail}: MetricBarProps) => {
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(value ?? 0, 100)) : 0;
    const barColor = safeValue >= 90 ? 'bg-danger' : safeValue >= 75 ? 'bg-warning' : metricColors[type];
    const textColor = safeValue >= 90 ? 'text-danger' : safeValue >= 75 ? 'text-warning' : 'text-content-secondary';
    return (
        <div className="flex h-6 w-full items-center gap-2 tabular-nums text-xs" title={detail}>
            <div className={cn('flex w-14 shrink-0 items-center gap-1.5 font-semibold', textColor)}>
                <Icon className="h-3.5 w-3.5"/>
                <span>{label}</span>
            </div>
            <div className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                    className={cn('h-full rounded-full transition-[width] duration-500 ease-out', barColor)}
                    style={{width: `${safeValue}%`}}
                />
            </div>
            <span className={cn('w-14 shrink-0 text-right tabular-nums', textColor)}>{safeValue.toFixed(1)}%</span>
        </div>
    );
};
