import {Globe, Server, ShieldCheck, Wifi} from 'lucide-react';

export const MonitorTypeIcon = ({type, className = 'h-4 w-4'}: {type: string; className?: string}) => {
    switch (type.toLowerCase()) {
        case 'https':
            return <ShieldCheck className={`${className} text-chart-4`}/>;
        case 'http':
            return <Globe className={`${className} text-chart-1`}/>;
        case 'tcp':
            return <Server className={`${className} text-chart-3`}/>;
        case 'icmp':
        case 'ping':
            return <Wifi className={`${className} text-brand`}/>;
        default:
            return <Server className={`${className} text-content-muted`}/>;
    }
};
