import {ShieldCheck} from 'lucide-react';
import {StatusBadge} from './StatusBadge';

export const CertificateBadge = ({expiryTime, daysLeft}: {expiryTime?: number; daysLeft?: number}) => {
    if (!expiryTime || daysLeft === undefined) return null;
    const status = daysLeft < 0 ? 'down' : daysLeft < 30 ? 'degraded' : 'healthy';
    return (
        <StatusBadge
            status={status}
            label={daysLeft < 0 ? '已过期' : `${daysLeft} 天后过期`}
            showDot={false}
            icon={<ShieldCheck className="h-3 w-3"/>}
        />
    );
};
