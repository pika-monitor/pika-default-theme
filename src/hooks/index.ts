import {useEffect, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {pika} from '../api';
import {LIVE_RANGE, POLLING_INTERVALS} from '../constants';
import type {Agent, LatestMetrics, MetricsAggregation, MetricsParams, MetricsResponse, LiveMetricsResponse} from '../types';

interface UseMetricsQueryOptions {
    agentId: string;
    type: MetricsParams['type'];
    range?: string;
    start?: number;
    end?: number;
    interfaceName?: string;
    aggregation?: MetricsAggregation;
    refetchIntervalMs?: number;
}

export const useAgentQuery = (agentId?: string) => {
    return useQuery({
        queryKey: ['agent', agentId],
        queryFn: () => pika.getAgent<Agent>(agentId!),
        enabled: !!agentId,
        staleTime: 60000,
        refetchInterval: POLLING_INTERVALS.metadata,
    });
};

export const useLatestMetricsQuery = (agentId?: string, intervalMs: number = POLLING_INTERVALS.latestMetrics, enabled = true) => {
    return useQuery({
        queryKey: ['agent', agentId, 'metrics', 'latest'],
        queryFn: () => pika.getLatestMetrics<LatestMetrics>(agentId!),
        enabled: !!agentId && enabled,
        refetchInterval: intervalMs > 0 ? intervalMs : false,
    });
};

export const useMetricsQuery = ({agentId, type, range, start, end, interfaceName, aggregation, refetchIntervalMs}: UseMetricsQueryOptions) => {
    return useQuery({
        queryKey: ['agent', agentId, 'metrics', type, range, start, end, interfaceName, aggregation],
        queryFn: ({signal}) =>
            pika.getMetrics<MetricsResponse>(agentId, {
                type,
                range: start !== undefined && end !== undefined ? undefined : range,
                start,
                end,
                interface: interfaceName,
                aggregation,
            }, signal),
        enabled: !!agentId,
        refetchInterval: refetchIntervalMs && refetchIntervalMs > 0 ? refetchIntervalMs : false,
    });
};

interface TrendMetricsQueryOptions extends Omit<UseMetricsQueryOptions, 'type' | 'range' | 'aggregation' | 'refetchIntervalMs'> {
    type: NonNullable<MetricsParams['type']>;
    timeRange: string;
    liveEnabled?: boolean;
}

// All live observers share one batch request, independent of metric/interface.
export const getLiveMetricsQueryOptions = (agentId: string) => ({
    queryKey: ['agent', agentId, 'trend', 'live'],
    queryFn: ({signal}: {signal: AbortSignal}) => pika.getLiveMetrics(agentId, signal),
    enabled: !!agentId,
    staleTime: 0,
    refetchInterval: POLLING_INTERVALS.liveHistory,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: 'always' as const,
});

export const getTrendMetricsQueryOptions = ({agentId, type, timeRange, start, end, interfaceName, liveEnabled = true}: TrendMetricsQueryOptions) => {
    const isLive = timeRange === LIVE_RANGE;
    const params: MetricsParams = {type, range: start !== undefined && end !== undefined ? undefined : timeRange, start, end, interface: interfaceName};
    return {
        ...(isLive ? getLiveMetricsQueryOptions(agentId) : {
            queryKey: ['agent', agentId, 'trend', type, params],
            enabled: !!agentId,
            staleTime: 0,
            refetchInterval: false as const,
            refetchOnWindowFocus: false,
        }),
        enabled: !!agentId,
        refetchInterval: isLive && liveEnabled ? POLLING_INTERVALS.liveHistory : (false as const),
        queryFn: ({signal}: {signal: AbortSignal}): Promise<LiveMetricsResponse | MetricsResponse> => isLive
            ? pika.getLiveMetrics(agentId, signal)
            : pika.getMetrics<MetricsResponse>(agentId, params, signal),
        select: (response: LiveMetricsResponse | MetricsResponse): MetricsResponse => {
            if (!('generatedAt' in response)) return response;
            const from = type === 'monitor' ? response.monitorStart : response.start;
            const series = response.series[type] ?? [];
            const selectedSeries = type === 'network'
                ? series.filter(entry => (entry.labels?.interface ?? '') === (interfaceName ?? ''))
                : series;
            const latestSampleAt = type === 'network'
                ? selectedSeries.reduce((latest, entry) => entry.data.reduce((value, point) => Math.max(value, point.timestamp), latest), 0) || undefined
                : response.latestSampleAt[type];
            return {
                agentId: response.agentId, type, range: `${from}-${response.end}`,
                start: from, end: response.end,
                series: selectedSeries,
                latestSampleAt,
                historyError: response.historyError,
            };
        },
    };
};

export const useTrendMetricsQuery = (options: TrendMetricsQueryOptions) => useQuery(getTrendMetricsQueryOptions(options));

export const useLiveMetricsQuery = (agentId: string, enabled: boolean, poll = true) => useQuery({...getLiveMetricsQueryOptions(agentId), enabled: !!agentId && enabled, refetchInterval: poll ? POLLING_INTERVALS.liveHistory : false});

export const useNetworkInterfacesQuery = (agentId?: string, enabled = true) => {
    return useQuery({
        queryKey: ['agent', agentId, 'network-interfaces'],
        queryFn: () => pika.getNetworkInterfaces(agentId!),
        enabled: !!agentId && enabled,
        staleTime: POLLING_INTERVALS.metadata,
        refetchInterval: POLLING_INTERVALS.metadata,
    });
};

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
    const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);
    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
        const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        mql.addEventListener('change', onChange);
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        return () => mql.removeEventListener('change', onChange);
    }, []);
    return !!isMobile;
}
