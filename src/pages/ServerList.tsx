import {type FC, type ReactNode, useMemo, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {
    Activity,
    ArrowDown,
    ArrowUp,
    Clock,
    Cpu,
    Filter,
    Globe,
    HardDrive,
    LinkIcon,
    MemoryStick,
    Network,
    Thermometer,
    UnlinkIcon
} from 'lucide-react';
import {pika} from '../api';
import {POLLING_INTERVALS} from '../constants';
import type {LatestMetrics, TagsResponse} from '../types';
import {cn, formatBytes, formatTraffic, formatSpeed, formatUptime, isExpired, isExpiringSoon} from '../lib/utils';
import {AgentExpiryBadge, AgentOfflineState, Card, ErrorState, LoadingSpinner, MetricBar, StatCard, StatusSummary} from '../components/index';
import {hasAgentResourcePressure, isAgentOnline, isAgentTrafficNearLimit, type AgentWithMetrics} from '../domain/agents/agent-view-model';
import PublicPageContainer from '../layouts/PublicPageContainer';

/* ========================================== 共享辅助函数 ========================================== */

const calculateNetworkSpeed = (metrics?: LatestMetrics) => {
    if (!metrics?.network) {
        return {upload: 0, download: 0};
    }
    return {
        upload: metrics.network.totalBytesSentRate,
        download: metrics.network.totalBytesRecvRate
    };
};

const calculateDiskUsage = (metrics?: LatestMetrics) => {
    if (!metrics?.disk) {
        return 0;
    }
    return metrics.disk.usagePercent;
};

const getTemperatures = (metrics?: LatestMetrics) => {
    if (!metrics?.temperature || metrics.temperature.length === 0) {
        return [];
    }
    // 返回所有温度数据
    return [...metrics.temperature].sort((a, b) => a.type.localeCompare(b.type));
};

const getTrafficProgressColor = (percent: number) => {
    if (percent >= 100) return 'bg-danger';
    if (percent >= 80) return 'bg-warning';
    return 'bg-success';
};

const FILTER_LABELS: Record<string, string> = {
    ALL: '全部',
    ONLINE: '在线',
    OFFLINE: '离线',
    EXPIRED: '已过期',
};

/* ========================================== ServerCard ========================================== */

interface ServerCardProps {
    server: AgentWithMetrics;
}

const ServerCard: FC<ServerCardProps> = ({server}) => {
    const isOnline = isAgentOnline(server);
    const cpuUsage = server.metrics?.cpu?.usagePercent ?? 0;
    const memoryUsage = server.metrics?.memory?.usagePercent ?? 0;
    const memoryTotal = server.metrics?.memory?.total ?? 0;
    const memoryUsed = server.metrics?.memory?.used ?? 0;
    const diskUsage = calculateDiskUsage(server.metrics);
    const diskTotal = server.metrics?.disk?.total ?? 0;
    const diskUsed = server.metrics?.disk?.used ?? 0;
    const {upload, download} = calculateNetworkSpeed(server.metrics);
    const temperatures = getTemperatures(server.metrics);
    const netConn = server.metrics?.networkConnection;
    const traffic = server.trafficStats;
    const trafficUsagePercent = traffic?.enabled && traffic.limit > 0
        ? Math.min(100, (traffic.used / traffic.limit) * 100)
        : 0;

    return (
        <Link to={`/servers/${server.id.substring(0, 8)}`} className="block h-full">
            <Card className="h-full space-y-2 p-5" interactive>
                    {/* 顶部：名称和设备标签 */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="min-w-0 truncate text-base font-bold text-content">
                                {server.name || server.hostname}
                            </div>
                            <div
                                className="flex items-center gap-2 text-xs text-content-secondary mt-1 tabular-nums uppercase">
                                <span>{server.os}</span>
                                <span className="h-2 w-px bg-line-strong"></span>
                                <span>{server.arch}</span>
                            </div>
                        </div>
                        {server.tags && server.tags.length > 0 && (
                            <div className="flex gap-1 flex-wrap justify-end">
                                {server.tags.slice(0, 2).map(tag => (
                                    <span
                                        key={tag}
                                        className="whitespace-nowrap rounded-full border border-line bg-panel-muted px-2 py-0.5 text-xs text-content-secondary"
                                    >
                                #{tag}
                            </span>
                                ))}
                                {server.tags.length > 2 && (
                                    <span
                                        className="rounded-full border border-line bg-panel-muted px-2 py-0.5 text-xs text-content-secondary">
                                +{server.tags.length - 2}
                            </span>
                                )}
                            </div>
                        )}
                    </div>

                    {((isOnline && server.metrics?.host) || server.expireTime > 0) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums text-xs text-content-muted">
                            {isOnline && server.metrics?.host && (
                                <>
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3"/>
                                        <span>{formatUptime(server.metrics.host.uptime)}</span>
                                    </div>
                                    <span className="h-2 w-px bg-line-strong"/>
                                    <div className="flex items-center gap-1">
                                        <Activity className="h-3 w-3"/>
                                        <span>{server.metrics.host.procs} 进程</span>
                                    </div>
                                </>
                            )}
                            {server.expireTime > 0 && (
                                <>
                                    {isOnline && server.metrics?.host && <span className="h-2 w-px bg-line-strong"/>}
                                    <AgentExpiryBadge expireTime={server.expireTime}/>
                                </>
                            )}
                        </div>
                    )}

                    {/* 资源使用情况 */}
                    {isOnline ? (
                        <div className="space-y-1">
                            <MetricBar
                                type="cpu"
                                value={cpuUsage}
                                label="CPU"
                                icon={Cpu}
                                detail={server.metrics?.cpu ? `${server.metrics.cpu.physicalCores}核` : undefined}
                            />
                            <MetricBar
                                type="memory"
                                value={memoryUsage}
                                label="RAM"
                                icon={MemoryStick}
                                detail={`${formatBytes(memoryUsed, 0, 1024)}/${formatBytes(memoryTotal, 0, 1024)}`}
                            />
                            <MetricBar
                                type="disk"
                                value={diskUsage}
                                label="DSK"
                                icon={HardDrive}
                                detail={`${formatBytes(diskUsed, 0)}/${formatBytes(diskTotal, 0)}`}
                            />
                            {temperatures.length > 0 && (
                                <div className="mt-1 flex flex-wrap items-center gap-2 pb-2 pt-1 tabular-nums text-xs">
                                    <Thermometer className="w-3 h-3 text-warning"/>
                                    {temperatures.map((temp, index) => (
                                        <span key={index} className="flex items-center gap-1">
                                        <span className="text-warning">{temp.temperature?.toFixed(1)}°C</span>
                                        <span className="text-content-muted">{temp.type}</span>
                                            {index < temperatures.length - 1 &&
                                                <span className="text-line-strong">|</span>}
                                    </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="py-2"><AgentOfflineState compact/></div>
                    )}

                    {/* 离线设备仅展示资源区的错误状态，不展示可能已经陈旧的网络与流量数据。 */}
                    {isOnline && <div className="space-y-2 border-t border-line pt-2">
                        <div className="flex items-center justify-between">
                            <div className="flex gap-3 text-xs tabular-nums">
                            <span className="flex items-center gap-1 text-success">
                                <ArrowDown className="w-3 h-3"/>
                                {formatSpeed(download)}
                            </span>
                                <span className="flex items-center gap-1 text-brand">
                                <ArrowUp className="w-3 h-3"/>
                                    {formatSpeed(upload)}
                            </span>
                            </div>
                        </div>
                        {isOnline && netConn && (
                            <div className="flex gap-3 text-xs tabular-nums">
                            <span className="flex items-center gap-1">
                                <Network className="w-3 h-3 shrink-0 text-success"/>
                                <span
                                    className="text-success">{netConn.established || 0}</span>
                                <span className="text-content-secondary">ESTABLISHED</span>
                            </span>
                                <span className="flex items-center gap-1">
                                <Network className="w-3 h-3 shrink-0 text-brand"/>
                                <span className="text-brand">{netConn.listen || 0}</span>
                                <span className="text-content-secondary">LISTEN</span>
                            </span>
                                <span className="flex items-center gap-1">
                                <Network className="w-3 h-3 shrink-0 text-danger"/>
                                <span className="text-danger">{netConn.closeWait || 0}</span>
                                <span className="text-content-secondary">CLOSE_WAIT</span>
                            </span>
                            </div>
                        )}
                        {traffic?.enabled && (
                            <div className="pt-2 border-t border-line space-y-1.5">
                                <div className="flex items-center gap-2 text-xs text-content-muted tabular-nums">
                                    <Activity className="w-3 h-3"/>
                                    <span>{traffic.type === 'recv' ? '进站' : traffic.type === 'send' ? '出站' : '全部'}流量</span>
                                </div>
                                {traffic.limit > 0 ? (
                                    <>
                                        <div className="flex items-baseline justify-between">
                                            <span className="text-xs text-content-secondary tabular-nums">
                                                {formatTraffic(traffic.used)} / {formatTraffic(traffic.limit)}
                                            </span>
                                            <span className="text-xs font-bold text-content-secondary tabular-nums">
                                                {trafficUsagePercent.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-panel-muted">
                                            <div
                                                className={`h-full transition-all ${getTrafficProgressColor(trafficUsagePercent)}`}
                                                style={{width: `${trafficUsagePercent}%`}}
                                            />
                                        </div>
                                        <div className="text-xs text-content-muted tabular-nums">
                                            重置日期: 每月 {traffic.resetDay} 号
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-xs text-content-muted tabular-nums">
                                        已使用: {formatTraffic(traffic.used)}
                                        <div className="text-xs text-content-muted mt-1">仅统计模式</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>}
            </Card>
        </Link>
    );
};

/* ========================================== ServerList 本地组件 ========================================== */

const NetworkStatCard = ({uploadRate, downloadRate, uploadTotal, downloadTotal}: {
    uploadRate: number;
    downloadRate: number;
    uploadTotal: number;
    downloadTotal: number;
}) => (
    <div className="relative overflow-hidden rounded-card border border-brand/20 bg-brand-muted p-4 text-brand shadow-card sm:p-5">
        <Network className="absolute -bottom-4 -right-4 h-20 w-20 -rotate-12 opacity-10 sm:h-24 sm:w-24"/>
        <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
                <div className="mb-3 text-xs font-medium text-content-secondary">网络统计</div>
                <div className="space-y-0.5 text-xs tabular-nums">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <ArrowUp className="h-3 w-3 flex-shrink-0 text-brand"/>
                        <span className="truncate text-content">{formatSpeed(uploadRate)}</span>
                        <span className="hidden text-content-secondary sm:inline">({formatBytes(uploadTotal)})</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <ArrowDown className="h-3 w-3 flex-shrink-0 text-success"/>
                        <span className="truncate text-content">{formatSpeed(downloadRate)}</span>
                        <span className="hidden text-content-secondary sm:inline">({formatBytes(downloadTotal)})</span>
                    </div>
                </div>
            </div>
            <span className="rounded-control bg-panel-muted p-2.5 text-brand"><Network className="h-5 w-5"/></span>
        </div>
    </div>
);

interface ServerListEmptyProps {
    title: string;
    description: string;
    extra?: ReactNode;
}

const ServerListEmpty = ({title, description, extra}: ServerListEmptyProps) => (
    <div
        className="flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-panel p-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-control bg-brand-muted text-brand">
            <HardDrive className="h-7 w-7"/>
        </div>
        <h3 className="mt-4 text-base font-semibold text-content">{title}</h3>
        <p className="mt-2 max-w-sm text-sm text-content-secondary">{description}</p>
        {extra ? <div className="mt-4">{extra}</div> : null}
    </div>
);

/* ========================================== ServerList ========================================== */

const ServerList = () => {
    const navigate = useNavigate();
    const [selectedTag, setSelectedTag] = useState<string>('');

    const {data: agents = [], isLoading, isError, refetch} = useQuery<AgentWithMetrics[]>({
        queryKey: ['agents', 'online'],
        queryFn: () => pika.listAgents<AgentWithMetrics>(),
        refetchInterval: POLLING_INTERVALS.serverList,
    });

    // 获取标签列表
    const {data: tagsData} = useQuery({
        queryKey: ['tags', 'public'],
        queryFn: async () => {
            const response = await pika.getTags<TagsResponse>();
            return response.tags || [];
        },
        refetchInterval: 30000,
    });

    // 计算所有标签（包括ALL和ONLINE/OFFLINE）
    const allTags = useMemo(() => {
        const tags = ['ALL', 'ONLINE', 'OFFLINE', 'EXPIRED'];
        if (tagsData && tagsData.length > 0) {
            tagsData.forEach((tag: string) => {
                if (!tags.includes(tag.toUpperCase())) {
                    tags.push(tag.toUpperCase());
                }
            });
        }
        return tags;
    }, [tagsData]);

    // 过滤逻辑
    const displayAgents = useMemo(() => {
        if (selectedTag === 'ONLINE') {
            return agents.filter(isAgentOnline);
        } else if (selectedTag === 'OFFLINE') {
            return agents.filter(a => !isAgentOnline(a));
        } else if (selectedTag === 'EXPIRED') {
            return agents.filter(a => a.expireTime > 0 && isExpired(a.expireTime));
        } else if (selectedTag && selectedTag !== 'ALL') {
            return agents.filter(a => a.tags?.map(t => t.toUpperCase()).includes(selectedTag));
        }
        return agents;
    }, [agents, selectedTag]);

    // 计算统计数据（基于过滤后的 displayAgents）
    const stats = useMemo(() => {
        const total = displayAgents.length;
        const online = displayAgents.filter(isAgentOnline).length;
        const offline = total - online;

        // 计算网络统计
        let totalUploadRate = 0;
        let totalDownloadRate = 0;
        let totalUploadTotal = 0;
        let totalDownloadTotal = 0;

        displayAgents.forEach(agent => {
            // 速率来自实时指标，只统计在线设备
            if (isAgentOnline(agent) && agent.metrics?.network) {
                totalUploadRate += agent.metrics.network.totalBytesSentRate || 0;
                totalDownloadRate += agent.metrics.network.totalBytesRecvRate || 0;
            }
            // 累计流量使用持久化的 trafficStats（内核计数器随重启清零，不能作为总流量口径）。
            // trafficStats 只记录总量，both 类型按开机计数器的收发比例拆分到上下行。
            const traffic = agent.trafficStats;
            if (traffic?.enabled && traffic.used > 0) {
                const bootSent = agent.metrics?.network?.totalBytesSentTotal || 0;
                const bootRecv = agent.metrics?.network?.totalBytesRecvTotal || 0;
                let uploadShare: number;
                if (traffic.type === 'send') {
                    uploadShare = 1;
                } else if (traffic.type === 'recv') {
                    uploadShare = 0;
                } else if (bootSent + bootRecv > 0) {
                    uploadShare = bootSent / (bootSent + bootRecv);
                } else {
                    uploadShare = 0.5;
                }
                totalUploadTotal += traffic.used * uploadShare;
                totalDownloadTotal += traffic.used * (1 - uploadShare);
            }
        });

        return {
            total,
            online,
            offline,
            uploadRate: totalUploadRate,
            downloadRate: totalDownloadRate,
            uploadTotal: totalUploadTotal,
            downloadTotal: totalDownloadTotal
        };
    }, [displayAgents]);

    const publicSignals = useMemo(() => {
        const offline = agents.filter(agent => !isAgentOnline(agent)).length;
        const expired = agents.filter(agent => agent.expireTime > 0 && isExpired(agent.expireTime)).length;
        const expiringSoon = agents.filter(agent => isExpiringSoon(agent.expireTime)).length;
        const resourcePressure = agents.filter(hasAgentResourcePressure).length;
        const trafficNearLimit = agents.filter(isAgentTrafficNearLimit).length;

        return {offline, expired, expiringSoon, resourcePressure, trafficNearLimit};
    }, [agents]);

    const summaryStatus = useMemo(() => {
        if (agents.length === 0) return 'unknown' as const;
        if (publicSignals.offline === agents.length) return 'down' as const;
        if (publicSignals.offline > 0 || publicSignals.expired > 0 || publicSignals.expiringSoon > 0 || publicSignals.resourcePressure > 0 || publicSignals.trafficNearLimit > 0) {
            return 'degraded' as const;
        }
        return 'healthy' as const;
    }, [agents.length, publicSignals]);

    const globalOnline = agents.length - publicSignals.offline;

    const handleNavigate = (agentId: string) => {
        navigate(`/servers/${agentId.substring(0, 8)}`);
    };

    if (isLoading) {
        return <LoadingSpinner/>;
    }

    if (isError) {
        return (
            <PublicPageContainer className="py-4 sm:py-8">
                <ErrorState message="设备状态接口暂时不可用，页面不会把请求失败误判为暂无设备。" onRetry={() => void refetch()}/>
            </PublicPageContainer>
        );
    }

    // debug
    // displayAgents = Array.from({length:10}, ()=>displayAgents).flat();

    return (
        <PublicPageContainer className="space-y-4 py-4 sm:space-y-6 sm:py-8">
            {/* 统计卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                <StatCard
                    label="设备总数"
                    value={stats?.total}
                    icon={Globe}
                    tone="accent"
                />
                <StatCard
                    label="在线设备"
                    value={stats?.online}
                    icon={LinkIcon}
                    tone="success"
                />
                <StatCard
                    label="离线设备"
                    value={stats.offline}
                    icon={UnlinkIcon}
                    tone={stats.offline > 0 ? 'danger' : 'neutral'}
                />
                <NetworkStatCard
                    uploadRate={stats?.uploadRate}
                    downloadRate={stats?.downloadRate}
                    uploadTotal={stats?.uploadTotal}
                    downloadTotal={stats?.downloadTotal}
                />
            </div>

            <StatusSummary
                title="公开运行状态"
                current={globalOnline}
                total={agents.length}
                currentLabel="台设备当前在线"
                status={summaryStatus}
                signals={[
                    agents.length === 0
                        ? {label: '暂无设备状态数据', status: 'unknown'}
                        : publicSignals.offline > 0
                        ? {label: `${publicSignals.offline} 台暂不可达`, status: 'down', onClick: () => setSelectedTag('OFFLINE')}
                        : {label: '所有设备可达', status: 'healthy'},
                    publicSignals.expired > 0 && {label: `${publicSignals.expired} 台已过期`, status: 'down', onClick: () => setSelectedTag('EXPIRED')},
                    publicSignals.expiringSoon > 0 && {label: `${publicSignals.expiringSoon} 台即将到期`, status: 'degraded'},
                    publicSignals.resourcePressure > 0 && {label: `${publicSignals.resourcePressure} 台资源负载较高`, status: 'degraded'},
                    publicSignals.trafficNearLimit > 0 && {label: `${publicSignals.trafficNearLimit} 台流量接近限额`, status: 'degraded'},
                ]}
                refreshLabel={`列表每 ${POLLING_INTERVALS.serverList / 1000} 秒自动刷新`}
            />

            {/* 标签过滤器 */}
            {allTags.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                    <div className="mr-1 flex items-center gap-1.5 text-sm font-medium text-content-secondary">
                        <Filter className="h-4 w-4"/>
                        <span>筛选</span>
                    </div>
                    {allTags.map(tag => {
                        const tagKey = tag === 'ALL' ? '' : tag;
                        let count = 0;
                        if (tag === 'ALL') count = agents.length;
                        else if (tag === 'ONLINE') count = agents?.filter(isAgentOnline).length;
                        else if (tag === 'OFFLINE') count = agents?.filter(a => !isAgentOnline(a)).length;
                        else if (tag === 'EXPIRED') count = agents?.filter(a => a.expireTime > 0 && isExpired(a.expireTime)).length;
                        else count = agents?.filter(a => a.tags?.map(t => t.toUpperCase()).includes(tag)).length;

                        if (count === 0 && tag !== 'ALL') return null;

                        return (
                            <button
                                key={tag}
                                type="button"
                                onClick={() => setSelectedTag(tagKey)}
                                aria-pressed={selectedTag === tagKey}
                                className={cn(
                                    'inline-flex cursor-pointer items-center gap-2 rounded-control border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                                    selectedTag === tagKey
                                        ? 'border-brand/30 bg-brand-muted text-brand shadow-sm'
                                        : 'border-line bg-panel text-content-secondary hover:border-line-strong hover:bg-panel-hover hover:text-content'
                                )}
                            >
                                <span>{FILTER_LABELS[tag] ?? tag}</span>
                                <span className={cn(
                                    'min-w-5 rounded-full px-1.5 py-0.5 text-center tabular-nums text-xs leading-none',
                                    selectedTag === tagKey ? 'bg-brand/10 text-brand' : 'bg-panel-muted text-content-muted',
                                )}>{count}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 服务器列表 */}
            {displayAgents.length === 0 ? (
                <ServerListEmpty
                    title={selectedTag ? '没有匹配的设备' : '暂无设备'}
                    description={selectedTag ? `当前筛选条件“${FILTER_LABELS[selectedTag] ?? selectedTag}”下暂无设备` : '当前没有可展示的公开探针。'}
                />
            ) : (
                <>
                    {/* 桌面端表格布局 */}
                    <div
                        className="hidden overflow-x-hidden rounded-card border border-line bg-panel shadow-card xl:block">
                        <table className="w-full table-fixed border-collapse text-left">
                            <thead>
                            <tr className="border-b border-line bg-panel-muted text-xs font-semibold text-content-muted">
                                <th className="w-[19%] p-5 font-bold">设备</th>
                                <th className="w-[20%] p-5 font-bold">资源</th>
                                <th className="w-[12%] p-5 font-bold">当前速率</th>
                                <th className="w-[17%] p-5 font-bold">流量</th>
                                <th className="w-[16%] p-5 font-bold">连接</th>
                                <th className="w-[16%] p-5 font-bold">标签与到期日</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                            {displayAgents.map(server => {
                                const isOnline = isAgentOnline(server);
                                const cpuUsage = server.metrics?.cpu?.usagePercent ?? 0;
                                const memoryUsage = server.metrics?.memory?.usagePercent ?? 0;
                                const memoryTotal = server.metrics?.memory?.total ?? 0;
                                const memoryUsed = server.metrics?.memory?.used ?? 0;
                                const diskUsage = calculateDiskUsage(server.metrics);
                                const diskTotal = server.metrics?.disk?.total ?? 0;
                                const diskUsed = server.metrics?.disk?.used ?? 0;
                                const {upload, download} = calculateNetworkSpeed(server.metrics);
                                const temperatures = getTemperatures(server.metrics);
                                const netConn = server.metrics?.networkConnection;
                                const traffic = server.trafficStats;
                                const trafficUsagePercent = traffic?.enabled && traffic.limit > 0
                                    ? Math.min(100, (traffic.used / traffic.limit) * 100)
                                    : 0;

                                return (
                                    <tr
                                        key={server.id}
                                        tabIndex={0}
                                        onClick={() => handleNavigate(server.id)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                handleNavigate(server.id);
                                            }
                                        }}
                                        className="group cursor-pointer transition-colors hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand"
                                    >
                                        {/* Identity */}
                                        <td className="p-4 align-middle">
                                            <div className="flex items-center gap-4">
                                                <div className="space-y-1">
                                                    <div className="text-sm font-bold text-content transition-colors">
                                                        {server.name}
                                                    </div>
                                                    <div
                                                        className="flex items-center gap-2 text-xs text-content-secondary mt-1 tabular-nums uppercase">
                                                        <span>{server.os}</span>
                                                        <span className="h-2 w-px bg-line-strong"></span>
                                                        <span>{server.arch}</span>
                                                    </div>
                                                    {isOnline && server.metrics?.host && (
                                                        <div className="flex items-center gap-3 text-xs tabular-nums mt-1">
                                                            <div
                                                                className="flex items-center gap-1 text-content-muted">
                                                                <Clock className="w-3 h-3"/>
                                                                <span>{formatUptime(server.metrics.host.uptime)}</span>
                                                            </div>
                                                            <div
                                                                className="flex items-center gap-1 text-content-muted">
                                                                <Activity className="w-3 h-3"/>
                                                                <span>{server.metrics.host.procs} 进程</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Resources */}
                                        <td className="p-4 align-middle">
                                            {isOnline ? (
                                                <div className="flex flex-col justify-center h-full gap-0.5">
                                                    <MetricBar
                                                        type="cpu"
                                                        value={cpuUsage}
                                                        label="CPU"
                                                        icon={Cpu}
                                                        detail={server.metrics?.cpu ? `${server.metrics.cpu.modelName} (${server.metrics.cpu.physicalCores}核)` : undefined}
                                                    />
                                                    <MetricBar
                                                        type="memory"
                                                        value={memoryUsage}
                                                        label="RAM"
                                                        icon={MemoryStick}
                                                        detail={`${formatBytes(memoryUsed, 1, 1024)}/${formatBytes(memoryTotal, 1, 1024)}`}
                                                    />
                                                    <MetricBar
                                                        type="disk"
                                                        value={diskUsage}
                                                        label="DSK"
                                                        icon={HardDrive}
                                                        detail={`${formatBytes(diskUsed, 1)}/${formatBytes(diskTotal, 1)}`}
                                                    />
                                                    {temperatures.length > 0 && (
                                                        <div
                                                            className="flex items-center gap-2 mt-1 text-xs tabular-nums flex-wrap">
                                                            <Thermometer className="w-3 h-3 text-warning"/>
                                                            {temperatures.map((temp, index) => (
                                                                <span key={index} className="flex items-center gap-1">
                                                                    <span
                                                                        className="text-warning">{temp.temperature?.toFixed(1)}°C</span>
                                                                    <span
                                                                        className="text-content-muted">{temp.type}</span>
                                                                    {index < temperatures.length - 1 &&
                                                                        <span className="text-line-strong">|</span>}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <AgentOfflineState/>
                                            )}
                                        </td>

                                        {/* Network */}
                                        <td className="p-4 align-middle tabular-nums text-xs whitespace-nowrap">
                                            {isOnline && <div className="flex flex-col gap-1.5 mb-1.5">
                                                <span
                                                    className="flex items-center gap-2 text-success">
                                                    <ArrowDown className="w-3 h-3"/>
                                                    <span>{formatSpeed(download)}</span>
                                                </span>
                                                <span
                                                    className="flex items-center gap-2 text-brand">
                                                    <ArrowUp className="w-3 h-3"/>
                                                    <span>{formatSpeed(upload)}</span>
                                                </span>
                                            </div>}
                                        </td>

                                        {/* Traffic */}
                                        <td className="p-4 align-middle tabular-nums text-xs">
                                            {isOnline && (traffic?.enabled ? (
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="text-xs text-content-muted tabular-nums">
                                                        {traffic.type === 'recv' ? '进站' : traffic.type === 'send' ? '出站' : '全部'}流量
                                                    </div>
                                                    {traffic.limit > 0 ? (
                                                        <>
                                                            <div className="flex items-baseline justify-between">
                                                                <span className="text-xs text-content-secondary tabular-nums">
                                                                    {formatTraffic(traffic.used)} / {formatTraffic(traffic.limit)}
                                                                </span>
                                                                <span className="text-xs font-bold text-content-secondary tabular-nums">
                                                                    {trafficUsagePercent.toFixed(1)}%
                                                                </span>
                                                            </div>
                                                            <div className="h-1.5 overflow-hidden rounded-full bg-panel-muted">
                                                                <div
                                                                    className={`h-full transition-all ${getTrafficProgressColor(trafficUsagePercent)}`}
                                                                    style={{width: `${trafficUsagePercent}%`}}
                                                                />
                                                            </div>
                                                            <div className="text-xs text-content-muted tabular-nums">
                                                                重置日期: 每月 {traffic.resetDay} 号
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="text-xs text-content-muted tabular-nums">
                                                            已使用: {formatTraffic(traffic.used)}
                                                            <div className="text-xs text-content-muted mt-1">仅统计模式</div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : null)}
                                        </td>

                                        {/* Connections */}
                                        <td className="p-4 align-middle tabular-nums text-xs whitespace-nowrap">
                                            {isOnline && netConn && (
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <Network
                                                            className="w-3 h-3 shrink-0 text-success"/>
                                                        <span
                                                            className="text-success">{netConn.established || 0}</span>
                                                        <span
                                                            className="text-content-secondary">ESTABLISHED</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Network className="w-3 h-3 shrink-0 text-brand"/>
                                                        <span
                                                            className="text-brand">{netConn.listen || 0}</span>
                                                        <span className="text-content-secondary">LISTEN</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Network className="w-3 h-3 shrink-0 text-danger"/>
                                                        <span
                                                            className="text-danger">{netConn.closeWait || 0}</span>
                                                        <span
                                                            className="text-content-secondary">CLOSE_WAIT</span>
                                                    </div>
                                                </div>
                                            )}
                                        </td>

                                        {/* Meta */}
                                        <td className="p-4 align-middle">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex gap-1 flex-wrap">
                                                    {server.tags && server.tags.length > 0 && server.tags.map(tag => (
                                                        <span key={tag}
                                                              className="rounded-full border border-line bg-panel-muted px-2 py-0.5 text-xs text-content-secondary">
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                                <AgentExpiryBadge expireTime={server.expireTime}/>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>

                    {/* 移动端卡片布局 */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:hidden">
                        {displayAgents.map(server => (
                            <ServerCard
                                key={server.id}
                                server={server}
                            />
                        ))}
                    </div>
                </>
            )}
        </PublicPageContainer>
    );
};

export default ServerList;
