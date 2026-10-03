import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/constants.ts', import.meta.url), 'utf8');
const {outputText} = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}});
const {POLLING_INTERVALS, LIVE_RANGE, SERVER_TIME_RANGE_OPTIONS} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('polling intervals distinguish live metrics, lists and metadata', () => {
    assert.deepEqual(POLLING_INTERVALS, {
        serverList: 5000,
        latestMetrics: 5000,
        liveHistory: 2000,
        metadata: 30000,
    });
    assert.equal(POLLING_INTERVALS.liveHistory, 2000);
    assert.ok(POLLING_INTERVALS.serverList <= POLLING_INTERVALS.metadata);
});

test('live mode retains its real-time label and value', () => {
    assert.equal(SERVER_TIME_RANGE_OPTIONS.find(option => option.value === LIVE_RANGE)?.label, '实时');
    assert.equal(LIVE_RANGE, 'live');
});
