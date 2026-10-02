import {Heart} from 'lucide-react';
import {getRuntimeConfig} from '../api';
import PublicPageContainer from './PublicPageContainer';

const PublicFooter = () => {
    const currentYear = new Date().getFullYear();
    const runtime = getRuntimeConfig();
    const icpCode = runtime.system.icpCode;

    return (
        <footer className="border-t border-line bg-page transition-colors duration-300">
            <PublicPageContainer>
                <div className="py-6">
                    <div className="flex flex-col items-center justify-between gap-4 tabular-nums text-xs text-content-muted sm:flex-row">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <span className="text-content-secondary">© {currentYear}</span>
                            <span className="text-line-strong">|</span>
                            {/* GitHub 链接 */}
                            <a
                                href="https://github.com/dushixiang/pika"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-1.5 text-content-secondary transition-colors hover:text-brand-hover"
                                title="查看 GitHub 仓库"
                            >
                                <span className="underline decoration-line-strong underline-offset-2">Pika Monitor</span>
                            </a>
                            <span className="text-content-muted tracking-wider">{runtime.system.version}</span>
                            {/* ICP 备案号 */}
                            {icpCode && (
                                <>
                                    <span className="text-line-strong">|</span>
                                    <a
                                        href="https://beian.miit.gov.cn"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-content-muted transition-colors hover:text-content-secondary"
                                    >
                                        {icpCode}
                                    </a>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 text-content-secondary">
                            <span>用</span>
                            <Heart className="h-3 w-3 animate-pulse fill-danger text-danger"/>
                            <span>构建</span>
                        </div>
                    </div>
                </div>
            </PublicPageContainer>
            <div className="h-px w-full bg-line"/>
        </footer>
    );
};

export default PublicFooter;
