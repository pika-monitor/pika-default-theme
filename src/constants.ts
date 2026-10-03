import type {TimeRangeOption} from './types';

export const LIVE_RANGE = 'live';
export const LIVE_WINDOW_MS = 5 * 60 * 1000;
export const LIVE_MONITOR_WINDOW_MS = 15 * 60 * 1000;

export const METRIC_INTERVALS = {cpu: 2000, memory: 5000, disk_io: 2000, network: 2000, network_connection: 10000, gpu: 5000, temperature: 15000, monitor: 10000} as const;

export const POLLING_INTERVALS = {
    serverList: 5000,
    latestMetrics: 5000,
    liveHistory: 2000,
    metadata: 30000,
} as const;

export const SERVER_TIME_RANGE_OPTIONS: TimeRangeOption[] = [
    {label: '实时', value: LIVE_RANGE},
    {label: '15分钟', value: '15m'},
    {label: '30分钟', value: '30m'},
    {label: '1小时', value: '1h'},
    {label: '3小时', value: '3h'},
    {label: '6小时', value: '6h'},
    {label: '12小时', value: '12h'},
    {label: '1天', value: '1d'},
    {label: '3天', value: '3d'},
    {label: '7天', value: '7d'},
];

export const MONITOR_TIME_RANGE_OPTIONS: TimeRangeOption[] = [
    {label: '12小时', value: '12h'},
    {label: '1天', value: '1d'},
    {label: '3天', value: '3d'},
    {label: '7天', value: '7d'},
];

export const AGENT_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#2563eb', '#f97316', '#1d4ed8',
];

export const INTERFACE_COLORS = [
    {upload: '#6FD598', download: '#2C70F6'},
    {upload: '#f59e0b', download: '#8b5cf6'},
    {upload: '#ec4899', download: '#3b82f6'},
    {upload: '#10b981', download: '#f97316'},
    {upload: '#6366f1', download: '#2563eb'},
];

export const TEMPERATURE_COLORS: Record<string, string> = {
    'CPU': '#f97316', 'GPU': '#8b5cf6', 'DISK': '#3b82f6', 'BATTERY': '#10b981',
    'CHIPSET': '#f59e0b', 'SYSTEM': '#6366f1', 'PSU': '#ec4899',
};

export const ACCENT_THEMES: Record<'blue' | 'emerald' | 'purple' | 'amber', { icon: string; badge: string; highlight: string }> = {
    blue: {icon: 'text-blue-400', badge: 'text-blue-400', highlight: 'text-blue-400'},
    emerald: {icon: 'text-emerald-400', badge: 'text-emerald-400', highlight: 'text-emerald-400'},
    purple: {icon: 'text-purple-400', badge: 'text-purple-400', highlight: 'text-purple-400'},
    amber: {icon: 'text-amber-400', badge: 'text-amber-400', highlight: 'text-amber-400'},
};
