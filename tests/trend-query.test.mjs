import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import {QueryClient, QueryObserver} from '@tanstack/react-query';

const moduleURL = async (path, imports = {}) => {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    let {outputText} = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}});
    for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(`from '${name}'`, `from '${url}'`);
    return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
};
const hooksURL = await moduleURL('../src/hooks/index.ts', {
    react: import.meta.resolve('react'),
    '@tanstack/react-query': import.meta.resolve('@tanstack/react-query'),
    '../api': await moduleURL('../src/api.ts'),
    '../constants': await moduleURL('../src/constants.ts'),
});
const {getTrendMetricsQueryOptions} = await import(hooksURL);
const options = (overrides = {}) => getTrendMetricsQueryOptions({agentId: 'a', type: 'cpu', timeRange: 'live', ...overrides});
const response = timestamps => ({agentId: 'a', generatedAt: 300000, start: 0, end: 300000, monitorStart: -600000, series: {cpu: [{name: 'usage', data: timestamps.map(timestamp => ({timestamp, value: timestamp === 4000 ? 99 : 1}))}]}, latestSampleAt: {cpu: timestamps.at(-1)}});

const fixture = t => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
    const observer = new QueryObserver(client, options());
    t.after(() => {observer.destroy(); client.clear();});
    return observer;
};

test('real-time queries share a batch at 2s; history and custom ranges do not poll', () => {
    const live = options();
    assert.equal(live.queryKey.at(-1), 'live');
    assert.deepEqual(options({type:'network', interfaceName:'eth0'}).queryKey, live.queryKey);
    assert.equal(live.refetchInterval, 2000);
    assert.equal(live.refetchOnWindowFocus, true);
    assert.equal(live.refetchOnReconnect, true);
    assert.equal(live.refetchOnMount, 'always');
    assert.equal(options({timeRange: '15m'}).refetchInterval, false);
    assert.equal(options({liveEnabled:false}).refetchInterval, false);
    assert.equal(options({liveEnabled:false}).enabled, true);
    const custom = options({timeRange: 'custom', start: 1000, end: 2000});
    assert.deepEqual(custom.queryKey.at(-1), {type: 'cpu', range: undefined, start: 1000, end: 2000, interface: undefined});
});

test('a refresh recovers middle samples and their peaks, and replaces expired window data', async t => {
    const observer = fixture(t);
    const windows = [response([2000, 6000]), response([2000, 4000, 6000, 8000]), response([6000, 8000, 10000])];
    t.mock.method(globalThis, 'fetch', async (url, init) => {
        assert.equal(url, '/api/agents/a/metrics/live');
        assert.ok(init.signal instanceof AbortSignal);
        return Response.json(windows.shift());
    });
    await observer.refetch();
    const recovered = (await observer.refetch()).data.series[0].data;
    assert.deepEqual(recovered.map(point => point.timestamp), [2000, 4000, 6000, 8000]);
    assert.equal(recovered[1].value, 99);
    assert.deepEqual((await observer.refetch()).data.series[0].data.map(point => point.timestamp), [6000, 8000, 10000]);
});

test('a failed refresh retains the last window; recovery fills missed samples', async t => {
    const observer = fixture(t);
    let call = 0;
    t.mock.method(globalThis, 'fetch', async () => {
        call++;
        if (call === 2) throw new Error('temporary outage');
        return Response.json(response(call === 1 ? [2000] : [2000, 4000, 6000]));
    });
    await observer.refetch();
    const failed = await observer.refetch();
    assert.equal(failed.isError, true);
    assert.deepEqual(failed.data.series[0].data.map(point => point.timestamp), [2000]);
    assert.deepEqual((await observer.refetch()).data.series[0].data.map(point => point.timestamp), [2000, 4000, 6000]);
});

test('switching device aborts an obsolete request and isolates its cache', async t => {
    const observer = fixture(t);
    let obsoleteSignal;
    t.mock.method(globalThis, 'fetch', (url, init) => {
        if (url.includes('/agents/b/')) return Promise.resolve(Response.json(response([8000])));
        obsoleteSignal = init.signal;
        return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {once: true}));
    });
    const unsubscribe = observer.subscribe(() => {});
    t.after(unsubscribe);
    observer.setOptions(options({agentId:'b'}));
    assert.equal(obsoleteSignal.aborted, true);
    const result = await observer.refetch();
    assert.deepEqual(result.data.series[0].data.map(point => point.timestamp), [8000]);
});

test('all resource observers share one HTTP request and interface switches only select cached samples', async t => {
    const client = new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
    t.after(() => client.clear());
    let requests = 0;
    const batch = {...response([2000]), series:{...response([2000]).series, network:[
        {name:'upload',labels:{interface:'eth0'},data:[{timestamp:2000,value:10}]},
        {name:'upload',labels:{interface:'eth1'},data:[{timestamp:2000,value:20}]},
        {name:'upload',labels:{interface:''},data:[{timestamp:2000,value:30}]},
    ],monitor:[]}};
    t.mock.method(globalThis,'fetch',async()=>{requests++; return Response.json(batch)});
    const observers = ['cpu','memory','disk_io','network','network_connection','gpu','temperature','monitor'].map(type=>new QueryObserver(client,options({type})));
    const results = await Promise.all(observers.map(observer=>observer.refetch()));
    assert.equal(requests,1);
    assert.equal(results[3].data.series[0].data[0].value,30);
    assert.equal(results[0].data.start,0);
    assert.equal(results[7].data.start,-600000);
    const network=observers[3];
    network.setOptions(options({type:'network',interfaceName:'eth1'}));
    assert.equal(network.getCurrentResult().data.series[0].data[0].value,20);
    assert.equal(requests,1);
    observers.forEach(observer=>observer.destroy());
});
