import {useEffect, useState} from 'react';
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

const controlClass = 'rounded-control border border-line bg-panel px-3 py-1.5 font-mono text-xs font-medium text-content-secondary transition-colors hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export const TimeRangeSelector = ({value, onChange, options, enableCustom = false, customRange, onCustomRangeApply, className}: TimeRangeSelectorProps) => {
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
            <select value={showCustomOption ? 'custom' : value} onChange={(event) => event.target.value !== 'custom' && onChange(event.target.value)} className={controlClass}>
                {showCustomOption && <option value="custom" disabled>自定义</option>}
                {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {enableCustom && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-medium text-content-secondary">自定义</span>
                    <input type="datetime-local" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className={cn(controlClass, 'px-2 py-1')}/>
                    <span className="font-mono text-xs text-content-muted">至</span>
                    <input type="datetime-local" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className={cn(controlClass, 'px-2 py-1')}/>
                    <button
                        type="button"
                        disabled={!canApply}
                        onClick={() => {
                            if (!canApply || startMs === null || endMs === null) return;
                            onCustomRangeApply?.({start: startMs, end: endMs});
                            onChange('custom');
                        }}
                        className="rounded-control bg-brand px-3 py-1.5 font-mono text-xs font-bold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-panel-muted disabled:text-content-muted"
                    >
                        应用
                    </button>
                </div>
            )}
        </div>
    );
};
