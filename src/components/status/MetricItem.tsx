import type {ReactNode} from 'react';

export const MetricItem = ({label, value}: {label: string; value: ReactNode}) => (
    <div className="rounded-card border border-line bg-panel-muted p-4 text-left transition-colors hover:border-line-strong">
        <p className="text-sm font-medium text-content-secondary">{label}</p>
        <p className="mt-2 text-base font-semibold text-content">{value}</p>
    </div>
);
