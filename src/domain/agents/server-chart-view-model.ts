import type {MetricPoint, MetricSeries} from '../../types';

export type ChartPoint = {timestamp: number} & Record<string, number | null>;

const normalizePoints = (points: MetricPoint[]): MetricPoint[] => {
    const values = new Map<number, number>();
    for (const point of points) {
        if (Number.isFinite(point.timestamp) && Number.isFinite(point.value)) {
            values.set(point.timestamp, Number(point.value.toFixed(2)));
        }
    }
    return [...values].map(([timestamp, value]) => ({timestamp, value})).sort((a, b) => a.timestamp - b.timestamp);
};

export interface GpuSeries {
    key: string;
    gpuIndex: string;
    metricType: 'utilization' | 'temperature';
    name: string;
    points: MetricPoint[];
}

export const getGpuSeries = (series: MetricSeries[]): GpuSeries[] => {
    const grouped = new Map<string, GpuSeries>();
    for (const entry of series) {
        const metricType = entry.labels?.metric_type ?? entry.name;
        if (metricType !== 'utilization' && metricType !== 'temperature') continue;
        const gpuIndex = entry.labels?.gpu_index ?? entry.name.match(/^GPU_(.+)$/)?.[1] ?? '0';
        const key = `gpu_${gpuIndex}_${metricType}`;
        const existing = grouped.get(key);
        grouped.set(key, {
            key,
            gpuIndex,
            metricType,
            name: `GPU ${gpuIndex} ${metricType === 'utilization' ? '使用率 (%)' : '温度 (°C)'}`,
            points: [...(existing?.points ?? []), ...entry.data],
        });
    }
    return [...grouped.values()]
        .map(entry => ({...entry, points: normalizePoints(entry.points)}))
        .filter(entry => entry.points.length > 0)
        .sort((a, b) => a.gpuIndex.localeCompare(b.gpuIndex, undefined, {numeric: true}) || a.metricType.localeCompare(b.metricType));
};

export const buildGpuChartData = (series: GpuSeries[]): ChartPoint[] => {
    const rows = new Map<number, ChartPoint>();
    for (const entry of series) {
        for (const point of entry.points) {
            const row = rows.get(point.timestamp) ?? {timestamp: point.timestamp};
            row[entry.key] = point.value;
            rows.set(point.timestamp, row);
        }
    }
    return [...rows.values()].sort((a, b) => a.timestamp - b.timestamp);
};

export interface MonitorSeries {
    key: string;
    name: string;
    points: MetricPoint[];
}

export const getMonitorSeries = (series: MetricSeries[]): MonitorSeries[] => {
    const grouped = new Map<string, MonitorSeries>();
    for (const entry of series) {
        const id = entry.labels?.monitor_id ?? entry.labels?.monitor_name ?? entry.name;
        const key = `monitor_${id}`;
        const existing = grouped.get(key);
        grouped.set(key, {
            key,
            name: entry.labels?.monitor_name ?? id,
            points: [...(existing?.points ?? []), ...entry.data],
        });
    }
    return [...grouped.values()]
        .map(entry => ({...entry, points: normalizePoints(entry.points)}))
        .sort((a, b) => a.key.localeCompare(b.key));
};

const interpolate = (points: MetricPoint[], timestamp: number): number | null => {
    if (!points.length || timestamp < points[0].timestamp || timestamp > points[points.length - 1].timestamp) return null;
    let left = 0;
    let right = points.length - 1;
    while (right - left > 1) {
        const middle = Math.floor((left + right) / 2);
        if (points[middle].timestamp <= timestamp) left = middle;
        else right = middle;
    }
    if (points[left].timestamp === timestamp) return points[left].value;
    if (points[right].timestamp === timestamp) return points[right].value;
    const ratio = (timestamp - points[left].timestamp) / (points[right].timestamp - points[left].timestamp);
    return Number((points[left].value + ratio * (points[right].value - points[left].value)).toFixed(2));
};

export const buildMonitorChartData = (series: MonitorSeries[], selected: ReadonlySet<string>): ChartPoint[] => {
    const visible = series.filter(entry => selected.has(entry.key));
    // Keep every original timestamp, including single-point series and peaks.
    const timestamps = [...new Set(visible.flatMap(entry => entry.points.map(point => point.timestamp)))].sort((a, b) => a - b);
    return timestamps.map(timestamp => {
        const row: ChartPoint = {timestamp};
        for (const entry of visible) row[entry.key] = interpolate(entry.points, timestamp);
        return row;
    });
};

export const reconcileMonitorSelection = (previous: ReadonlySet<string>, next: ReadonlySet<string>, selected: ReadonlySet<string>): Set<string> => {
    const selectedAll = previous.size === 0 || [...previous].every(key => selected.has(key));
    if (selectedAll) return new Set(next);
    const remaining = new Set([...selected].filter(key => next.has(key)));
    return selected.size > 0 && remaining.size === 0 ? new Set(next) : remaining;
};

export const formatMetricNumber = (value: number | undefined | null, digits = 1, suffix = ''): string => (
    typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '—'
);
