import {type ReactNode, useEffect, useState} from 'react';
import {AlertCircle, Loader2, TrendingUp} from 'lucide-react';
import dayjs from 'dayjs';
import type {TimeRangeOption} from './types';
import {cn} from './lib/utils';

/* ========================================== Card ========================================== */

interface CardProps {
    title?: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    interactive?: boolean;
}

export const Card = ({title, description, action, children, className, interactive}: CardProps) => {
    const hasHeader = title || description || action;

    return (
        <div className={cn(
            'group relative overflow-hidden rounded-xl border border-slate-200 bg-white/90 shadow-sm backdrop-blur-md transition-all duration-300 dark:rounded-none dark:border-cyan-500/20 dark:bg-[#0f1016]/80 dark:shadow-[0_0_15px_rgba(6,182,212,0.05)]',
            interactive && 'cursor-pointer hover:border-slate-300 hover:bg-white dark:hover:border-cyan-500/50 dark:hover:bg-[#0f1016]/90',
        )}>
            <span className="hidden dark:block absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-500/30 group-hover:border-cyan-400 transition-colors duration-300"/>
            <span className="hidden dark:block absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-500/30 group-hover:border-cyan-400 transition-colors duration-300"/>
            <span className="hidden dark:block absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-500/30 group-hover:border-cyan-400 transition-colors duration-300"/>
            <span className="hidden dark:block absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-500/30 group-hover:border-cyan-400 transition-colors duration-300"/>
            {interactive && (
                <span className="hidden dark:block absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 -translate-y-full group-hover:translate-y-full transition-[transform,opacity] duration-1000 ease-in-out pointer-events-none will-change-transform"/>
            )}

            <div className={cn('relative z-10', hasHeader ? 'p-6' : 'p-4', className)}>
                {hasHeader && (
                    <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-700 pb-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            {title && <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>}
                            {description && <p className="mt-1 text-xs font-mono text-gray-600 dark:text-cyan-500">{description}</p>}
                        </div>
                        {action && <div className="shrink-0">{action}</div>}
                    </div>
                )}
                <div className={cn(hasHeader && 'pt-4')}>
                    {children}
                </div>
            </div>
        </div>
    );
};

/* ========================================== ChartPlaceholder ========================================== */

