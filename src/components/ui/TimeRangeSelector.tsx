import {useEffect, useId, useState} from 'react';
import type {TimeRangeOption} from '../../types';
import {cn} from '../../lib/utils';

interface CustomRange {start: number; end: number}

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
    return Number.isNaN(timestamp) ? null : timestamp;
};

const toDateTimeLocal = (timestamp: number): string => {
    const date = new Date(timestamp);
    return new Date(timestamp - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const controlClass = 'rounded-control border border-line bg-panel px-3 py-1.5 text-sm font-medium text-content-secondary transition-colors hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export const TimeRangeSelector = ({value, onChange, options, enableCustom = false, customRange, onCustomRangeApply, className}: TimeRangeSelectorProps) => {
    const idPrefix = useId();
    const [customOpen, setCustomOpen] = useState(false);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    useEffect(() => {
        if (customRange?.start) setCustomStart(toDateTimeLocal(customRange.start));
        if (customRange?.end) setCustomEnd(toDateTimeLocal(customRange.end));
    }, [customRange]);

    const startMs = parseDateTimeLocal(customStart);
    const endMs = parseDateTimeLocal(customEnd);
    const canApply = startMs !== null && endMs !== null && startMs < endMs;
    const showCustomOption = enableCustom && value === 'custom';

    return (
        <div className={cn('flex flex-wrap items-center gap-2', className)}>
            <label htmlFor={`${idPrefix}-range`} className="sr-only">时间范围</label>
            <select
                id={`${idPrefix}-range`}
                aria-label="时间范围"
                value={showCustomOption ? 'custom' : value}
                onChange={(event) => {
                    if (event.target.value === 'custom') return;
                    setCustomOpen(false);
                    onChange(event.target.value);
                }}
                className={controlClass}
            >
                {showCustomOption && <option value="custom" disabled>自定义</option>}
                {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {enableCustom && (
                <button
                    type="button"
                    aria-expanded={customOpen}
                    aria-controls={`${idPrefix}-custom-range`}
                    onClick={() => setCustomOpen(open => !open)}
                    className={cn(controlClass, customOpen && 'border-brand/30 bg-brand-muted text-brand')}
                >
                    {showCustomOption ? '调整自定义范围' : '自定义时间'}
                </button>
            )}
            {enableCustom && customOpen && (
                <div id={`${idPrefix}-custom-range`} className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                    <label htmlFor={`${idPrefix}-start`} className="sr-only">开始时间</label>
                    <input id={`${idPrefix}-start`} aria-label="开始时间" type="datetime-local" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className={cn(controlClass, 'px-2 py-1')}/>
                    <span className="text-sm text-content-muted">至</span>
                    <label htmlFor={`${idPrefix}-end`} className="sr-only">结束时间</label>
                    <input id={`${idPrefix}-end`} aria-label="结束时间" type="datetime-local" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className={cn(controlClass, 'px-2 py-1')}/>
                    <button
                        type="button"
                        onClick={() => setCustomOpen(false)}
                        className="rounded-control border border-line bg-panel px-3 py-1.5 text-sm font-medium text-content-secondary transition-colors hover:bg-panel-hover hover:text-content"
                    >
                        取消
                    </button>
                    <button
                        type="button"
                        disabled={!canApply}
                        onClick={() => {
                            if (!canApply || startMs === null || endMs === null) return;
                            onCustomRangeApply?.({start: startMs, end: endMs});
                            onChange('custom');
                            setCustomOpen(false);
                        }}
                        className="rounded-control bg-brand px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-panel-muted disabled:text-content-muted"
                    >
                        应用
                    </button>
                </div>
            )}
        </div>
    );
};
