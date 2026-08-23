import type {Agent, LatestMetrics} from '../../types';

export interface AgentWithMetrics extends Agent {
    metrics?: LatestMetrics;
}

export const isAgentOnline = (agent: Pick<Agent, 'status'> | null | undefined): boolean => agent?.status === 1;

export const hasAgentResourcePressure = (agent: AgentWithMetrics): boolean => {
    if (!isAgentOnline(agent)) return false;
    return [
        agent.metrics?.cpu?.usagePercent,
        agent.metrics?.memory?.usagePercent,
        agent.metrics?.disk?.usagePercent,
    ].some(value => (value ?? 0) >= 90);
};

export const isAgentTrafficNearLimit = (agent: AgentWithMetrics): boolean => {
    const traffic = agent.trafficStats;
    return Boolean(traffic?.enabled && traffic.limit > 0 && traffic.used / traffic.limit >= 0.8);
};
