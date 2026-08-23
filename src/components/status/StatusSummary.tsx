import type {MouseEventHandler} from 'react';
import {cn} from '../../lib/utils';
import type {HealthStatus} from './StatusBadge';

interface StatusSignal {
    label: string;
    status?: HealthStatus;
    onClick?: MouseEventHandler<HTMLButtonElement>;
}

interface StatusSummaryProps {
    title: string;
    current: number;
    total: number;
    currentLabel: string;
    status: HealthStatus;
    signals?: Array<StatusSignal | false | null | undefined>;
    refreshLabel?: string;
}

const statusColor: Record<HealthStatus, string> = {
    healthy: 'bg-success',
    degraded: 'bg-warning',
    down: 'bg-danger',
    unknown: 'bg-content-muted',
};

const signalColor: Record<HealthStatus, string> = {
    healthy: 'text-success',
    degraded: 'text-warning',
    down: 'text-danger',
    unknown: 'text-content-muted',
};

export const StatusSummary = ({title, current, total, currentLabel, status, signals = [], refreshLabel}: StatusSummaryProps) => {
    const visibleSignals = signals.filter(Boolean) as StatusSignal[];
    return (
        <section
            aria-label={title}
            className="relative overflow-hidden rounded-card border border-line bg-panel px-4 py-3 text-sm shadow-card backdrop-blur-md"
        >
            <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-content">
                    <span
                        className={cn(
                            'h-2 w-2 rounded-full',
                            statusColor[status],
                            (status === 'degraded' || status === 'down') && 'animate-pulse',
                        )}
                        aria-hidden="true"
                    />
                    <span className="text-xs font-semibold">{title}</span>
                    <span className="text-xs text-content-secondary"><strong className="text-content">{current}/{total}</strong> {currentLabel}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {visibleSignals.map((signal, index) => signal.onClick ? (
                        <button key={`${signal.label}-${index}`} type="button" onClick={signal.onClick} className={cn('font-medium underline decoration-current/40 underline-offset-4 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand', signalColor[signal.status ?? 'unknown'])}>
                            {signal.label}
                        </button>
                    ) : (
                        <span key={`${signal.label}-${index}`} className={cn('font-medium', signalColor[signal.status ?? 'unknown'])}>{signal.label}</span>
                    ))}
                    {refreshLabel && <span className="text-content-muted">{refreshLabel}</span>}
                </div>
            </div>
        </section>
    );
};
