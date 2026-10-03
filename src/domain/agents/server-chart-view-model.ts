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
    intervalMs?: number;
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
            intervalMs: Number(entry.labels?.interval_ms) || undefined,
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
    intervalMs?: number;
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
            intervalMs: Number(entry.labels?.interval_ms) || undefined,
        });
    }
    return [...grouped.values()]
        .map(entry => ({...entry, points: normalizePoints(entry.points)}))
        .sort((a, b) => a.key.localeCompare(b.key));
};

const interpolate = (points: MetricPoint[], timestamp: number, maxGapMs = Infinity): number | null => {
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
    if (points[right].timestamp - points[left].timestamp > maxGapMs) return null;
    const ratio = (timestamp - points[left].timestamp) / (points[right].timestamp - points[left].timestamp);
    return Number((points[left].value + ratio * (points[right].value - points[left].value)).toFixed(2));
};

export const buildMonitorChartData = (series: MonitorSeries[], selected: ReadonlySet<string>, defaultMaxGapMs = Infinity, respectIntervals = true): ChartPoint[] => {
    const visible = series.filter(entry => selected.has(entry.key));
    // Keep every original timestamp, including single-point series and peaks.
    const maxGap = (entry: MonitorSeries) => respectIntervals && entry.intervalMs ? entry.intervalMs * 3 : defaultMaxGapMs;
    const gaps = visible.flatMap(entry => entry.points.slice(1).flatMap((point, index) =>
        point.timestamp - entry.points[index].timestamp > maxGap(entry)
            ? [entry.points[index].timestamp + 1] : []));
    const timestamps = [...new Set([...visible.flatMap(entry => entry.points.map(point => point.timestamp)), ...gaps])].sort((a, b) => a - b);
    return timestamps.map(timestamp => {
        const row: ChartPoint = {timestamp};
        for (const entry of visible) row[entry.key] = interpolate(entry.points, timestamp, maxGap(entry));
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

// Align only values actually returned by the API. Missing measurements stay
// null; a long gap gets an empty row so the chart does not bridge the outage.
export const buildMetricChartData = <K extends string>(
    series: MetricSeries[],
    keys: readonly K[],
    transform: (value: number) => number = value => Number(value.toFixed(2)),
    maxGapMs = Infinity,
): Array<{timestamp: number} & Record<K, number | null>> => {
    type Row = {timestamp: number} & Record<K, number | null>;
    const emptyRow = (timestamp: number): Row => Object.assign({timestamp}, Object.fromEntries(keys.map(key => [key, null]))) as Row;
    const rows = new Map<number, Row>();
    for (const entry of series) {
        if (!keys.includes(entry.name as K)) continue;
        for (const point of entry.data) {
            if (!Number.isFinite(point.timestamp) || !Number.isFinite(point.value)) continue;
            const value = transform(point.value);
            if (!Number.isFinite(value)) continue;
            const row = rows.get(point.timestamp) ?? emptyRow(point.timestamp);
            Object.assign(row, {[entry.name]: value});
            rows.set(point.timestamp, row);
        }
    }
    const sorted = [...rows.values()].sort((a, b) => a.timestamp - b.timestamp);
    const result: Row[] = [];
    for (const row of sorted) {
        const previous = result.at(-1);
        if (previous && row.timestamp - previous.timestamp > maxGapMs) {
            result.push(emptyRow(previous.timestamp + 1));
        }
        result.push(row);
    }
    return result;
};

export const getTemperatureSeries = (series: MetricSeries[]): MonitorSeries[] => series.map(entry => ({
    key: `temperature_${entry.labels?.sensor_key ?? entry.name}`,
    name: entry.name,
    points: normalizePoints(entry.data),
    intervalMs: 15000,
})).sort((a, b) => a.key.localeCompare(b.key));
