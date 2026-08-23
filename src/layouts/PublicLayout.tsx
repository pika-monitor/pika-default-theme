import {Outlet} from 'react-router-dom';
import PublicFooter from './PublicFooter';
import PublicHeader from './PublicHeader';

const PublicLayout = () => {
    return (
        <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-page text-content transition-colors duration-500">
            {/* 浅色网格 */}
            <div
                className="pointer-events-none fixed inset-0 z-0 opacity-60 transition-opacity duration-500 dark:opacity-0"
                style={{
                    backgroundImage: 'linear-gradient(to right, rgb(203 213 225 / 50%) 1px, transparent 1px), linear-gradient(to bottom, rgb(203 213 225 / 50%) 1px, transparent 1px)',
                    backgroundSize: '30px 30px',
                }}
            />
            {/* 浅色页面保留很弱的顶部层次，暗色模式使用纯净背景。 */}
            <div
                className="pointer-events-none fixed left-1/2 top-0 z-0 h-[300px] w-[1000px] -translate-x-1/2 rounded-full bg-blue-500/10 opacity-40 blur-[120px] transition-opacity duration-500 dark:opacity-0"
            />

            <PublicHeader/>
            <div className="relative z-10 flex min-h-screen flex-col pt-[81px]">
                <main className="flex-1">
                    <Outlet/>
                </main>
                <PublicFooter/>
            </div>
        </div>
    );
};

export default PublicLayout;
