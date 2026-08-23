import dayjs from 'dayjs';
import {cn} from '../../lib/utils';

type TooltipEntry = {
    name?: string;
    value?: number;
    color?: string;
    dataKey?: string;
    payload?: {timestamp?: number | string; [key: string]: unknown};
};

interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string | number;
    unit?: string;
    className?: string;
    timeFormat?: string;
}

export const CustomTooltip = ({active, payload, label, unit = '%', className, timeFormat = 'MM-DD HH:mm'}: CustomTooltipProps) => {
    if (!active || !payload?.length) return null;

    const timestamp = payload[0]?.payload?.timestamp;
    const displayLabel = timestamp ? dayjs(timestamp).format(timeFormat) : label;

    return (
        <div className={cn('rounded-control border border-line bg-panel px-3 py-2 font-mono text-xs shadow-card backdrop-blur-xl', className)}>
            <p className="mb-2 font-semibold tracking-wide text-content">{displayLabel}</p>
            <div className="space-y-1">
                {payload.map((entry, index) => {
                    const title = entry.name ?? entry.dataKey ?? `系列 ${index + 1}`;
                    const value = typeof entry.value === 'number'
                        ? (Number.isFinite(entry.value) ? entry.value.toFixed(2) : '-')
                        : entry.value;
                    return (
                        <p key={`${entry.dataKey ?? index}`} className="flex items-center gap-2 text-content-secondary">
                            <span className="h-2 w-2 rounded-full" style={{backgroundColor: entry.color ?? 'var(--theme-chart-1)'}}/>
                            <span>{title}: <strong className="font-semibold text-content">{value}{unit}</strong></span>
                        </p>
                    );
                })}
            </div>
        </div>
    );
};
