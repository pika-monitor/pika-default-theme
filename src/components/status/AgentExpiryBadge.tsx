import {Calendar} from 'lucide-react';
import {cn, isExpired} from '../../lib/utils';

export const AgentExpiryBadge = ({expireTime}: {expireTime: number}) => {
    if (expireTime <= 0) return null;

    const expired = isExpired(expireTime);
    return (
        <span className={cn(
            'inline-flex w-fit items-center gap-1.5 rounded-control border px-2 py-1 text-xs',
            expired
                ? 'border-warning/30 bg-warning-muted font-medium text-warning'
                : 'border-line bg-panel-muted text-content-secondary',
        )}>
            <Calendar className="h-3 w-3 shrink-0"/>
            <span>{expired ? '已过期' : '到期'}</span>
            <time className="font-mono" dateTime={new Date(expireTime).toISOString()}>
                {new Date(expireTime).toLocaleDateString('zh-CN')}
            </time>
        </span>
    );
};
