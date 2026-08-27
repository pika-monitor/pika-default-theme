import {lazy, Suspense, type ReactNode} from 'react';
import {BrowserRouter, Route, Routes} from 'react-router-dom';
import {ColorModeProvider} from './contexts/ColorMode';
import PublicLayout from './layouts/PublicLayout';

const ServerList = lazy(() => import('./pages/ServerList'));
const ServerDetail = lazy(() => import('./pages/ServerDetail'));
const MonitorList = lazy(() => import('./pages/MonitorList'));
const MonitorDetail = lazy(() => import('./pages/MonitorDetail'));
const NotFound = lazy(() => import('./pages/NotFound'));

const pageFallback = (
    <div className="flex min-h-[50vh] items-center justify-center text-content-secondary">
        页面加载中...
    </div>
);

const withPageFallback = (page: ReactNode) => (
    <Suspense fallback={pageFallback}>{page}</Suspense>
);

export default function PortalApp() {
    return (
        <ColorModeProvider>
            <BrowserRouter>
                <Routes>
                    <Route element={<PublicLayout/>}>
                        <Route path="/" element={withPageFallback(<ServerList/>)}/>
                        <Route path="/servers/:id" element={withPageFallback(<ServerDetail/>)}/>
                        <Route path="/monitors" element={withPageFallback(<MonitorList/>)}/>
                        <Route path="/monitors/:id" element={withPageFallback(<MonitorDetail/>)}/>
                        <Route path="*" element={withPageFallback(<NotFound/>)}/>
                    </Route>
                </Routes>
            </BrowserRouter>
        </ColorModeProvider>
    );
}
