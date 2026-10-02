import {type ClassValue, clsx} from 'clsx';
import {twMerge} from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// base 缺省 1000（十进制）：网络流量与运营商计费、硬盘标称口径一致；
// 内存按二进制寻址，调用时显式传 1024 才能还原内存条标称容量
export const formatBytes = (value: number | undefined | null, precision = 2, base = 1000): string => {
    if (value === undefined || value === null || !Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(base)), units.length - 1);
    return `${(value / base ** index).toFixed(precision)} ${units[index]}`;
};

// 流量配额与管理后台保持一致：1 GB = 1024³ B，保留既有配额含义。
export const formatTraffic = (bytes: number | undefined | null): string => formatBytes(bytes, 2, 1024);

export const formatSpeed = (bytesPerSecond: number): string => {
    if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0 B/s';
    const units = ['B/s', 'K/s', 'M/s', 'G/s', 'T/s', 'P/s'];
    const index = Math.min(Math.floor(Math.log(bytesPerSecond) / Math.log(1000)), units.length - 1);
    const value = bytesPerSecond / 1000 ** index;
    const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(decimals)} ${units[index]}`;
};

export const formatTime = (milliseconds: number): string => {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '0 ms';
    if (milliseconds < 1000) return `${milliseconds.toFixed(0)} ms`;
    return `${(milliseconds / 1000).toFixed(2)} s`;
};

export const formatDateTime = (value: string | number | undefined | null): string => {
    if (value === undefined || value === null || value === '') return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const formatPercentValue = (value: number | undefined | null): string => {
    if (value === undefined || value === null || Number.isNaN(value)) return '0.0';
    return value.toFixed(1);
};

export const formatUptime = (seconds: number | undefined | null): string => {
    if (seconds === undefined || seconds === null) return '-';
    if (seconds <= 0) return '0 秒';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days} 天${hours > 0 ? ` ${hours} 小时` : ''}`;
    if (hours > 0) return `${hours} 小时${minutes > 0 ? ` ${minutes} 分钟` : ''}`;
    return minutes > 0 ? `${minutes} 分钟` : '不到 1 分钟';
};

export const formatChartTime = (timestamp: number, timeRange: string, rangeMs?: number): string => {
    const date = new Date(timestamp);
    if (timeRange === 'live') {
        return date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false});
    }
    const isLongRange = rangeMs !== undefined
        ? rangeMs >= 24 * 60 * 60 * 1000
        : timeRange === '1d' || timeRange === '24h' || (timeRange.endsWith('d') && Number.parseInt(timeRange) > 1);
    if (isLongRange) {
        const pad = (part: number) => String(part).padStart(2, '0');
        return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
    return date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
};

const EXPIRING_SOON_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export const isExpired = (expireTime?: number, now = Date.now()) => Boolean(
    expireTime && expireTime > 0 && expireTime <= now,
);

export const isExpiringSoon = (expireTime?: number, now = Date.now()) => Boolean(
    expireTime
    && expireTime > now
    && expireTime - now <= EXPIRING_SOON_WINDOW_MS,
);
