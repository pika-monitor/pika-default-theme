import {Calendar} from 'lucide-react';
import {cn, isExpired, isExpiringSoon} from '../../lib/utils';

export const AgentExpiryBadge = ({expireTime}: {expireTime?: number}) => {
    if (!expireTime || expireTime <= 0) return null;

    const expired = isExpired(expireTime);
    const expiringSoon = isExpiringSoon(expireTime);
    const label = expired ? '已过期' : expiringSoon ? '即将到期' : '到期';
    return (
        <span className={cn(
            'inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control border px-2 py-1 text-xs',
            expired
                ? 'border-danger/30 bg-danger-muted font-medium text-danger'
                : expiringSoon
                    ? 'border-warning/30 bg-warning-muted font-medium text-warning'
                    : 'border-line bg-panel-muted text-content-secondary',
        )}>
            <Calendar className="h-3 w-3 shrink-0"/>
            <span className="shrink-0">{label}</span>
            <time className="shrink-0 tabular-nums" dateTime={new Date(expireTime).toISOString()}>
                {new Date(expireTime).toLocaleDateString('zh-CN')}
            </time>
        </span>
    );
};