interface ChartPlaceholderProps {
    icon?: typeof TrendingUp;
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
                                 }: ChartPlaceholderProps) => {
    return (
        <div className={cn(
            "flex items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400",
            heightClass,
            className
        )}>
            <div className="text-center">
                <Icon className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600"/>
                <p className="font-medium">{title}</p>
                {subtitle && (
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    );
};

/* ========================================== CustomTooltip ========================================== */

type CustomTooltipProps = {
    active?: boolean;
    payload?: Array<{
        name?: string;
        value?: number;
        color?: string;
        dataKey?: string;
        payload?: {
            timestamp?: number | string;
            [key: string]: unknown;
        };
    }>;
    label?: string | number;
    unit?: string;
    className?: string;
    timeFormat?: string;
};

export const CustomTooltip = ({active, payload, label, unit = '%', className, timeFormat = 'MM-DD HH:mm'}: CustomTooltipProps) => {
    if (!active || !payload || payload.length === 0) {
        return null;
    }

    // 从 payload 中获取完整的时间戳信息（如果有的话）
    const fullTimestamp = payload[0]?.payload?.timestamp;
    const displayLabel = fullTimestamp
        ? dayjs(fullTimestamp).format(timeFormat)
        : label;

    return (
        <div className={cn(
            "rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg px-3 py-2 text-xs",
            className
        )}>
            <p className="font-semibold text-slate-700 dark:text-white mb-2">
                {displayLabel}
            </p>
            <div className="space-y-1">
                {payload.map((entry, index) => {
                    if (!entry) {
                        return null;
                    }

                    const dotColor = entry.color ?? '#6366f1';
                    const title = entry.name ?? entry.dataKey ?? `系列 ${index + 1}`;
                    const value = typeof entry.value === 'number'
                        ? Number.isFinite(entry.value)
                            ? entry.value.toFixed(2)
                            : '-'
                        : entry.value;

                    return (
                        <p key={`${entry.dataKey ?? index}`} className="flex items-center gap-2 text-xs">
                            <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{backgroundColor: dotColor}}
                            />
                            <span className="text-slate-600 dark:text-slate-400">
                                {title}: <span className="font-semibold text-slate-900 dark:text-white">{value}{unit}</span>
                            </span>
                        </p>
                    );
                })}
            </div>
        </div>
    );
};

/* ========================================== EmptyState ========================================== */

interface EmptyStateProps {
    message?: string;
    showBackButton?: boolean;
    className?: string;
}

export const EmptyState = ({message = '监控数据不存在', showBackButton = false, className}: EmptyStateProps) => {
    return (
        <div className={cn(
            "flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900",
            className
        )}>
            <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                    <AlertCircle className="h-8 w-8"/>
                </div>
                <p className="text-sm font-mono text-slate-600 dark:text-slate-400">
                    {message}
                </p>
                {showBackButton && (
                    <button
                        onClick={() => window.history.back()}
                        className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        返回监控列表
                    </button>
                )}
            </div>
        </div>
    );
};

/* ========================================== LoadingSpinner ========================================== */

interface LoadingSpinnerProps {
    message?: string;
}

export const LoadingSpinner = ({message}: LoadingSpinnerProps) => {

    return (
        <div className={cn(
            "flex h-[75vh] items-center justify-center bg-slate-50 dark:bg-[#05050a]",
        )}>
            <div className="flex flex-col items-center gap-3">
                <Loader2 className={"h-8 w-8 animate-spin text-blue-500 dark:text-cyan-500"}/>
                <p className={cn(
                    "text-sm font-mono text-slate-500 dark:text-cyan-400",
                )}>
                    {message || '数据加载中，请稍候...'}
                </p>
            </div>
        </div>
    );
};

/* ========================================== MetricItem ========================================== */

// 统计卡片组件
export const MetricItem = ({
                      label,
                      value,
                  }: {
    label: string;
    value: string | number;
}) => (
    <div
        key={label}
        className="rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-cyan-900/50 p-4 text-left hover:border-slate-300 dark:hover:border-cyan-700/50 transition"
    >
        <p className="text-sm uppercase tracking-[0.3em] text-gray-700 dark:text-cyan-500 font-mono font-bold">{label}</p>
        <p className="mt-2 text-base font-semibold text-slate-800 dark:text-cyan-100">{value}</p>
    </div>
);

/* ========================================== StatBlock ========================================== */

// 统计卡片组件
interface StatBlockProps {
    title: string;
    value: any;
    unit?: string
    icon: any;
    color: string;
    alert?: boolean,
    glow?: boolean,
}

export const StatBlock = ({title, value, unit, icon: Icon, color, alert, glow}: StatBlockProps) => {

    const colorMap = {
        cyan: 'dark:text-cyan-400 dark:border-cyan-500/30 dark:bg-cyan-500/5',
        emerald: 'dark:text-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-500/5',
        rose: 'dark:text-rose-400 dark:border-rose-500/30 dark:bg-rose-500/5',
        purple: 'dark:text-purple-400 dark:border-purple-500/30 dark:bg-purple-500/5'
    };
    const style = colorMap[color] || colorMap.cyan;

    const iconColor = {
        cyan: 'text-cyan-400',
        emerald: 'text-emerald-400',
        rose: 'text-rose-400',
        purple: 'text-purple-400'
    }
    let iconStyle = iconColor[color] || colorMap.cyan;

    return (
        <div
            className={cn(
                `relative overflow-hidden rounded-xl border p-5`,
                'bg-white/80 backdrop-blur-md border border-slate-200 shadow-sm',
                style,
                alert && 'animate-pulse bg-rose-500/10',
                glow && 'shadow-[0_0_20px_rgba(16,185,129,0.1)]',
            )}>
            <div className="absolute -right-4 -bottom-4 opacity-10 rotate-[-15deg]"><Icon className="w-24 h-24"/></div>
            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <div className="text-xs font-bold font-mono uppercase tracking-widest opacity-70 mb-2">{title}</div>
                    <div className="text-4xl font-black tracking-tight flex items-baseline gap-1">{value}{unit &&
                        <span className="text-sm font-normal opacity-60 ml-1">{unit}</span>}</div>
                </div>
                <div className={`p-3`}>
                    <Icon className={cn("w-6 h-6", iconStyle)}/>
                </div>
            </div>
        </div>
    );
};

/* ========================================== StatusBadge ========================================== */

interface StatusBadgeProps {
    status: string;
}

export const StatusBadge = ({status}: StatusBadgeProps) => {
    const styles = {
        up: "bg-emerald-500/10 dark:bg-emerald-500/10 text-emerald-400 dark:text-emerald-400 border-emerald-500/80",
        down: "bg-rose-500/10 dark:bg-rose-500/10 text-rose-400 dark:text-rose-400 border-rose-500/80",
        unknown: "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    };

    const labels = {
        up: "正常",
        down: "异常",
        unknown: "未知",
    };

    const style = styles[status as keyof typeof styles] || styles.unknown;
    const label = labels[status as keyof typeof labels] || labels.unknown;


    return (
        <span
            className={cn("px-2.5 py-0.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 w-fit", style)}>
            <span className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                status === 'up' ? 'bg-emerald-500 dark:bg-emerald-400' :
                    status === 'down' ? 'bg-rose-500 dark:bg-rose-400' :
                        'bg-slate-400 dark:bg-slate-400'
            )}/>
            {label}
        </span>


    );
};

