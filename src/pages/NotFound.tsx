import {ArrowLeft, SearchX} from 'lucide-react';
import {Link} from 'react-router-dom';
import PublicPageContainer from '../layouts/PublicPageContainer';

const NotFound = () => (
    <PublicPageContainer className="flex min-h-[60vh] items-center justify-center py-10">
        <section className="flex max-w-md flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-panel-muted text-content-muted">
                <SearchX className="h-8 w-8"/>
            </div>
            <p className="mt-5 tabular-nums text-xs font-semibold uppercase tracking-[0.24em] text-brand">404</p>
            <h1 className="mt-2 text-2xl font-bold text-content">页面不存在</h1>
            <p className="mt-2 text-sm text-content-secondary">访问地址可能已失效，或者页面已经被移动。</p>
            <Link
                to="/"
                className="mt-6 inline-flex items-center gap-2 rounded-control bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
                <ArrowLeft className="h-4 w-4"/>
                返回概览
            </Link>
        </section>
    </PublicPageContainer>
);

export default NotFound;
