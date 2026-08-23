import {useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {AlertTriangle, BarChart3, CheckCircle2, Globe, Loader2, Maximize2, Search, Shield, Zap} from 'lucide-react';
import {pika} from '../api';
import type {MonitorSparklinePoint, PublicMonitor, PublicMonitorSparklinesResponse} from '../types';
import {cn, formatDateTime} from '../lib/utils';
import {Card, CertificateBadge, ErrorState, StatCard, StatusBadge, StatusSummary} from '../components/index';
import {
    canSearchMonitorTarget,
    getCertificateHealth,
    getMonitorHealth,
    getPublicMonitorTarget,
    isMonitorAvailable,
    isMonitorHighLatency,
} from '../domain/monitors/monitor-view-model';
import PublicPageContainer from '../layouts/PublicPageContainer';

/* ========================================== MonitorCard ========================================== */

export type DisplayMode = 'avg' | 'max';

const MiniChart = ({data, displayMode, lastValue, id}: {
    data: MonitorSparklinePoint[];
    displayMode: DisplayMode;
    lastValue?: number;
    id: string;
}) => {
    const chartData = useMemo(() => data
        .map(point => ({timestamp: point.timestamp, value: displayMode === 'avg' ? point.avg : point.max}))
        .sort((a, b) => a.timestamp - b.timestamp), [data, displayMode]);
    if (chartData.length === 0) {
        return <div className="flex h-16 w-full items-center justify-center text-xs text-content-muted">暂无数据</div>;
    }

    const width = 320;
    const height = 64;
    const padding = 4;
    const values = chartData.map(point => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;
    const points = chartData.map((point, index) => ({
        x: chartData.length === 1
            ? width / 2
            : padding + index * ((width - padding * 2) / (chartData.length - 1)),
        y: padding + (maxValue - point.value) / valueRange * (height - padding * 2),
    }));
    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
    const areaPath = `M ${points[0].x.toFixed(2)} ${height - padding} ${linePath.replace(/^M/, 'L')} L ${points[points.length - 1].x.toFixed(2)} ${height - padding} Z`;
    const color = lastValue !== undefined && lastValue <= 200 ? 'var(--theme-chart-1)' : 'var(--theme-warning)';
    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="-mb-2 h-16 w-full overflow-visible"
            role="img"
            aria-label={`最近一小时${displayMode === 'avg' ? '平均' : '最差'}响应时间趋势`}
        >
            <defs>
                <linearGradient id={`colorLatency-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.28}/>
                    <stop offset="100%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#colorLatency-${id})`}/>
            <path d={linePath} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke"/>
            {points.length === 1 && <circle cx={points[0].x} cy={points[0].y} r="2.5" fill={color}/>}
        </svg>
    );
};

const MonitorCard = ({monitor, displayMode, sparkline}: {
    monitor: PublicMonitor;
    displayMode: DisplayMode;
    sparkline: MonitorSparklinePoint[];
}) => {
    const displayValue = displayMode === 'avg' ? monitor.responseTime : monitor.responseTimeMax;
    const displayLabel = displayMode === 'avg' ? '平均延迟' : '最差节点延迟';
    const isAvailable = isMonitorAvailable(monitor);
    const publicTarget = getPublicMonitorTarget(monitor);

    return (
        <Card className="h-full p-5" interactive>
            {/* 头部 */}
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold tracking-wide text-content transition-colors group-hover:text-brand">
                        {monitor.name}
                    </h3>
                    <div className="mb-0.5 truncate font-mono text-xs tracking-wider text-content-secondary/80">
                        {publicTarget}
                    </div>
                </div>
                <div className="shrink-0">
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
                data={sparkline}
                displayMode={displayMode}
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
    down: number;
    unknown: number;
    avgLatency: number;
}

/* ========================================== MonitorList ========================================== */

const MonitorList = () => {
    const [searchKeyword, setSearchKeyword] = useState('');
    const [displayMode, setDisplayMode] = useState<DisplayMode>('max');

    const {data: monitors = [], isLoading, isError, refetch} = useQuery<PublicMonitor[]>({
        queryKey: ['publicMonitors'],
        queryFn: () => pika.listMonitors<PublicMonitor>(),
        refetchInterval: 30000,
    });

    const visibleMonitorKey = useMemo(
        () => monitors.map(monitor => monitor.id).sort().join(':'),
        [monitors],
    );
    const {data: sparklineData} = useQuery<PublicMonitorSparklinesResponse>({
        queryKey: ['publicMonitorSparklines', visibleMonitorKey],
        queryFn: () => pika.getMonitorSparklines<PublicMonitorSparklinesResponse>(),
        enabled: monitors.length > 0,
        refetchInterval: 30000,
        staleTime: 15000,
        retry: 1,
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
        const down = monitors.filter(monitor => monitor.status === 'down').length;
        const unknown = total - online - down;
        const availableMonitors = monitors.filter(isMonitorAvailable);
        const avgLatency = availableMonitors.length > 0
            ? Math.round(availableMonitors.reduce((acc, curr) => acc + curr.responseTime, 0) / availableMonitors.length)
            : 0;
        return {total, online, down, unknown, avgLatency};
    }, [monitors]);

    const publicSignals = useMemo(() => {
        const highLatency = monitors.filter(isMonitorHighLatency).length;
        const certExpiring = monitors.filter(m => getCertificateHealth(m) === 'expiring').length;
        const certExpired = monitors.filter(m => getCertificateHealth(m) === 'expired').length;
        return {highLatency, certExpiring, certExpired};
    }, [monitors]);

    const summaryStatus = useMemo(() => {
        if (stats.total === 0) return 'unknown' as const;
        if (stats.online === 0) return stats.down > 0 ? 'down' as const : 'unknown' as const;
        if (stats.down > 0 || stats.unknown > 0 || publicSignals.highLatency > 0 || publicSignals.certExpiring > 0 || publicSignals.certExpired > 0) {
            return 'degraded' as const;
        }
        return 'healthy' as const;
    }, [publicSignals, stats]);

    if (isLoading) {
        return (
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                <MonitorListSpinner/>
            </div>
        );
    }

    if (isError) {
        return (
            <PublicPageContainer className="py-4 sm:py-8">
                <ErrorState message="服务状态接口暂时不可用，页面不会把请求失败误判为暂无监控数据。" onRetry={() => void refetch()}/>
            </PublicPageContainer>
        );
    }

    return (
        <PublicPageContainer className="space-y-4 py-4 sm:space-y-6 sm:py-8">
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
                    label="不可用服务"
                    value={stats.down}
                    icon={AlertTriangle}
                    tone={stats.down > 0 ? 'danger' : stats.unknown > 0 ? 'warning' : 'neutral'}
                />
                <StatCard
                    label="全局平均延迟"
                    value={stats.online > 0 ? stats.avgLatency : '—'}
                    unit={stats.online > 0 ? 'ms' : undefined}
                    icon={Zap}
                    tone="accent"
                />
            </div>

            <StatusSummary
                title="公开服务状态"
                current={stats.online}
                total={stats.total}
                currentLabel="项服务当前可用"
                status={summaryStatus}
                signals={[
                    stats.total === 0 && {label: '暂无服务状态数据', status: 'unknown'},
                    stats.down > 0 && {label: `${stats.down} 项明确不可用`, status: 'down'},
                    stats.unknown > 0 && {label: `${stats.unknown} 项状态未知`, status: 'unknown'},
                    publicSignals.highLatency > 0 && {label: `${publicSignals.highLatency} 项响应较慢`, status: 'degraded'},
                    publicSignals.certExpiring > 0 && {label: `${publicSignals.certExpiring} 张证书即将到期`, status: 'degraded'},
                    publicSignals.certExpired > 0 && {label: `${publicSignals.certExpired} 张证书已过期`, status: 'down'},
                    stats.total > 0 && stats.down === 0 && stats.unknown === 0 && publicSignals.highLatency === 0 && publicSignals.certExpiring === 0 && publicSignals.certExpired === 0 && {label: '当前服务运行平稳', status: 'healthy'},
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
                            type="button"
                            onClick={() => setDisplayMode('avg')}
                            aria-pressed={displayMode === 'avg'}
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
                            type="button"
                            onClick={() => setDisplayMode('max')}
                            aria-pressed={displayMode === 'max'}
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
                        <label htmlFor="monitor-search" className="sr-only">搜索服务名称或公开地址</label>
                        <input
                            id="monitor-search"
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
                        <Link key={monitor.id} to={`/monitors/${monitor.id}`} className="block h-full">
                            <MonitorCard
                                monitor={monitor}
                                displayMode={displayMode}
                                sparkline={sparklineData?.items[monitor.id] ?? []}
                            />
                        </Link>
                    ))}
                </div>
            )}
        </PublicPageContainer>
    );
};

export default MonitorList;
