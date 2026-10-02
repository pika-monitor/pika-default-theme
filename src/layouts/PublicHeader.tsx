import {useEffect, useState} from 'react';
import {Activity, LogIn, Menu, Moon, ServerIcon, Settings, Sun, X} from 'lucide-react';
import {Link, NavLink} from 'react-router-dom';
import {getRuntimeConfig, pika} from '../api';
import {useColorMode} from '../contexts/ColorMode';
import {cn} from '../lib/utils';
import PublicPageContainer from './PublicPageContainer';

const navigation = [
    {icon: ServerIcon, label: '设备监控', to: '/', end: true},
    {icon: Activity, label: '服务监控', to: '/monitors', end: false},
];

const navigationStyles = {
    desktop: {
        base: 'w-24 justify-center gap-2 py-2',
        active: 'text-brand',
        inactive: 'text-content-muted hover:text-content',
    },
    mobile: {
        base: 'gap-3 rounded-control border p-4',
        active: 'border-brand/25 bg-brand-muted text-brand',
        inactive: 'border-line bg-panel text-content-secondary hover:border-line-strong hover:bg-panel-hover hover:text-content',
    },
};

const splitSystemName = (name: string) => {
    if (!name) {
        return ['', ''] as const;
    }

    const spaceIndex = name.indexOf(' ');
    const splitIndex = spaceIndex > 0 ? spaceIndex : Math.floor(name.length / 2);
    return [name.slice(0, splitIndex), name.slice(splitIndex)] as const;
};

interface NavigationProps {
    mobile?: boolean;
    onNavigate?: () => void;
}

interface AdminEntryProps {
    isLoggedIn: boolean;
    mobile?: boolean;
}

const PublicNavigation = ({mobile = false, onNavigate}: NavigationProps) => (
    <nav className={mobile ? 'flex flex-col gap-3' : 'hidden items-center gap-8 md:flex'}>
        {navigation.map(({icon: Icon, label, to, end}) => {
            const styles = mobile ? navigationStyles.mobile : navigationStyles.desktop;

            return (
                <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className={({isActive}) => cn(
                        'flex items-center text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                        styles.base,
                        isActive ? styles.active : styles.inactive,
                    )}
                >
                    {({isActive}) => (
                        <>
                            <Icon className={mobile ? 'h-5 w-5' : 'h-4 w-4'}/>
                            <span className={cn(
                                !mobile && 'relative after:absolute after:-bottom-2 after:inset-x-0 after:h-0.5 after:rounded-full after:transition-colors after:duration-200 after:content-[""]',
                                !mobile && (isActive ? 'after:bg-brand' : 'after:bg-transparent'),
                            )}>{label}</span>
                        </>
                    )}
                </NavLink>
            );
        })}
    </nav>
);

const HeaderClock = () => {
    const [currentTime, setCurrentTime] = useState(() => new Date());

    useEffect(() => {
        const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return (
        <time
            dateTime={currentTime.toISOString()}
            title={`当前浏览器时区：${timeZone}`}
            className="hidden flex-col items-end tabular-nums text-xs xl:flex"
        >
            <span className="font-bold text-content">
                {currentTime.toLocaleTimeString()}
            </span>
            <span className="tracking-wide text-content-muted">
                {currentTime.toLocaleDateString()} · {timeZone.replace('_', ' ')}
            </span>
        </time>
    );
};

const AdminEntry = ({isLoggedIn, mobile = false}: AdminEntryProps) => {
    const Icon = isLoggedIn ? Settings : LogIn;

    return (
        <a
            href={isLoggedIn ? '/admin/' : '/admin/login'}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                'flex items-center justify-center font-bold uppercase tracking-wider text-brand transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                mobile
                    ? 'w-full gap-3 rounded-control bg-brand-muted p-4 hover:bg-blue-100 dark:hover:bg-blue-500/20'
                    : 'gap-2 rounded-control bg-brand-muted px-4 py-2 text-xs hover:bg-blue-100 dark:hover:bg-blue-500/20',
            )}
            title={isLoggedIn ? '打开管理后台' : '登录管理后台'}
        >
            <Icon className={mobile ? 'h-5 w-5' : 'h-3 w-3'}/>
            <span>{isLoggedIn ? (mobile ? '管理后台' : 'Admin') : (mobile ? '登录' : 'Login')}</span>
        </a>
    );
};

