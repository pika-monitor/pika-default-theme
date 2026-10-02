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
        liveHistory: 10000,
        metadata: 30000,
    });
    assert.ok(POLLING_INTERVALS.latestMetrics <= POLLING_INTERVALS.liveHistory);
    assert.ok(POLLING_INTERVALS.serverList <= POLLING_INTERVALS.metadata);
});

test('latest mode is described as automatic refresh without changing its value', () => {
    assert.equal(SERVER_TIME_RANGE_OPTIONS.find(option => option.value === LIVE_RANGE)?.label, '自动刷新');
    assert.equal(LIVE_RANGE, 'live');
});
