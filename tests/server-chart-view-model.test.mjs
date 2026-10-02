import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/domain/agents/server-chart-view-model.ts', import.meta.url), 'utf8');
const {outputText} = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}});
const {getGpuSeries, buildGpuChartData, getMonitorSeries, buildMonitorChartData, reconcileMonitorSelection, formatMetricNumber} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const series = (id, name, data) => ({name: 'response_time', labels: {monitor_id: id, monitor_name: name}, data});
const point = (timestamp, value) => ({timestamp, value});

test('GPU index and metric type produce independent curves for multiple GPUs', () => {
    const curves = getGpuSeries(['0', '1'].flatMap(gpuIndex => ['utilization', 'temperature'].map((metricType, index) => ({
        name: `GPU_${gpuIndex}`, labels: {gpu_index: gpuIndex, metric_type: metricType}, data: [point(100, Number(gpuIndex) * 10 + index)],
    }))));
    assert.equal(curves.length, 4);
    const [row] = buildGpuChartData(curves);
    assert.equal(row.gpu_0_utilization, 0);
    assert.equal(row.gpu_0_temperature, 1);
    assert.equal(row.gpu_1_utilization, 10);
    assert.equal(row.gpu_1_temperature, 11);
});

test('GPU model accepts canonical names and rejects ambiguous old GPU series', () => {
    assert.equal(getGpuSeries([{name: 'utilization', data: [point(100, 0)]}])[0].gpuIndex, '0');
    assert.deepEqual(getGpuSeries([{name: 'GPU_0', data: [point(100, 50)]}]), []);
});

test('disjoint monitor ranges retain both curves and use null outside each range', () => {
    const curves = getMonitorSeries([series('a', 'A', [point(100, 10), point(200, 20)]), series('b', 'B', [point(300, 30), point(400, 40)])]);
    assert.deepEqual(buildMonitorChartData(curves, new Set(curves.map(entry => entry.key))), [
        {timestamp: 100, monitor_a: 10, monitor_b: null}, {timestamp: 200, monitor_a: 20, monitor_b: null},
        {timestamp: 300, monitor_a: null, monitor_b: 30}, {timestamp: 400, monitor_a: null, monitor_b: 40},
    ]);
});

test('single points and original peaks survive alignment', () => {
    const curves = getMonitorSeries([series('a', 'A', [point(100, 10), point(150, 999), point(200, 20)]), series('b', 'B', [point(175, 50)])]);
    const rows = buildMonitorChartData(curves, new Set(curves.map(entry => entry.key)));
    assert.equal(rows.find(row => row.timestamp === 150).monitor_a, 999);
    assert.equal(rows.find(row => row.timestamp === 175).monitor_b, 50);
    assert.equal(rows.find(row => row.timestamp === 175).monitor_a, 509.5);
    assert.equal(rows.find(row => row.timestamp === 200).monitor_b, null);
});

test('renaming a monitor changes its label without changing selection identity', () => {
    const before = getMonitorSeries([series('id', 'Before', [point(100, 10)])]);
    const after = getMonitorSeries([series('id', 'After', [point(100, 10)])]);
    assert.equal(before[0].key, after[0].key);
    assert.equal(after[0].name, 'After');
    assert.equal(buildMonitorChartData(after, new Set([before[0].key])).length, 1);
});

test('same display names do not merge different monitor IDs', () => {
    assert.equal(getMonitorSeries([series('a', 'Same', [point(100, 1)]), series('b', 'Same', [point(100, 2)])]).length, 2);
});

test('duplicate timestamps and invalid values do not create NaN chart data', () => {
    const curves = getMonitorSeries([series('a', 'A', [point(200, 2), point(100, 1), point(100, 3), point(150, NaN), point(Infinity, 4)])]);
    assert.deepEqual(curves[0].points, [point(100, 3), point(200, 2)]);
});

test('selection follows additions and removals while preserving an intentional subset', () => {
    const keys = new Set(['a', 'b']);
    assert.deepEqual(reconcileMonitorSelection(keys, new Set(['a', 'b', 'c']), keys), new Set(['a', 'b', 'c']));
    assert.deepEqual(reconcileMonitorSelection(keys, new Set(['a', 'b', 'c']), new Set(['a'])), new Set(['a']));
    assert.deepEqual(reconcileMonitorSelection(keys, new Set(['b']), new Set(['a'])), new Set(['b']));
    assert.deepEqual(reconcileMonitorSelection(keys, keys, new Set()), new Set());
});

test('missing or non-finite values are distinct from measured zero', () => {
    for (const value of [undefined, null, NaN, Infinity]) assert.equal(formatMetricNumber(value, 1, '%'), '—');
    assert.equal(formatMetricNumber(0, 1, '%'), '0.0%');
    assert.equal(formatMetricNumber(0, 2), '0.00');
});
