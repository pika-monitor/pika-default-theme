import {cn} from '../../lib/utils';

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export const normalizeHealthStatus = (status: string | number | boolean | undefined): HealthStatus => {
    if (status === 1 || status === true || status === 'up' || status === 'healthy') return 'healthy';
    if (status === 'degraded' || status === 'warning') return 'degraded';
    if (status === 0 || status === false || status === 'down' || status === 'error') return 'down';
    return 'unknown';
};

const presentation: Record<HealthStatus, {label: string; className: string; dot: string}> = {
    healthy: {label: '正常', className: 'border-success/30 bg-success-muted text-success', dot: 'bg-success'},
    degraded: {label: '需关注', className: 'border-warning/30 bg-warning-muted text-warning', dot: 'bg-warning'},
    down: {label: '异常', className: 'border-danger/30 bg-danger-muted text-danger', dot: 'bg-danger'},
    unknown: {label: '未知', className: 'border-line bg-panel-muted text-content-muted', dot: 'bg-content-muted'},
};

interface StatusBadgeProps {
    status: HealthStatus | string | number | boolean;
    label?: string;
    showDot?: boolean;
    className?: string;
}

export const StatusBadge = ({status, label, showDot = true, className}: StatusBadgeProps) => {
    const normalized = normalizeHealthStatus(status);
    const item = presentation[normalized];
    return (
        <span className={cn('inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', item.className, className)}>
            {showDot && <span className={cn('h-1.5 w-1.5 rounded-full', item.dot, normalized === 'down' && 'animate-pulse')} aria-hidden="true"/>}
            {label ?? item.label}
        </span>
    );
};
