import {useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {AlertTriangle, BarChart3, CheckCircle2, Globe, Loader2, Maximize2, Search, Shield, Zap} from 'lucide-react';
import {Area, AreaChart, ResponsiveContainer} from 'recharts';
import {pika} from '../api';
import type {MetricsResponse, PublicMonitor} from '../types';
import {cn, formatDateTime} from '../lib/utils';
import {Card, CertificateBadge, MonitorTypeIcon, StatCard, StatusBadge, StatusSummary} from '../components/index';
import {
    canSearchMonitorTarget,
    getCertificateHealth,
    getMonitorHealth,
    getPublicMonitorTarget,
    isMonitorAvailable,
    isMonitorHighLatency,
} from '../domain/monitors/monitor-view-model';

/* ========================================== MonitorCard ========================================== */

export type DisplayMode = 'avg' | 'max';

const MiniChart = ({data, lastValue, id}: {
    data: Array<{timestamp: number; value: number}>;
    lastValue?: number;
    id: string;
}) => {
    const chartData = useMemo(() => [...data].sort((a, b) => a.timestamp - b.timestamp), [data]);
    if (chartData.length === 0) {
        return <div className="flex h-16 w-full items-center justify-center text-xs text-content-muted">暂无数据</div>;
    }

    const color = lastValue !== undefined && lastValue <= 200 ? 'var(--theme-chart-1)' : 'var(--theme-warning)';
    return (
        <div className="-mb-2 h-16 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id={`colorLatency-${id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.3}/>
                            <stop offset="100%" stopColor={color} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        fill={`url(#colorLatency-${id})`}
                        strokeWidth={2}
                        isAnimationActive={false}
                        connectNulls
                        dot={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

const MonitorCard = ({monitor, displayMode}: {
    monitor: PublicMonitor;
    displayMode: DisplayMode;
}) => {
    // 为每个监控卡片查询历史数据
    const {data: historyData} = useQuery<MetricsResponse>({
        queryKey: ['monitorHistory', monitor.id, '12h'], // 对应后端 60 秒步长
        queryFn: async () => {
            return pika.getMonitorHistory(monitor.id, {range: '1h'});
        },
        refetchInterval: 60000,
        staleTime: 30000,
        enabled: isMonitorAvailable(monitor),
    });

    // 转换时序数据为图表数据 - 使用统一格点对该对齐多探针数据
    const chartData = useMemo(() => {
        if (!historyData?.series || historyData.series.length === 0) {
            return [];
        }

        const validSeries = historyData.series.filter(s => s.data && s.data.length > 0);
        if (validSeries.length === 0) return [];

        // 确定全局时间范围
        let minTime = Infinity, maxTime = -Infinity;
        validSeries.forEach(s => {
            minTime = Math.min(minTime, s.data![0].timestamp);
            maxTime = Math.max(maxTime, s.data![s.data!.length - 1].timestamp);
        });

        if (minTime >= maxTime) return [];

        // 定义目标采集点 (1小时数据，建议 60 个采集点)
        const maxPoints = 60;
        const timeStep = (maxTime - minTime) / (maxPoints - 1);
        const targetTimestamps: number[] = [];
        for (let i = 0; i < maxPoints; i++) {
            targetTimestamps.push(minTime + i * timeStep);
        }

        // 线性插值函数
        const interpolate = (data: Array<{ timestamp: number; value: number }>, targetTime: number): number | null => {
            if (data.length === 0) return null;
            if (data.length === 1) return data[0].timestamp === targetTime ? data[0].value : null;
            if (targetTime < data[0].timestamp || targetTime > data[data.length - 1].timestamp) return null;

            let left = 0, right = data.length - 1;
            while (right - left > 1) {
                const mid = Math.floor((left + right) / 2);
                if (data[mid].timestamp <= targetTime) left = mid;
                else right = mid;
            }
            const leftPoint = data[left];
            const rightPoint = data[right];
            const ratio = (targetTime - leftPoint.timestamp) / (rightPoint.timestamp - leftPoint.timestamp);
            return leftPoint.value + ratio * (rightPoint.value - leftPoint.value);
        };

        // 对每个目标时间点，计算所有探针的聚合值
        return targetTimestamps.map(timestamp => {
            const values: number[] = [];
            validSeries.forEach(s => {
                const val = interpolate(s.data!, timestamp);
                if (val !== null) values.push(val);
            });

            if (values.length === 0) return { timestamp, value: 0 };

            return {
                timestamp,
                value: displayMode === 'avg'
                    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
                    : Math.max(...values),
            };
        });
    }, [historyData, displayMode]);

    const displayValue = displayMode === 'avg' ? monitor.responseTime : monitor.responseTimeMax;
    const displayLabel = displayMode === 'avg' ? '平均延迟' : '最差节点延迟';
    const isAvailable = isMonitorAvailable(monitor);
    const publicTarget = getPublicMonitorTarget(monitor);

    return (
        <Card className={'p-5'} interactive>
            {/* 头部 */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3 flex-1 min-w-0">
                    <div
                        className="flex-shrink-0 rounded-control border border-line bg-panel-muted p-2.5">
                        <MonitorTypeIcon type={monitor.type}/>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="truncate text-sm font-bold tracking-wide text-content transition-colors group-hover:text-brand">
                            {monitor.name}
                        </h3>
                        <div className="text-xs font-mono text-content-secondary/80 mb-0.5 tracking-wider truncate">
                            {publicTarget}
                        </div>
                    </div>
                </div>
                <div className="flex-shrink-0 ml-2">
                    <StatusBadge status={getMonitorHealth(monitor)}/>
                </div>
            </div>

            {isAvailable ? <>
            {/* 指标信息 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p className="text-xs text-content-secondary mb-1 flex items-center gap-1">
                        {displayLabel}
                        {monitor.agentCount > 0 && (
                            <span
                                className="rounded-full bg-panel-muted px-1.5 text-xs text-content-secondary">
                                    {monitor.agentCount} 节点
                                </span>
                        )}
                    </p>
                    <div className={cn(
                        'flex items-baseline gap-1 text-xl font-bold',
                        displayValue > 200
                            ? 'text-warning'
                            : 'text-content',
                    )}>
                        {displayValue}<span className="text-xs text-content-secondary font-normal">ms</span>
                    </div>
                </div>
                <div>
                    {monitor.type === 'https' && monitor.certExpiryTime ? (
                        <>
                            <p className="text-xs text-content-secondary mb-1">SSL 证书</p>
                            <CertificateBadge
                                expiryTime={monitor.certExpiryTime}
                                daysLeft={monitor.certDaysLeft}
                            />
                        </>
                    ) : (
                        <>
                            <p className="text-xs text-content-secondary mb-1">上次检测</p>
                            <p className="md:text-sm text-xs text-content-secondary font-mono">
                                {formatDateTime(monitor.lastCheckTime)}
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* 迷你走势图 */}
            <MiniChart
                data={chartData}
                lastValue={displayValue}
                id={monitor.id}
            />
            </> : (
                <div className="flex items-center gap-2 border-t border-line pt-4 text-xs text-danger">
                    <AlertTriangle className="h-4 w-4 shrink-0"/>
                    <span>服务当前不可用，已隐藏可能过期的延迟与趋势数据。</span>
                </div>
            )}
        </Card>
    );
};

/* ========================================== MonitorList 本地组件 ========================================== */

const MonitorListSpinner = () => (
    <div className="flex min-h-[400px] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-content-secondary">
            <Loader2 className="h-8 w-8 animate-spin text-content-secondary"/>
            <span className="text-sm font-mono">加载监控数据中...</span>
        </div>
    </div>
);

const MonitorListEmpty = () => (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-content-secondary">
        <Shield className="mb-4 h-16 w-16 opacity-20"/>
        <p className="text-lg font-medium font-mono">暂无监控数据</p>
        <p className="mt-2 text-sm text-content-secondary">请先在管理后台添加监控任务</p>
    </div>
);


interface Stats {
    total: number;
    online: number;
    issues: number;
    avgLatency: number;
}

/* ========================================== MonitorList ========================================== */

const MonitorList = () => {
    const [searchKeyword, setSearchKeyword] = useState('');
    const [displayMode, setDisplayMode] = useState<DisplayMode>('max');

    const {data: monitors = [], isLoading} = useQuery<PublicMonitor[]>({
        queryKey: ['publicMonitors'],
        queryFn: () => pika.listMonitors<PublicMonitor>(),
        refetchInterval: 30000,
    });

    // 过滤和搜索
    const filteredMonitors = useMemo(() => {
        let result = [...monitors];

        // 搜索过滤
        if (searchKeyword.trim()) {
            const keyword = searchKeyword.toLowerCase();
            result = result.filter(m =>
                m.name.toLowerCase().includes(keyword) ||
                canSearchMonitorTarget(m, keyword)
            );
        }

        return result.sort((a, b) => Number(a.status !== 'up') - Number(b.status !== 'up'));
    }, [monitors, searchKeyword]);

    // 公开页只对当前正常服务计算平均延迟，避免旧值被误读为实时质量。
    const stats = useMemo<Stats>(() => {
        const total = monitors.length;
        const online = monitors.filter(isMonitorAvailable).length;
        const issues = total - online;
        const availableMonitors = monitors.filter(isMonitorAvailable);
        const avgLatency = availableMonitors.length > 0
            ? Math.round(availableMonitors.reduce((acc, curr) => acc + curr.responseTime, 0) / availableMonitors.length)
            : 0;
        return {total, online, issues, avgLatency};
    }, [monitors]);

    const publicSignals = useMemo(() => {
        const highLatency = monitors.filter(isMonitorHighLatency).length;
        const certExpiring = monitors.filter(m => getCertificateHealth(m) === 'expiring').length;
        const certExpired = monitors.filter(m => getCertificateHealth(m) === 'expired').length;
        return {highLatency, certExpiring, certExpired};
    }, [monitors]);

    if (isLoading) {
        return (
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                <MonitorListSpinner/>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
            {/* 统计卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                <StatCard
                    label="监控服务总数"
                    value={stats.total}
                    icon={Globe}
                    tone="accent"
                />
                <StatCard
                    label="系统正常"
                    value={stats.online}
                    icon={CheckCircle2}
                    tone="success"
                />
                <StatCard
                    label="异常服务"
                    value={stats.issues}
                    icon={AlertTriangle}
                    tone={stats.issues > 0 ? 'danger' : 'neutral'}
                />
                <StatCard
                    label="全局平均延迟"
                    value={stats.avgLatency}
                    unit="ms"
                    icon={Zap}
                    tone="accent"
                />
            </div>

            <StatusSummary
                title="公开服务状态"
                current={stats.online}
                total={stats.total}
                currentLabel="项服务当前可用"
                status={stats.issues > 0 ? 'degraded' : 'healthy'}
                signals={[
                    stats.issues > 0 && {label: `${stats.issues} 项暂不可用`, status: 'down'},
                    publicSignals.highLatency > 0 && {label: `${publicSignals.highLatency} 项响应较慢`, status: 'degraded'},
                    publicSignals.certExpiring > 0 && {label: `${publicSignals.certExpiring} 张证书即将到期`, status: 'degraded'},
                    publicSignals.certExpired > 0 && {label: `${publicSignals.certExpired} 张证书已过期`, status: 'down'},
                    stats.issues === 0 && publicSignals.highLatency === 0 && publicSignals.certExpiring === 0 && publicSignals.certExpired === 0 && {label: '当前服务运行平稳', status: 'healthy'},
                ]}
                refreshLabel="状态每 30 秒刷新"
            />

            {/* 过滤和搜索 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
                    {/* 显示模式切换 */}
                    <div className="flex items-center gap-1 rounded-control border border-line bg-panel-muted p-1">
                        <span className="text-xs text-content-secondary px-2 font-mono">卡片指标:</span>
                        <button
                            onClick={() => setDisplayMode('avg')}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded transition-all flex items-center gap-1 font-mono cursor-pointer",
                                displayMode === 'avg'
                                    ? 'border border-brand/30 bg-brand-muted text-brand'
                                    : 'text-content-secondary hover:text-content'
                            )}
                        >
                            <BarChart3 className="w-3 h-3"/> 平均
                        </button>
                        <button
                            onClick={() => setDisplayMode('max')}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded transition-all flex items-center gap-1 font-mono cursor-pointer",
                                displayMode === 'max'
                                    ? 'border border-brand/30 bg-brand-muted text-brand'
                                    : 'text-content-secondary hover:text-content'
                            )}
                        >
                            <Maximize2 className="w-3 h-3"/> 最差(Max)
                        </button>
                    </div>
                </div>

                {/* 搜索框 */}
                <div className="relative w-full md:w-64">
                    <div className="relative flex items-center rounded-control border border-line bg-panel focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                        <Search className="ml-3 h-4 w-4 text-content-muted"/>
                        <input
                            type="text"
                            placeholder="搜索服务名称或地址..."
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            className="w-full border-none bg-transparent p-2.5 text-xs text-content placeholder:text-content-muted focus:outline-none focus:ring-0"
                        />
                    </div>
                </div>
            </div>

            {/* 监控卡片列表 */}
            {filteredMonitors.length === 0 ? (
                <MonitorListEmpty/>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 md:gap-4 gap-2">
                    {filteredMonitors.map(monitor => (
                        <Link key={monitor.id} to={`/monitors/${monitor.id}`}>
                            <MonitorCard
                                monitor={monitor}
                                displayMode={displayMode}
                            />
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MonitorList;