const PublicHeader = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [runtime] = useState(getRuntimeConfig);
    const {resolvedColorMode, setColorMode} = useColorMode();
    const [leftName, rightName] = splitSystemName(runtime.system.nameEn);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userInfo = localStorage.getItem('userInfo');

        if (!token || !userInfo) {
            return;
        }

        let mounted = true;

        pika.getCurrentUser()
            .then(() => {
                if (mounted) {
                    setIsLoggedIn(true);
                }
            })
            .catch(() => {
                if (!mounted) {
                    return;
                }

                localStorage.removeItem('token');
                localStorage.removeItem('userInfo');
                setIsLoggedIn(false);
            });

        return () => {
            mounted = false;
        };
    }, []);

    const isDark = resolvedColorMode === 'dark';
    const ThemeIcon = isDark ? Sun : Moon;
    const toggleTheme = () => setColorMode(isDark ? 'light' : 'dark');

    return (
        <>
            <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-white transition-colors duration-300 dark:bg-slate-950">
                <PublicPageContainer className="flex h-20 items-center justify-between">
                    <div className="flex min-w-0 items-center gap-8">
                        <Link to="/" className="flex min-w-0 items-center gap-3" aria-label={`${runtime.system.nameZh}首页`}>
                            <img
                                src="/api/logo"
                                className="h-8 w-8 shrink-0 rounded-md object-contain sm:h-9 sm:w-9"
                                alt="logo"
                                onError={(event) => {
                                    event.currentTarget.src = '/logo.png';
                                }}
                            />
                            <div className="min-w-0">
                                <h1 className="truncate text-xl font-black uppercase italic tracking-widest text-content sm:text-2xl">
                                    <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-700 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-blue-300">{leftName}</span>{rightName}
                                </h1>
                                <p className="mt-0.5 truncate text-sm font-medium leading-5 tracking-[0.16em] text-blue-600 dark:text-blue-400 sm:tracking-[0.2em]">
                                    {runtime.system.nameZh}
                                </p>
                            </div>
                        </Link>

                        <PublicNavigation/>
                    </div>

                    <div className="hidden items-center gap-2 md:flex">
                        <HeaderClock/>
                        <div className="hidden h-6 w-px bg-slate-300 dark:bg-slate-700 lg:block"/>

                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="cursor-pointer rounded-control p-2 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:text-slate-300 dark:hover:bg-slate-800"
                            title={isDark ? '切换到浅色模式' : '切换到暗黑模式'}
                        >
                            <ThemeIcon className="h-4 w-4"/>
                        </button>

                        <AdminEntry isLoggedIn={isLoggedIn}/>
                    </div>

                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(open => !open)}
                        className="rounded-control p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
                        aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
                        aria-controls="public-mobile-menu"
                        aria-expanded={mobileMenuOpen}
                    >
                        {mobileMenuOpen ? <X className="h-6 w-6"/> : <Menu className="h-6 w-6"/>}
                    </button>
                </PublicPageContainer>
            </header>

            {mobileMenuOpen && (
                <div
                    id="public-mobile-menu"
                    className="fixed inset-0 top-20 z-30 bg-white dark:bg-slate-950 md:hidden"
                >
                    <div className="flex flex-col gap-4 p-4">
                        <PublicNavigation mobile onNavigate={() => setMobileMenuOpen(false)}/>

                        <div className="my-2 h-px bg-slate-200 dark:bg-slate-800"/>

                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="flex w-full items-center justify-center gap-3 rounded-control bg-slate-100 p-4 font-bold uppercase tracking-wider text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                            <ThemeIcon className="h-5 w-5"/>
                            <span>{isDark ? '切换到浅色模式' : '切换到暗黑模式'}</span>
                        </button>

                        <AdminEntry isLoggedIn={isLoggedIn} mobile/>
                    </div>
                </div>
            )}
        </>
    );
};

export default PublicHeader;
