import {cn} from '../../lib/utils';

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export const normalizeHealthStatus = (status: string | number | boolean | undefined): HealthStatus => {
    if (status === 1 || status === true || status === 'up' || status === 'healthy') return 'healthy';
    if (status === 'degraded' || status === 'warning') return 'degraded';
    if (status === 0 || status === false || status === 'down' || status === 'error') return 'down';
    return 'unknown';
};

const presentation: Record<HealthStatus, {label: string; className: string; dot: string}> = {
    healthy: {label: '正常', className: 'bg-success-muted text-success', dot: 'bg-success'},
    degraded: {label: '需关注', className: 'bg-warning-muted text-warning', dot: 'bg-warning'},
    down: {label: '异常', className: 'bg-danger-muted text-danger', dot: 'bg-danger'},
    unknown: {label: '未知', className: 'bg-panel-muted text-content-muted', dot: 'bg-content-muted'},
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
        <span className={cn('inline-flex h-6 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium leading-none align-middle', item.className, className)}>
            {showDot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', item.dot)} aria-hidden="true"/>}
            <span>{label ?? item.label}</span>
        </span>
    );
};
