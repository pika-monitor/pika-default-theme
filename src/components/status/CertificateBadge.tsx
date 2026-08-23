import {ShieldCheck} from 'lucide-react';
import {cn} from '../../lib/utils';

export const CertificateBadge = ({expiryTime, daysLeft}: {expiryTime?: number; daysLeft?: number}) => {
    if (!expiryTime || daysLeft === undefined) return null;
    const status = daysLeft < 0 ? 'danger' : daysLeft < 30 ? 'warning' : 'success';
    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium',
            status === 'danger' && 'border-danger/30 bg-danger-muted text-danger',
            status === 'warning' && 'border-warning/30 bg-warning-muted text-warning',
            status === 'success' && 'border-success/30 bg-success-muted text-success',
        )}>
            <ShieldCheck className="h-3 w-3"/>
            {daysLeft < 0 ? '已过期' : `${daysLeft} 天后过期`}
        </span>
    );
};