/* ========================================== TimeRangeSelector ========================================== */

interface CustomRange {
    start: number;
    end: number;
}

interface TimeRangeSelectorProps {
    value: string;
    onChange: (value: string) => void;
    options: readonly TimeRangeOption[];
    enableCustom?: boolean;
    customRange?: CustomRange | null;
    onCustomRangeApply?: (range: CustomRange) => void;
    className?: string;
}

const parseDateTimeLocal = (value: string): number | null => {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) {
        return null;
    }
    return timestamp;
};

const toDateTimeLocal = (timestamp: number): string => {
    const date = new Date(timestamp);
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(timestamp - offsetMs).toISOString().slice(0, 16);
};

export const TimeRangeSelector = ({
                                      value,
                                      onChange,
                                      options,
                                      enableCustom = false,
                                      customRange,
                                      onCustomRangeApply,
                                      className,
                                  }: TimeRangeSelectorProps) => {
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    useEffect(() => {
        if (customRange?.start) {
            setCustomStart(toDateTimeLocal(customRange.start));
        }
        if (customRange?.end) {
            setCustomEnd(toDateTimeLocal(customRange.end));
        }
    }, [customRange]);

    const startMs = parseDateTimeLocal(customStart);
    const endMs = parseDateTimeLocal(customEnd);
    const canApply = startMs !== null && endMs !== null && startMs < endMs;
    const showCustomOption = enableCustom && value === 'custom';

    return (
        <div className={cn("flex flex-wrap items-center gap-2", className)}>
            <select
                value={showCustomOption ? 'custom' : value}
                onChange={(event) => {
                    const nextValue = event.target.value;
                    if (nextValue === 'custom') {
                        return;
                    }
                    onChange(nextValue);
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-600 focus:border-blue-400 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/30 px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap"
            >
                {showCustomOption && (
                    <option value="custom" disabled>
                        自定义
                    </option>
                )}
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {enableCustom && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        自定义
                    </span>
                    <input
                        type="datetime-local"
                        value={customStart}
                        onChange={(event) => setCustomStart(event.target.value)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/30 px-2 py-1 text-xs font-medium"
                    />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        至
                    </span>
                    <input
                        type="datetime-local"
                        value={customEnd}
                        onChange={(event) => setCustomEnd(event.target.value)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/30 px-2 py-1 text-xs font-medium"
                    />
                    <button
                        type="button"
                        onClick={() => {
                            if (!canApply || startMs === null || endMs === null) return;
                            onCustomRangeApply?.({start: startMs, end: endMs});
                            onChange("custom");
                        }}
                        disabled={!canApply}
                        className={cn(
                            "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
                            canApply
                                ? "border-blue-500 dark:border-blue-500 bg-blue-500 dark:bg-blue-600 text-white shadow-sm hover:bg-blue-600 dark:hover:bg-blue-700"
                                : "border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                        )}
                    >
                        应用
                    </button>
                </div>
            )}
        </div>
    );
};
