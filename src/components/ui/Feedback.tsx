import type {LucideIcon} from 'lucide-react';
import {AlertCircle, Loader2, TrendingUp} from 'lucide-react';
import {cn} from '../../lib/utils';

interface ChartPlaceholderProps {
    icon?: LucideIcon;
    title?: string;
    subtitle?: string;
    heightClass?: string;
    className?: string;
}

export const ChartPlaceholder = ({
    icon: Icon = TrendingUp,
    title = '暂无数据',
    subtitle = '等待采集新数据后展示图表',
    heightClass = 'h-52',
    className,
}: ChartPlaceholderProps) => (
    <div className={cn('flex items-center justify-center rounded-control border border-dashed border-line bg-panel/40 text-sm text-content-muted', heightClass, className)}>
        <div className="text-center">
            <Icon className="mx-auto mb-3 h-10 w-10 opacity-50"/>
            <p className="font-mono font-medium text-content-secondary">{title}</p>
            {subtitle && <p className="mt-1 font-mono text-xs text-content-muted">{subtitle}</p>}
        </div>
    </div>
);

interface EmptyStateProps {
    message?: string;
    showBackButton?: boolean;
    className?: string;
}

export const EmptyState = ({message = '监控数据不存在', showBackButton = false, className}: EmptyStateProps) => (
    <div className={cn('flex min-h-[50vh] items-center justify-center', className)}>
        <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-panel-muted text-content-muted">
                <AlertCircle className="h-8 w-8"/>
            </div>
            <p className="font-mono text-sm text-content-secondary">{message}</p>
            {showBackButton && (
                <button type="button" onClick={() => window.history.back()} className="mt-2 text-sm font-medium text-brand hover:text-brand-hover hover:underline">
                    返回监控列表
                </button>
            )}
        </div>
    </div>
);

export const LoadingSpinner = ({message = '数据加载中，请稍候...'}: {message?: string}) => (
    <div className="flex h-[75vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-brand"/>
            <p className="font-mono text-sm text-content-secondary">{message}</p>
        </div>
    </div>
);
