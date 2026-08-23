import type {PublicMonitor} from '../../types';
import type {HealthStatus} from '../../components/status/StatusBadge';

export const isMonitorAvailable = (monitor: Pick<PublicMonitor, 'status'>): boolean => monitor.status === 'up';

export const getMonitorHealth = (monitor: Pick<PublicMonitor, 'status' | 'responseTimeMax'>): HealthStatus => {
    if (!isMonitorAvailable(monitor)) return monitor.status === 'down' ? 'down' : 'unknown';
    return monitor.responseTimeMax > 200 ? 'degraded' : 'healthy';
};

export const getPublicMonitorTarget = (monitor: Pick<PublicMonitor, 'showTargetPublic' | 'target'>): string => (
    monitor.showTargetPublic ? monitor.target : '目标地址已隐藏'
);

export const canSearchMonitorTarget = (monitor: Pick<PublicMonitor, 'showTargetPublic' | 'target'>, keyword: string): boolean => (
    monitor.showTargetPublic && monitor.target.toLowerCase().includes(keyword.toLowerCase())
);

export const isMonitorHighLatency = (monitor: Pick<PublicMonitor, 'status' | 'responseTimeMax'>): boolean => (
    isMonitorAvailable(monitor) && monitor.responseTimeMax > 200
);

export const getCertificateHealth = (monitor: Pick<PublicMonitor, 'type' | 'certDaysLeft'>): 'valid' | 'expiring' | 'expired' | 'none' => {
    if (monitor.type !== 'https') return 'none';
    if (monitor.certDaysLeft < 0) return 'expired';
    if (monitor.certDaysLeft < 30) return 'expiring';
    return 'valid';
};
