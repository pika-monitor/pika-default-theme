import {memo, type ReactNode, useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {
    Activity,
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Cpu,
    HardDrive,
    MemoryStick,
    Network,
    RotateCcw,
    Thermometer,
    Zap
} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import type {Agent, LatestMetrics, MetricsResponse} from '../types';
import {PikaAPIError} from '../api';
import {
    INTERFACE_COLORS,
    LIVE_RANGE,
    LIVE_WINDOW_MS,
    LIVE_MONITOR_WINDOW_MS,
    METRIC_INTERVALS,
    POLLING_INTERVALS,
    SERVER_TIME_RANGE_OPTIONS,
    TEMPERATURE_COLORS,
} from '../constants';
import {
    cn,
    formatBytes,
    formatTraffic,
    formatChartTime,
    formatDateTime,
    formatPercentValue,
    formatUptime,
} from '../lib/utils';
import {
    useAgentQuery,
    useLatestMetricsQuery,
    useTrendMetricsQuery,
    useLiveMetricsQuery,
    useIsMobile,
    useNetworkInterfacesQuery,
} from '../hooks';
import {
    AgentExpiryBadge,
    AgentOfflineState,
    Card,
    ChartPlaceholder,
    CustomTooltip,
    EmptyState,
    ErrorState,
    LoadingSpinner,
    MetricItem,
    StatusBadge,
    TimeRangeSelector
} from '../components/index';
import {isAgentOnline} from '../domain/agents/agent-view-model';
import {buildMetricChartData, getGpuSeries, getMonitorSeries, buildMonitorChartData, reconcileMonitorSelection, getTemperatureSeries} from '../domain/agents/server-chart-view-model';
import PublicPageContainer from '../layouts/PublicPageContainer';

/* ========================================== 共享工具 ========================================== */

const toMB = (bytes: number) => Number((bytes / 1024 / 1024).toFixed(2));

/* ========================================== ChartContainer ========================================== */

interface ChartContainerProps {
    title: string;
    icon: LucideIcon;
    children: ReactNode;
    action?: ReactNode;
    status?: ReactNode;
}

const ChartContainer = ({title, icon: Icon, children, action, status}: ChartContainerProps) => {
    return (
        <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex shrink-0 items-center gap-2 text-sm font-semibold text-content-secondary">
          <span className="flex h-8 w-8 items-center justify-center rounded-control bg-brand-muted text-brand">
            <Icon className="h-4 w-4"/>
          </span>
                    {title}
                </h3>
                <div className="flex flex-wrap items-center justify-end gap-3">{status}{action}</div>
            </div>
            {children}
        </section>
    );
};

const ChartQueryError = ({title, icon}: {title: string; icon: LucideIcon}) => (
    <ChartContainer title={title} icon={icon}>
        <ChartPlaceholder title="数据加载失败" subtitle="无法获取该指标，请稍后重试"/>
    </ChartContainer>
);

const TrendStatus = ({data, failed, isLive, now, intervalMs = 2000}: {data?: MetricsResponse; failed: boolean; isLive?: boolean; now?: number; intervalMs?: number}) => {
    if (failed) return <span className="text-xs text-warning">刷新失败，保留上次数据</span>;
    if (!isLive) return data?.failedSeries?.length ? <span className="text-xs text-warning">部分系列加载失败</span> : null;
    const timestamp = data?.latestSampleAt;
    const stale = !!timestamp && (now ?? Date.now()) - timestamp > Math.max(intervalMs * 3, 10000);
    return <span className={cn('text-xs tabular-nums', failed || stale || data?.historyError ? 'text-warning' : 'text-content-muted')}>
        {failed ? '刷新失败，保留上次数据' : data?.historyError ? data.historyError : timestamp ? `${stale ? '数据延迟 · ' : ''}最新采样 ${formatChartTime(timestamp, LIVE_RANGE)}` : '暂无采样'}
    </span>;
};

const trendDomain = (isLive: boolean | undefined, now: number | undefined, data: MetricsResponse | undefined, windowMs = LIVE_WINDOW_MS): [number | string, number | string] => {
    const end = now ?? data?.end ?? Date.now();
    return isLive ? [end - windowMs, end] : ['dataMin', 'dataMax'];
};

const trendTicks = (isLive: boolean | undefined, now: number | undefined, data: MetricsResponse | undefined, windowMs = LIVE_WINDOW_MS): number[] | undefined => {
    if (!isLive) return undefined;
    const end = now ?? data?.end ?? Date.now();
    const step = windowMs === LIVE_MONITOR_WINDOW_MS ? 180000 : 60000;
    const ticks: number[] = [];
    for (let tick = Math.ceil((end - windowMs) / step) * step; tick <= end; tick += step) ticks.push(tick);
    return ticks;
};

/* ========================================== ServerHero ========================================== */

interface ServerHeroProps {
    agent: Agent;
    latestMetrics: LatestMetrics | null;
    onBack: () => void;
}

const ServerHero = ({agent, latestMetrics, onBack}: ServerHeroProps) => {
    const displayName = agent?.name?.trim() ? agent.name : '未命名探针';
    const isOnline = isAgentOnline(agent);

    const platformDisplay = latestMetrics?.host?.platform
        ? `${latestMetrics.host.platform} ${latestMetrics.host.platformVersion || ''}`.trim()
        : agent?.os || '-';
    const architectureDisplay = latestMetrics?.host?.kernelArch || agent?.arch || '-';
    const uptimeDisplay = formatUptime(latestMetrics?.host?.uptime);
    const lastSeenDisplay = agent ? formatDateTime(agent.lastSeenAt) : '-';

    const networkSummary = latestMetrics?.network
        ? `${formatBytes(latestMetrics.network.totalBytesSentTotal)} ↑ / ${formatBytes(
            latestMetrics.network.totalBytesRecvTotal,
        )} ↓`
        : '—';

    const heroStats = [
        {label: '运行系统', value: platformDisplay || '-'},
        {label: '硬件架构', value: architectureDisplay || '-'},
        {label: '系统进程', value: latestMetrics?.host?.procs || '-'},
        {label: '运行时长', value: uptimeDisplay},
    ];

    return (
        <Card className={'p-6'}>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-4">
                        <button
                            type="button"
                            onClick={onBack}
                            className="group inline-flex items-center gap-2 text-sm font-medium text-content-secondary transition hover:text-brand"
                        >
                            <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5"/>
                            返回概览
                        </button>
                        <div className="flex items-start gap-4">
                            <div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <h1 className="text-3xl font-bold text-content">{displayName}</h1>
                                    {isOnline && <StatusBadge status="healthy"/>}
                                </div>
                                <p className="mt-2 text-sm text-content-secondary tabular-nums">
                                    {[agent.hostname].filter(Boolean).join(' · ') || '-'}
                                </p>
                                {(!isOnline || agent.expireTime > 0) && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        {!isOnline && <AgentOfflineState/>}
                                        <AgentExpiryBadge expireTime={agent.expireTime}/>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full lg:w-auto lg:min-w-[480px]">
                        {heroStats.map((stat) => (
                            <MetricItem key={stat.label} label={stat.label} value={stat.value}/>
                        ))}
                    </div>
                </div>
                <div
                    className="flex flex-wrap items-center gap-3 border-t border-line pt-4 tabular-nums text-xs text-content-secondary">
                    <span>探针 ID：{agent.id}</span>
                    <span className="hidden h-1 w-1 rounded-full bg-line-strong sm:inline-block"/>
                    <span>版本：{agent.version || '-'}</span>
                    <span className="hidden h-1 w-1 rounded-full bg-line-strong sm:inline-block"/>
                    <span>网络累计：{networkSummary}</span>
                </div>
            </div>
        </Card>
    );
};

/* ========================================== SystemInfoSection ========================================== */

interface SystemInfoSectionProps {
    agent: Agent;
    latestMetrics: LatestMetrics | null;
}

const InfoGrid = ({items}: {items: Array<{label: string; value: ReactNode}>}) => (
    <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        {items.map((item) => (
            <div key={item.label}>
                <dt className="text-xs font-medium text-content-secondary">{item.label}</dt>
                <dd className="mt-1 font-medium text-content">{item.value}</dd>
            </div>
        ))}
    </dl>
);

type SnapshotCardData = {
    key: string;
    icon: LucideIcon;
    title: string;
    usagePercent: string;
    accent: 'blue' | 'emerald' | 'purple' | 'amber';
    metrics: Array<{label: string; value: ReactNode}>;
};

const snapshotColors = {
    blue: 'text-chart-1',
    emerald: 'text-chart-2',
    purple: 'text-chart-4',
    amber: 'text-warning',
};

const SnapshotGrid = ({cards}: {cards: SnapshotCardData[]}) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
            <div
                key={card.key}
                className="rounded-card border border-line bg-panel-muted p-4 transition-colors hover:border-line-strong"
            >
                <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <span className={cn('flex h-9 w-9 items-center justify-center rounded-control bg-brand-muted', snapshotColors[card.accent])}>
                            <card.icon className="h-4 w-4"/>
                        </span>
                        <p className="text-xs font-medium text-content-secondary">{card.title}</p>
                    </div>
                    <span className={cn('text-xl font-bold', snapshotColors[card.accent])}>{card.usagePercent}</span>
                </div>
                <div className="space-y-2">
                    {card.metrics.map((metric) => (
                        <div key={metric.label} className="flex items-center justify-between text-xs">
                            <span className="text-content-secondary">{metric.label}</span>
                            <span className="ml-2 text-right font-medium text-content">{metric.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);

const SystemInfoSection = ({agent, latestMetrics}: SystemInfoSectionProps) => {
    // 环境信息
    const platformDisplay = latestMetrics?.host?.platform
        ? `${latestMetrics.host.platform} ${latestMetrics.host.platformVersion || ''}`.trim()
        : agent?.os || '-';
    const architectureDisplay = latestMetrics?.host?.kernelArch || agent?.arch || '-';

    const environmentInfo = [
        {label: '操作系统', value: platformDisplay || '-'},
        {label: '内核版本', value: latestMetrics?.host?.kernelVersion || '-'},
        {label: '硬件架构', value: architectureDisplay || '-'},
        {label: 'CPU 型号', value: latestMetrics?.cpu?.modelName || '-'},
        {label: '逻辑核心', value: latestMetrics?.cpu?.logicalCores ?? '-'},
        {label: '物理核心', value: latestMetrics?.cpu?.physicalCores ?? '-'},
    ];

    // 状态信息
    const uptimeDisplay = formatUptime(latestMetrics?.host?.uptime);
    const bootTimeDisplay = latestMetrics?.host?.bootTime
        ? formatDateTime(latestMetrics.host.bootTime * 1000)
        : '-';
    const lastSeenDisplay = agent ? formatDateTime(agent.lastSeenAt) : '-';

    const networkSummary = latestMetrics?.network
        ? `${formatBytes(latestMetrics.network.totalBytesSentTotal)} ↑ / ${formatBytes(
            latestMetrics.network.totalBytesRecvTotal,
        )} ↓`
        : '—';

    const statusInfo = [
        {label: '启动时间', value: bootTimeDisplay},
        {label: '运行时间', value: uptimeDisplay},
        {label: '最近心跳', value: lastSeenDisplay},
        {label: '进程数', value: latestMetrics?.host?.procs ?? '-'},
        {label: '网络累计', value: networkSummary},
        {label: 'Load', value: `${latestMetrics?.host?.load1?.toFixed(2)} / ${latestMetrics?.host?.load5?.toFixed(2)} / ${latestMetrics?.host?.load15?.toFixed(2)}`},
    ];

    // 快照卡片
    const snapshotCards: SnapshotCardData[] = [];

    if (latestMetrics) {
        snapshotCards.push({
            key: 'cpu',
            icon: Cpu,
            title: 'CPU 使用',
            usagePercent: `${formatPercentValue(latestMetrics.cpu?.usagePercent)}%`,
            accent: 'blue',
            metrics: [
                {label: '当前使用', value: `${formatPercentValue(latestMetrics.cpu?.usagePercent)}%`},
            ],
        });

        snapshotCards.push({
            key: 'memory',
            icon: MemoryStick,
            title: '内存使用',
            usagePercent: `${formatPercentValue(latestMetrics.memory?.usagePercent)}%`,
            accent: 'emerald',
            metrics: [
                {
                    label: '已用 / 总量',
                    value: `${formatBytes(latestMetrics.memory?.used, 2, 1024)} / ${formatBytes(latestMetrics.memory?.total, 2, 1024)}`
                },
                {
                    label: 'Swap 已用',
                    value: `${formatBytes(latestMetrics.memory?.swapUsed, 2, 1024)} / ${formatBytes(latestMetrics.memory?.swapTotal, 2, 1024)}`
                },
            ],
        });

        snapshotCards.push({
            key: 'disk',
            icon: HardDrive,
            title: '磁盘使用',
            usagePercent: latestMetrics.disk
                ? `${formatPercentValue(latestMetrics.disk.usagePercent)}%`
                : '—',
            accent: 'purple',
            metrics: [
                {
                    label: '已用 / 总量',
                    value: `${formatBytes(latestMetrics.disk?.used, 1)} / ${formatBytes(latestMetrics.disk?.total, 1)}`
                },
                {label: '磁盘数量', value: latestMetrics.disk?.totalDisks ?? '-'},
            ],
        });

        // 网络流量卡片 - 整合流量统计信息
        const networkMetrics = [
            {
                label: '上行 / 下行',
                value: `${formatBytes(latestMetrics.network?.totalBytesSentRate, 1)}/s ↑ / ${formatBytes(
                    latestMetrics.network?.totalBytesRecvRate, 1,
                )}/s ↓`,
            },
            {
                label: '网络累计',
                value: `${formatBytes(latestMetrics.network?.totalBytesSentTotal, 1)} ↑ / ${formatBytes(
                    latestMetrics.network?.totalBytesRecvTotal, 1,
                )} ↓`,
            },
        ];

        // 如果配置了流量限额，添加流量统计信息到网络卡片
        if (agent?.trafficStats?.enabled && agent.trafficStats.limit > 0) {
            const trafficUsedPercent = (agent.trafficStats.used / agent.trafficStats.limit) * 100;

            networkMetrics.push({
                label: '流量限额',
                value: `${formatTraffic(agent.trafficStats.used)} / ${formatTraffic(agent.trafficStats.limit)} (${formatPercentValue(trafficUsedPercent)}%)`,
            });

            if (agent.trafficStats.resetDay > 0) {
                networkMetrics.push({
                    label: '重置日期',
                    value: `每月${agent.trafficStats.resetDay}号`,
                });
            }
        }

        snapshotCards.push({
            key: 'network',
            icon: Network,
            title: '网络流量',
            usagePercent: latestMetrics.network
                ? `${formatBytes(latestMetrics.network.totalBytesSentRate)}/s`
                : '—',
            accent: 'amber',
            metrics: networkMetrics,
        });
    }

    return (
        <div>
            <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Card title="运行环境">
                        <InfoGrid items={environmentInfo}/>
                    </Card>
                    <Card title="运行状态">
                        <InfoGrid items={statusInfo}/>
                    </Card>
                </div>
                {snapshotCards.length > 0 && (
                    <Card title="资源快照">
                        <SnapshotGrid cards={snapshotCards}/>
                    </Card>
                )}
            </div>
        </div>
    );
};

/* ========================================== ServerDetailSections ========================================== */

const NetworkAddressSection = ({ipv4, ipv6, deviceIpInterfaces}: {
    ipv4?: string;
    ipv6?: string;
    deviceIpInterfaces: Array<{name: string; addrs: string[]}>;
}) => {
    if (!ipv4 && !ipv6 && deviceIpInterfaces.length === 0) return null;

    return (
        <Card title="网络地址">
            <div className="space-y-6">
                {(ipv4 || ipv6) && (
                    <div className="space-y-3">
                        <div className="text-sm font-medium text-content-secondary">公网地址</div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {[["IPv4", ipv4], ["IPv6", ipv6]].map(([label, value]) => (
                                <div key={label} className="space-y-2">
                                    <div className="text-xs font-medium text-content-secondary">{label}</div>
                                    <div className="font-mono text-sm text-content">{value || '-'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {(ipv4 || ipv6) && deviceIpInterfaces.length > 0 && <div className="border-t border-line"/>}

                {deviceIpInterfaces.length > 0 && (
                    <div className="space-y-3">
                        <div className="text-sm font-medium text-content-secondary">网卡地址</div>
                        <div className="space-y-4">
                            {deviceIpInterfaces.map((networkInterface) => (
                                <div key={networkInterface.name} className="space-y-2">
                                    <div className="text-xs font-medium text-content-secondary">{networkInterface.name}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {networkInterface.addrs.map((address) => (
                                            <span key={address} className="rounded-sm border border-line bg-panel-muted px-2 py-0.5 text-xs font-mono text-content">
                                                {address}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
};

const NetworkConnectionSection = ({latestMetrics}: {latestMetrics: LatestMetrics | null}) => {
    const metrics = latestMetrics?.networkConnection;
    if (!metrics) return null;
    const items = [
        {label: 'Total', value: metrics.total, color: 'text-content'},
        {label: 'ESTABLISHED', value: metrics.established, color: 'text-success'},
        {label: 'TIME_WAIT', value: metrics.timeWait, color: 'text-warning'},
        {label: 'LISTEN', value: metrics.listen, color: 'text-brand'},
        {label: 'CLOSE_WAIT', value: metrics.closeWait, color: 'text-danger'},
        {
            label: 'OTHER',
            value: metrics.synSent + metrics.synRecv + metrics.finWait1 + metrics.finWait2 + metrics.close + metrics.lastAck + metrics.closing,
            color: 'text-content-secondary',
        },
    ];

    return (
        <Card title="网络连接统计">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {items.map((item) => (
                    <div key={item.label} className="text-center">
                        <div className="text-xs font-medium text-content-secondary">{item.label}</div>
                        <div className={`mt-1 text-lg font-semibold ${item.color}`}>{item.value}</div>
                    </div>
                ))}
            </div>
        </Card>
    );
};

const GpuMonitorSection = ({latestMetrics}: {latestMetrics: LatestMetrics | null}) => {
    if (!latestMetrics?.gpu?.length) return null;

    return (
        <Card title="GPU 监控">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {latestMetrics.gpu.map((gpu) => (
                    <div key={gpu.index} className="rounded-card border border-line bg-panel-muted p-4 transition-colors hover:border-line-strong">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-muted text-brand"><Zap className="h-4 w-4"/></span>
                                <div>
                                    <p className="tabular-nums text-sm font-bold text-content">GPU {gpu.index}</p>
                                    <p className="text-xs text-content-secondary">{gpu.name}</p>
                                </div>
                            </div>
                            <span className="text-2xl font-bold text-chart-4">{gpu.utilization?.toFixed(1) ?? 0}%</span>
                        </div>
                        <div className="space-y-2 text-xs">
                            {[
                                ['温度', `${gpu.temperature?.toFixed(1)}°C`],
                                ['显存', `${formatBytes(gpu.memoryUsed, 2, 1024)} / ${formatBytes(gpu.memoryTotal, 2, 1024)}`],
                                ['功耗', `${gpu.powerUsage?.toFixed(1)}W`],
                                ['风扇转速', `${gpu.fanSpeed?.toFixed(0)}%`],
                            ].map(([label, value]) => (
                                <div key={label} className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-content-secondary">{label}</span>
                                    <span className="font-medium text-content">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};

const TemperatureMonitorSection = ({latestMetrics}: {latestMetrics: LatestMetrics | null}) => {
    if (!latestMetrics?.temperature?.length) return null;

    return (
        <Card title="温度监控">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {[...latestMetrics.temperature].sort((a, b) => a.sensorKey.localeCompare(b.sensorKey)).map((temperature) => (
                    <div key={temperature.sensorKey} className="rounded-card border border-line bg-panel-muted p-4 transition-colors hover:border-line-strong">
                        <div className="mb-2 flex items-center gap-2">
                            <Thermometer className="h-4 w-4 text-content-secondary"/>
                            <p className="truncate text-xs font-medium text-content-secondary">{temperature.type}</p>
                        </div>
                        <p className="text-2xl font-bold text-warning">{temperature.temperature.toFixed(1)}°C</p>
                    </div>
                ))}
            </div>
        </Card>
    );
};

/* ========================================== CpuChart ========================================== */

interface ChartPropsBase {
    agentId: string;
    timeRange: string;
    start?: number;
    end?: number;
    isLive?: boolean;
    now?: number;
    liveEnabled?: boolean;
}

interface CpuChartProps extends ChartPropsBase {
}

const CpuChart = ({agentId, timeRange, start, end, isLive, now, liveEnabled}: CpuChartProps) => {
    const rangeMs = start !== undefined && end !== undefined ? end - start : undefined;
    // 数据查询
    const {data: metricsResponse, isLoading, isError} = useTrendMetricsQuery({
        agentId,
        type: 'cpu',
        timeRange,
        liveEnabled,
        start,
        end,
    });

    // 完整时序窗口
    const chartData = useMemo(() => buildMetricChartData(
        metricsResponse?.series ?? [], ['usage'], undefined, isLive ? 6000 : Infinity,
    ), [metricsResponse, isLive]);

    // 渲染
    if (isLoading) {
        return (
            <ChartContainer title="CPU 使用率" icon={Cpu} status={<TrendStatus data={metricsResponse} failed={isError} isLive={isLive} now={now}/>}>
                <ChartPlaceholder/>
            </ChartContainer>
        );
    }

    if (isError && !metricsResponse) return <ChartQueryError title="CPU 使用率" icon={Cpu}/>;

    return (
        <ChartContainer title="CPU 使用率" icon={Cpu} status={<TrendStatus data={metricsResponse} failed={isError} isLive={isLive} now={now}/>}>
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="cpuAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--theme-chart-1)" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="var(--theme-chart-1)" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="currentColor" strokeDasharray="4 4" className="stroke-line"/>
                        <XAxis
                            dataKey="timestamp"
                            type="number"
                            scale="time"
                            domain={trendDomain(isLive, now, metricsResponse)} ticks={trendTicks(isLive, now, metricsResponse)}
                            allowDataOverflow
                            tickFormatter={(value) => formatChartTime(Number(value), timeRange, rangeMs)}
                            stroke="currentColor"
                            minTickGap={24}
                            textAnchor="middle"
                            className="text-xs text-content-secondary tabular-nums"
                        />
                        <YAxis
                            domain={[0, 100]}
                            stroke="currentColor"
                            className="stroke-content-muted text-xs"
                            tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip content={<CustomTooltip unit="%" timeFormat={isLive ? 'HH:mm:ss' : undefined}/>}/>
                        <Area
                            type={isLive ? "linear" : "monotone"}
                            dataKey="usage"
                            name="CPU 使用率"
                            stroke="var(--theme-chart-1)"
                            strokeWidth={2}
                            fill="url(#cpuAreaGradient)"
                            activeDot={{r: 3}}
                            connectNulls={!isLive}
                            isAnimationActive={!isLive}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <ChartPlaceholder/>
            )}
        </ChartContainer>
    );
};

/* ========================================== MemoryChart ========================================== */

const MemoryChart = ({agentId, timeRange, start, end, isLive, now, liveEnabled}: ChartPropsBase) => {
    const rangeMs = start !== undefined && end !== undefined ? end - start : undefined;
    // 数据查询
    const {data: metricsResponse, isLoading, isError} = useTrendMetricsQuery({
        agentId,
        type: 'memory',
        timeRange,
        liveEnabled,
        start,
        end,
    });

    // 完整时序窗口
    const chartData = useMemo(() => buildMetricChartData(
        metricsResponse?.series ?? [], ['usage'], undefined, isLive ? 15000 : Infinity,
    ), [metricsResponse, isLive]);

    // 渲染
    if (isLoading) {
        return (
            <ChartContainer title="内存使用率" icon={MemoryStick} status={<TrendStatus data={metricsResponse} failed={isError} isLive={isLive} now={now} intervalMs={METRIC_INTERVALS.memory}/>}>
                <ChartPlaceholder/>
            </ChartContainer>
        );
    }

    if (isError && !metricsResponse) return <ChartQueryError title="内存使用率" icon={MemoryStick}/>;

    return (
        <ChartContainer title="内存使用率" icon={MemoryStick} status={<TrendStatus data={metricsResponse} failed={isError} isLive={isLive} now={now} intervalMs={METRIC_INTERVALS.memory}/>}>
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="memoryAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--theme-chart-2)" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="var(--theme-chart-2)" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="currentColor" strokeDasharray="4 4" className="stroke-line"/>
                        <XAxis
                            dataKey="timestamp"
                            type="number"
                            scale="time"
                            domain={trendDomain(isLive, now, metricsResponse)} ticks={trendTicks(isLive, now, metricsResponse)}
                            allowDataOverflow
                            tickFormatter={(value) => formatChartTime(Number(value), timeRange, rangeMs)}
                            stroke="currentColor"
                            minTickGap={24}
                            textAnchor="middle"
                            className="text-xs text-content-secondary tabular-nums"
                        />
                        <YAxis
                            domain={[0, 100]}
                            stroke="currentColor"
                            className="stroke-content-muted text-xs"
                            tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip content={<CustomTooltip unit="%" timeFormat={isLive ? 'HH:mm:ss' : undefined}/>}/>
                        <Area
                            type={isLive ? "linear" : "monotone"}
                            dataKey="usage"
                            name="内存使用率"
                            stroke="var(--theme-chart-2)"
                            strokeWidth={2}
                            fill="url(#memoryAreaGradient)"
                            activeDot={{r: 3}}
                            connectNulls={!isLive}
                            isAnimationActive={!isLive}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <ChartPlaceholder/>
            )}
        </ChartContainer>
    );
};

/* ========================================== DiskIOChart ========================================== */

const DiskIOChart = ({agentId, timeRange, start, end, isLive, now, liveEnabled}: ChartPropsBase) => {
    const rangeMs = start !== undefined && end !== undefined ? end - start : undefined;
    // 数据查询
    const {data: metricsResponse, isLoading, isError} = useTrendMetricsQuery({
        agentId,
        type: 'disk_io',
        timeRange,
        liveEnabled,
        start,
        end,
    });

    // 完整时序窗口
    const chartData = useMemo(() => buildMetricChartData(
        metricsResponse?.series ?? [], ['read', 'write'], toMB, isLive ? 6000 : Infinity,
    ), [metricsResponse, isLive]);

    // 渲染
    if (isLoading) {
        return (
            <ChartContainer title="磁盘 I/O (MB/s)" icon={HardDrive} status={<TrendStatus data={metricsResponse} failed={isError} isLive={isLive} now={now}/>}>
                <ChartPlaceholder/>
            </ChartContainer>
        );
    }

    if (isError && !metricsResponse) return <ChartQueryError title="磁盘 I/O (MB/s)" icon={HardDrive}/>;

    return (
        <ChartContainer title="磁盘 I/O (MB/s)" icon={HardDrive} status={<TrendStatus data={metricsResponse} failed={isError} isLive={isLive} now={now}/>}>
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorDiskRead" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--theme-chart-1)" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="var(--theme-chart-1)" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorDiskWrite" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--theme-chart-2)" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="var(--theme-chart-2)" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="currentColor" strokeDasharray="4 4" className="stroke-line"/>
                        <XAxis
                            dataKey="timestamp"
                            type="number"
                            scale="time"
                            domain={trendDomain(isLive, now, metricsResponse)} ticks={trendTicks(isLive, now, metricsResponse)}
                            allowDataOverflow
                            tickFormatter={(value) => formatChartTime(Number(value), timeRange, rangeMs)}
                            stroke="currentColor"
                            minTickGap={24}
                            textAnchor="middle"
                            className="text-xs text-content-secondary tabular-nums"
                            height={45}
                        />
                        <YAxis
                            width={72}
                            stroke="currentColor"
                            className="stroke-content-muted text-xs"
                            tickFormatter={(value) => `${value} MB`}
                        />
                        <Tooltip content={<CustomTooltip unit=" MB" timeFormat={isLive ? 'HH:mm:ss' : undefined}/>}/>
                        <Legend/>
                        <Area
                            type={isLive ? "linear" : "monotone"}
                            dataKey="read"
                            name="读取"
                            stroke="var(--theme-chart-1)"
                            strokeWidth={2}
                            fill="url(#colorDiskRead)"
                            activeDot={{r: 3}}
                            connectNulls={!isLive}
                            isAnimationActive={!isLive}
                        />
                        <Area
                            type={isLive ? "linear" : "monotone"}
                            dataKey="write"
                            name="写入"
                            stroke="var(--theme-chart-2)"
                            strokeWidth={2}
                            fill="url(#colorDiskWrite)"
                            activeDot={{r: 3}}
                            connectNulls={!isLive}
                            isAnimationActive={!isLive}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <ChartPlaceholder subtitle="暂无磁盘 I/O 采集数据"/>
            )}
        </ChartContainer>
    );
};

/* ========================================== NetworkChart ========================================== */

const NetworkChart = ({agentId, timeRange, start, end, isLive, now, liveEnabled}: ChartPropsBase) => {
    const [selectedInterface, setSelectedInterface] = useState<string>('all');
    const rangeMs = start !== undefined && end !== undefined ? end - start : undefined;

    // 查询网卡列表
    const {data: interfacesData} = useNetworkInterfacesQuery(agentId, !isLive);
    const liveBatch = useLiveMetricsQuery(agentId, !!isLive, liveEnabled);
    const availableInterfaces = useMemo(() => isLive
        ? [...new Set((liveBatch.data?.series.network ?? []).map(series => series.labels?.interface).filter((name): name is string => !!name))].sort()
        : interfacesData?.interfaces ?? [], [isLive, liveBatch.data, interfacesData]);

    // 当网卡列表变化时，验证选中的网卡
    useEffect(() => {
        if (selectedInterface !== 'all' && (isLive ? liveBatch.data : interfacesData)) {
            if (!availableInterfaces.includes(selectedInterface)) {
                setSelectedInterface('all');
            }
        }
    }, [availableInterfaces, selectedInterface, isLive, liveBatch.data, interfacesData]);

    // 查询网络数据
    const {data: metricsResponse, isLoading, isError} = useTrendMetricsQuery({
        agentId,
        type: 'network',
        timeRange,
        liveEnabled,
        start,
        end,
        interfaceName: selectedInterface !== 'all' ? selectedInterface : undefined,
    });

    // 完整时序窗口
    const chartData = useMemo(() => buildMetricChartData(
        metricsResponse?.series ?? [], ['upload', 'download'], toMB, isLive ? 6000 : Infinity,
    ), [metricsResponse, isLive]);

    // 网卡选择器
    const interfaceSelector = availableInterfaces.length > 0 && (
        <select
            aria-label="网络接口"
            value={selectedInterface}
            onChange={(e) => setSelectedInterface(e.target.value)}
            className="rounded-control border border-line bg-panel-muted px-3 py-1.5 text-sm text-content-secondary hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
            <option value="all">全部网卡</option>
            {availableInterfaces.map((iface) => (
                <option key={iface} value={iface}>
                    {iface}
                </option>
            ))}
        </select>
    );

    // 渲染
    if (isLoading) {
        return (
            <ChartContainer title="网络流量（MB/s）" icon={Network} status={<TrendStatus data={metricsResponse} failed={isError} isLive={isLive} now={now}/>} action={interfaceSelector}>
                <ChartPlaceholder/>
            </ChartContainer>
        );
    }

    if (isError && !metricsResponse) return <ChartQueryError title="网络流量 (MB/s)" icon={Network}/>;

    return (
        <ChartContainer title="网络流量（MB/s）" icon={Network} status={<TrendStatus data={metricsResponse} failed={isError} isLive={isLive} now={now}/>} action={interfaceSelector}>
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="color-upload" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={INTERFACE_COLORS[0].upload} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={INTERFACE_COLORS[0].upload} stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="color-download" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={INTERFACE_COLORS[0].download} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={INTERFACE_COLORS[0].download} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="currentColor" strokeDasharray="4 4" className="stroke-line"/>
                        <XAxis
                            dataKey="timestamp"
                            type="number"
                            scale="time"
                            domain={trendDomain(isLive, now, metricsResponse)} ticks={trendTicks(isLive, now, metricsResponse)}
                            allowDataOverflow
                            tickFormatter={(value) => formatChartTime(Number(value), timeRange, rangeMs)}
                            stroke="currentColor"
                            minTickGap={24}
                            textAnchor="middle"
                            className="text-xs text-content-secondary tabular-nums"
                            height={45}
                        />
                        <YAxis
                            width={72}
                            stroke="currentColor"
                            className="stroke-content-muted text-xs"
                            tickFormatter={(value) => `${value} MB`}
                        />
                        <Tooltip content={<CustomTooltip unit=" MB/s" timeFormat={isLive ? 'HH:mm:ss' : undefined}/>}/>
                        <Legend/>
                        <Area
                            type={isLive ? "linear" : "monotone"}
                            dataKey="upload"
                            name="上行"
                            stroke={INTERFACE_COLORS[0].upload}
                            strokeWidth={2}
                            fill="url(#color-upload)"
                            activeDot={{r: 3}}
                            connectNulls={!isLive}
                            isAnimationActive={!isLive}
                        />
                        <Area
                            type={isLive ? "linear" : "monotone"}
                            dataKey="download"
                            name="下行"
                            stroke={INTERFACE_COLORS[0].download}
                            strokeWidth={2}
                            fill="url(#color-download)"
                            activeDot={{r: 3}}
                            connectNulls={!isLive}
                            isAnimationActive={!isLive}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <ChartPlaceholder subtitle="稍后再次尝试刷新网络流量"/>
            )}
        </ChartContainer>
    );
};

/* ========================================== NetworkConnectionChart ========================================== */

const NetworkConnectionChart = ({agentId, timeRange, start, end, isLive, now, liveEnabled}: ChartPropsBase) => {
    const rangeMs = start !== undefined && end !== undefined ? end - start : undefined;
    const {data: metricsResponse, isLoading, isError} = useTrendMetricsQuery({
        agentId,
        type: 'network_connection',
        timeRange,
        liveEnabled,
        start,
        end,
    });

    // 完整时序窗口
    const chartData = useMemo(() => buildMetricChartData(
        metricsResponse?.series ?? [], ['established', 'time_wait', 'close_wait', 'listen'],
        value => Number(value.toFixed(0)), isLive ? 30000 : Infinity,
    ), [metricsResponse, isLive]);

    // 渲染
    if (isLoading) {
        return (
            <ChartContainer title="网络连接统计" icon={Network} status={<TrendStatus data={metricsResponse} failed={isError} isLive={isLive} now={now} intervalMs={METRIC_INTERVALS.network_connection}/>}>
                <ChartPlaceholder/>
            </ChartContainer>
        );
    }

    if (isError && !metricsResponse) return <ChartQueryError title="网络连接统计" icon={Network}/>;

    return (
        <ChartContainer title="网络连接统计" icon={Network} status={<TrendStatus data={metricsResponse} failed={isError} isLive={isLive} now={now} intervalMs={METRIC_INTERVALS.network_connection}/>}>
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                        <CartesianGrid stroke="currentColor" strokeDasharray="4 4" className="stroke-line"/>
                        <XAxis
                            dataKey="timestamp"
                            type="number"
                            scale="time"
                            domain={trendDomain(isLive, now, metricsResponse)} ticks={trendTicks(isLive, now, metricsResponse)}
                            allowDataOverflow
                            tickFormatter={(value) => formatChartTime(Number(value), timeRange, rangeMs)}
                            stroke="currentColor"
                            minTickGap={24}
                            textAnchor="middle"
                            className="text-xs text-content-secondary tabular-nums"
                            height={45}
                        />
                        <YAxis
                            stroke="currentColor"
                            className="stroke-content-muted text-xs"
                        />
                        <Tooltip content={<CustomTooltip unit="" timeFormat={isLive ? 'HH:mm:ss' : undefined}/>}/>
                        <Legend/>
                        <Line
                            type={isLive ? "linear" : "monotone"}
                            dataKey="established"
                            name="ESTABLISHED"
                            stroke="var(--theme-chart-2)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{r: 3}}
                            connectNulls={!isLive}
                            isAnimationActive={!isLive}
                        />
                        <Line
                            type={isLive ? "linear" : "monotone"}
                            dataKey="time_wait"
                            name="TIME_WAIT"
                            stroke="var(--theme-warning)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{r: 3}}
                            connectNulls={!isLive}
                            isAnimationActive={!isLive}
                        />
                        <Line
                            type={isLive ? "linear" : "monotone"}
                            dataKey="close_wait"
                            name="CLOSE_WAIT"
                            stroke="var(--theme-danger)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{r: 3}}
                            connectNulls={!isLive}
                            isAnimationActive={!isLive}
                        />
                        <Line
                            type={isLive ? "linear" : "monotone"}
                            dataKey="listen"
                            name="LISTEN"
                            stroke="var(--theme-chart-1)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{r: 3}}
                            connectNulls={!isLive}
                            isAnimationActive={!isLive}
                        />
                    </LineChart>
                </ResponsiveContainer>
            ) : (
                <ChartPlaceholder subtitle="暂无网络连接统计数据"/>
            )}
        </ChartContainer>
    );
};

/* ========================================== GpuChart ========================================== */

const GpuChartImpl = ({agentId, timeRange, start, end, isLive, now, liveEnabled}: ChartPropsBase) => {
    const {data: metricsResponse, isLoading, isError} = useTrendMetricsQuery({agentId, type: 'gpu', timeRange, start, end, liveEnabled});
    const curves = useMemo(() => getGpuSeries(metricsResponse?.series ?? []), [metricsResponse]);
    const chartData = useMemo(() => buildMonitorChartData(curves, new Set(curves.map(curve => curve.key)), isLive ? METRIC_INTERVALS.gpu * 3 : Infinity), [curves, isLive]);
    if (isLoading) return <ChartContainer title="GPU 使用率与温度" icon={Zap}><ChartPlaceholder/></ChartContainer>;
    if (isError && !metricsResponse) return <ChartQueryError title="GPU 使用率与温度" icon={Zap}/>;
    if (!curves.length) return null;
    return <ChartContainer title="GPU 使用率与温度" icon={Zap} status={<TrendStatus data={metricsResponse} failed={isError} isLive={isLive} now={now} intervalMs={METRIC_INTERVALS.gpu}/>}>
        <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="4 4" className="stroke-line"/>
                <XAxis stroke="currentColor" dataKey="timestamp" type="number" scale="time" domain={trendDomain(isLive, now, metricsResponse)} ticks={trendTicks(isLive, now, metricsResponse)} allowDataOverflow tickFormatter={value => formatChartTime(Number(value), timeRange, start !== undefined && end !== undefined ? end-start : undefined)} minTickGap={24} className="text-xs text-content-secondary"/>
                <YAxis stroke="currentColor" yAxisId="utilization" domain={[0,100]} tickFormatter={value => `${value}%`} className="text-xs text-content-secondary"/>
                <YAxis stroke="currentColor" yAxisId="temperature" orientation="right" tickFormatter={value => `${value}°C`} className="text-xs text-content-secondary"/>
                <Tooltip content={<CustomTooltip unit="" timeFormat={isLive ? 'HH:mm:ss' : undefined}/>}/>
                <Legend/>
                {curves.map((curve, index) => <Line key={curve.key} yAxisId={curve.metricType} dataKey={curve.key} name={curve.name} type="linear" stroke={INTERFACE_COLORS[index % INTERFACE_COLORS.length].download} dot={curve.points.length === 1} activeDot={{r:3}} connectNulls={false} isAnimationActive={!isLive}/>)}
            </LineChart>
        </ResponsiveContainer>
    </ChartContainer>;
};
const GpuChart = memo(GpuChartImpl);

const TemperatureChartImpl = ({agentId, timeRange, start, end, isLive, now, liveEnabled}: ChartPropsBase) => {
    const [selectedSensor, setSelectedSensor] = useState('all');
    const {data: metricsResponse, isLoading, isError} = useTrendMetricsQuery({agentId, type:'temperature', timeRange, start, end, liveEnabled});
    const curves = useMemo(() => getTemperatureSeries(metricsResponse?.series ?? []), [metricsResponse]);
    const visible = useMemo(() => curves.filter(curve => selectedSensor === 'all' || curve.key === selectedSensor), [curves, selectedSensor]);
    const chartData = useMemo(() => buildMonitorChartData(visible, new Set(visible.map(curve => curve.key)), Infinity, !!isLive), [visible, isLive]);
    useEffect(() => { if (curves.length && selectedSensor !== 'all' && !curves.some(curve => curve.key === selectedSensor)) setSelectedSensor('all'); }, [curves, selectedSensor]);
    if (isLoading) return <ChartContainer title="系统温度" icon={Thermometer}><ChartPlaceholder/></ChartContainer>;
    if (isError && !metricsResponse) return <ChartQueryError title="系统温度" icon={Thermometer}/>;
    if (!curves.length) return null;
    return <ChartContainer title="系统温度" icon={Thermometer} status={<TrendStatus data={metricsResponse} failed={isError} isLive={isLive} now={now} intervalMs={METRIC_INTERVALS.temperature}/>} action={
        <select aria-label="温度指标" value={selectedSensor} onChange={event => setSelectedSensor(event.target.value)} className="rounded-control border border-line bg-panel px-3 py-1.5 text-xs text-content-secondary">
            <option value="all">全部温度</option>{curves.map(curve => <option key={curve.key} value={curve.key}>{curve.name}</option>)}
        </select>
    }>
        <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="4 4" className="stroke-line"/>
                <XAxis stroke="currentColor" dataKey="timestamp" type="number" scale="time" domain={trendDomain(isLive, now, metricsResponse)} ticks={trendTicks(isLive, now, metricsResponse)} allowDataOverflow tickFormatter={value => formatChartTime(Number(value), timeRange, start !== undefined && end !== undefined ? end-start : undefined)} minTickGap={24} className="text-xs text-content-secondary"/>
                <YAxis stroke="currentColor" tickFormatter={value => `${value}°C`} className="text-xs text-content-secondary"/>
                <Tooltip content={<CustomTooltip unit="°C" timeFormat={isLive ? 'HH:mm:ss' : undefined}/>}/><Legend/>
                {visible.map((curve,index) => <Line key={curve.key} dataKey={curve.key} name={curve.name} type="linear" stroke={TEMPERATURE_COLORS[curve.name] ?? INTERFACE_COLORS[index % INTERFACE_COLORS.length].download} dot={curve.points.length === 1} activeDot={{r:3}} connectNulls={false} isAnimationActive={!isLive}/>)}
            </LineChart>
        </ResponsiveContainer>
    </ChartContainer>;
};
const TemperatureChart = memo(TemperatureChartImpl);

const MonitorChartImpl = ({agentId, timeRange, start, end, isLive, now, liveEnabled}: ChartPropsBase) => {
    const isMobile = useIsMobile();
    const [legendCollapsed, setLegendCollapsed] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const previousKeys = useRef<Set<string>>(new Set());
    const {data: metricsResponse, isLoading, isError} = useTrendMetricsQuery({agentId, type:'monitor', timeRange, start, end, liveEnabled});
    const curves = useMemo(() => getMonitorSeries(metricsResponse?.series ?? []), [metricsResponse]);
    useEffect(() => {
        const keys = new Set(curves.map(curve => curve.key));
        const previous = previousKeys.current;
        setSelected(current => reconcileMonitorSelection(previous, keys, current));
        previousKeys.current = keys;
    }, [curves]);
    const chartData = useMemo(() => buildMonitorChartData(curves, selected, Infinity, !!isLive), [curves, selected, isLive]);
    const toggle = (key: string) => setSelected(current => {
        if (current.size === curves.length) return new Set([key]);
        const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next;
    });
    if (isLoading) return <ChartContainer title="监控响应时间" icon={Activity}><ChartPlaceholder/></ChartContainer>;
    if (isError && !metricsResponse) return <ChartQueryError title="监控响应时间" icon={Activity}/>;
    if (!curves.length) return null;
    return <ChartContainer title="监控响应时间" icon={Activity} status={<TrendStatus data={metricsResponse} failed={isError} isLive={isLive} now={now} intervalMs={Math.max(...curves.map(curve => curve.intervalMs ?? 60000))}/>}
        action={selected.size < curves.length ? <button type="button" aria-label="恢复显示全部监控项" onClick={() => setSelected(new Set(curves.map(curve => curve.key)))} className="rounded-control p-1.5 text-content-muted hover:text-brand"><RotateCcw size={16}/></button> : undefined}>
        <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="4 4" className="stroke-line"/>
                <XAxis stroke="currentColor" dataKey="timestamp" type="number" scale="time" domain={trendDomain(isLive, now, metricsResponse, LIVE_MONITOR_WINDOW_MS)} ticks={trendTicks(isLive, now, metricsResponse, LIVE_MONITOR_WINDOW_MS)} allowDataOverflow tickFormatter={value => formatChartTime(Number(value), timeRange, start !== undefined && end !== undefined ? end-start : undefined)} minTickGap={24} className="text-xs text-content-secondary"/>
                <YAxis stroke="currentColor" tickFormatter={value => `${value}ms`} className="text-xs text-content-secondary"/>
                <Tooltip content={<CustomTooltip unit="ms" timeFormat={isLive ? 'HH:mm:ss' : undefined}/>}/>
                {curves.filter(curve => selected.has(curve.key)).map(curve => <Line key={curve.key} dataKey={curve.key} name={curve.name} type="linear" stroke={INTERFACE_COLORS[curves.indexOf(curve) % INTERFACE_COLORS.length].download} dot={{r:2}} activeDot={{r:3}} connectNulls={false} isAnimationActive={!isLive}/>)}
            </LineChart>
        </ResponsiveContainer>
        {isMobile && <button type="button" onClick={() => setLegendCollapsed(value => !value)} aria-expanded={!legendCollapsed} className="flex w-full items-center justify-center gap-2 py-2 text-xs text-content-secondary">{legendCollapsed ? '显示图例' : '收起图例'}{legendCollapsed ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}</button>}
        {(!isMobile || !legendCollapsed) && <div className="flex flex-wrap justify-center gap-4 pt-4">
            {curves.map((curve,index) => <button type="button" key={curve.key} aria-pressed={selected.has(curve.key)} onClick={() => toggle(curve.key)} className="flex items-center gap-2 rounded-control px-1 py-0.5 text-xs" style={{opacity:selected.has(curve.key) ? 1 : .4, color:INTERFACE_COLORS[index % INTERFACE_COLORS.length].download}}><span className="h-0.5 w-6 bg-current"/>{curve.name}</button>)}
        </div>}
    </ChartContainer>;
};
const MonitorChart = memo(MonitorChartImpl);

/* ========================================== ServerDetail ========================================== */

/**
 * 服务器详情页面
 * 显示服务器的详细信息、最新指标和历史趋势图表
 */
const ServerDetail = () => {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [timeRange, setTimeRange] = useState<string>(LIVE_RANGE);
    const [customRange, setCustomRange] = useState<{ start: number; end: number } | null>(null);

    const handleCustomRangeApply = (range: { start: number; end: number }) => {
        setCustomRange(range);
    };

    const isLive = timeRange === LIVE_RANGE;
    const [clock, setClock] = useState(Date.now);
    useEffect(() => {
        if (!isLive) return;
        const timer = window.setInterval(() => setClock(Date.now()), 2000);
        return () => window.clearInterval(timer);
    }, [isLive]);
    const customStart = timeRange === 'custom' ? customRange?.start : undefined;
    const customEnd = timeRange === 'custom' ? customRange?.end : undefined;

    // 查询基础数据（用于页面头部和系统信息）
    const {data: agentResponse, isLoading, isError, error, refetch} = useAgentQuery(id);
    const isOnline = isAgentOnline(agentResponse);
    const liveQuery = useLiveMetricsQuery(id ?? '', isLive, isOnline);
    const windowEnd = liveQuery.data ? liveQuery.data.generatedAt + Math.max(0, clock - liveQuery.dataUpdatedAt) : clock;
    const {
        data: latestMetricsResponse,
        isError: isLatestMetricsError,
        refetch: refetchLatestMetrics,
    } = useLatestMetricsQuery(id, POLLING_INTERVALS.latestMetrics, isOnline);

    const agent = agentResponse;
    const latestMetrics = isOnline ? latestMetricsResponse || null : null;

    const deviceIpInterfaces = (latestMetrics?.networkInterfaces || [])
        .map((netInterface) => ({
            name: netInterface.interface,
            addrs: Array.from(new Set((netInterface.addrs || []).map((addr) => addr.trim()).filter(Boolean))),
        }))
        .filter((netInterface) => netInterface.addrs.length > 0);

    if (isLoading) {
        return <LoadingSpinner/>;
    }

    if (isError) {
        if (error instanceof PikaAPIError && error.status === 404) {
            return <EmptyState message="设备不存在或当前不可见"/>;
        }
        return (
            <PublicPageContainer className="py-4 sm:py-6">
                <ErrorState message="设备详情接口暂时不可用。" onRetry={() => void refetch()}/>
            </PublicPageContainer>
        );
    }

    if (!agent) {
        return <EmptyState/>;
    }

    return (
        <div className="bg-page">
            <PublicPageContainer className="flex flex-col pb-10 pt-4 sm:pt-6">
                {/* 头部区域 */}
                <ServerHero
                    agent={agent}
                    latestMetrics={latestMetrics}
                    onBack={() => navigate('/')}
                />

                {/* 主内容区 */}
                <main className="mt-6 flex-1 space-y-6">
                    {isOnline && isLatestMetricsError && (
                        <ErrorState className="min-h-[180px]" message="设备当前在线，但最新指标加载失败。" onRetry={() => void refetchLatestMetrics()}/>
                    )}
                    {/* 网络地址信息 */}
                    {(agent.ipv4 || agent.ipv6 || deviceIpInterfaces?.length > 0) && (
                        <NetworkAddressSection
                            ipv4={agent.ipv4}
                            ipv6={agent.ipv6}
                            deviceIpInterfaces={deviceIpInterfaces}
                        />
                    )}

                    {/* 系统信息 */}
                    <SystemInfoSection agent={agent} latestMetrics={latestMetrics}/>

                    {/* 历史趋势图表 */}
                    <Card
                        title="历史趋势"
                        action={
                            <div className="flex flex-wrap items-center gap-2">
                                <TimeRangeSelector
                                    value={timeRange}
                                    onChange={setTimeRange}
                                    options={SERVER_TIME_RANGE_OPTIONS}
                                    enableCustom
                                    customRange={customRange}
                                    onCustomRangeApply={handleCustomRangeApply}
                                />
                            </div>
                        }
                    >
                        <div className="space-y-4 sm:space-y-5 lg:space-y-6">
                            {/* 核心指标：大屏 2 列，小屏 1 列 */}
                            <div className="grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1 md:grid-cols-2">
                                <CpuChart agentId={id!} timeRange={timeRange} start={customStart} end={customEnd}
                                          isLive={isLive} now={windowEnd} liveEnabled={isOnline}/>
                                <MemoryChart agentId={id!} timeRange={timeRange} start={customStart} end={customEnd}
                                             isLive={isLive} now={windowEnd} liveEnabled={isOnline}/>
                            </div>

                            {/* 网络相关：大屏 2 列，中屏 1 列 */}
                            <div className="grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-2">
                                <NetworkChart agentId={id!} timeRange={timeRange} start={customStart} end={customEnd}
                                              isLive={isLive} now={windowEnd} liveEnabled={isOnline}/>
                                <DiskIOChart agentId={id!} timeRange={timeRange} start={customStart} end={customEnd}
                                             isLive={isLive} now={windowEnd} liveEnabled={isOnline}/>
                            </div>

                            {/* 进阶指标：单列全宽 */}
                            <div className="grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1">
                                <NetworkConnectionChart agentId={id!} timeRange={timeRange} start={customStart}
                                                        end={customEnd} isLive={isLive} now={windowEnd} liveEnabled={isOnline}/>
                            </div>

                            {/* 硬件指标：条件渲染，单列全宽 */}
                            <div className="grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1">
                                <GpuChart agentId={id!} timeRange={timeRange} start={customStart} end={customEnd}
                                          isLive={isLive} now={windowEnd} liveEnabled={isOnline}/>
                                <TemperatureChart agentId={id!} timeRange={timeRange} start={customStart}
                                                  end={customEnd} isLive={isLive} now={windowEnd} liveEnabled={isOnline}/>
                            </div>

                            {/* 监控指标：单列全宽 */}
                            <div className="grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1">
                                <MonitorChart agentId={id!} timeRange={timeRange} start={customStart} end={customEnd}
                                              isLive={isLive} now={windowEnd} liveEnabled={isOnline}/>
                            </div>
                        </div>
                    </Card>

                    {/* 网络连接统计 */}
                    <NetworkConnectionSection latestMetrics={latestMetrics}/>

                    {/* GPU 监控 */}
                    <GpuMonitorSection latestMetrics={latestMetrics}/>

                    {/* 温度监控 */}
                    <TemperatureMonitorSection latestMetrics={latestMetrics}/>
                </main>
            </PublicPageContainer>
        </div>
    );
};

export default ServerDetail;
