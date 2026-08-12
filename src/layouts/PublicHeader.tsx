import {useEffect, useState} from 'react';
import {Activity, LogIn, Menu, Moon, ServerIcon, Settings, Sun, X} from 'lucide-react';
import {Link, NavLink} from 'react-router-dom';
import {getRuntimeConfig, pika} from '../api';
import {useColorMode} from '../contexts/ColorMode';
import {cn} from '../lib/utils';

const navigation = [
    {icon: ServerIcon, label: '设备监控', to: '/', end: true},
    {icon: Activity, label: '服务监控', to: '/monitors', end: false},
];

const navigationStyles = {
    desktop: {
        base: 'gap-2 border-b-2 border-transparent py-2',
        active: 'border-blue-600 text-blue-600 dark:border-slate-400 dark:text-slate-100',
        inactive: 'text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-slate-100',
    },
    mobile: {
        base: 'gap-3 rounded-lg border p-4',
        active: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
        inactive: 'border-slate-200 bg-white/60 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:bg-slate-800',
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
                        'flex items-center font-mono text-xs font-bold uppercase tracking-widest transition-colors',
                        styles.base,
                        isActive ? styles.active : styles.inactive,
                    )}
                >
                    <Icon className={mobile ? 'h-5 w-5' : 'h-4 w-4'}/>
                    <span>{label}</span>
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

    return (
        <time
            dateTime={currentTime.toISOString()}
            className="hidden flex-col items-end font-mono text-xs lg:flex"
        >
            <span className="font-bold text-slate-800 dark:text-slate-200">
                {currentTime.toLocaleTimeString()}
            </span>
            <span className="tracking-widest text-slate-500 dark:text-slate-400">
                {currentTime.toLocaleDateString()}
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
                'flex items-center justify-center font-bold uppercase tracking-wider text-cyan-600 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:text-cyan-400',
                mobile
                    ? 'w-full gap-3 rounded-lg bg-cyan-50 p-4 hover:bg-cyan-100 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20'
                    : 'gap-2 rounded bg-cyan-50 px-4 py-2 text-xs hover:bg-cyan-100 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20',
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
            <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl transition-colors duration-300 dark:border-slate-800 dark:bg-[#05050a]/80">
                <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4">
                    <div className="flex items-center gap-8">
                        <Link to="/" className="flex items-center gap-3">
                            <img
                                src="/api/logo"
                                className="h-8 w-8 rounded-md object-contain sm:h-9 sm:w-9"
                                alt="logo"
                                onError={(event) => {
                                    event.currentTarget.src = '/logo.png';
                                }}
                            />
                            <div>
                                <h1 className="bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 bg-clip-text text-2xl font-black uppercase italic tracking-widest text-transparent dark:from-cyan-400 dark:via-blue-400 dark:to-purple-400">
                                    {leftName}<span className="text-slate-800 dark:text-white">{rightName}</span>
                                </h1>
                                <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-cyan-500">
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
                            className="cursor-pointer rounded p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                            title={isDark ? '切换到浅色模式' : '切换到暗黑模式'}
                        >
                            <ThemeIcon className="h-4 w-4"/>
                        </button>

                        <AdminEntry isLoggedIn={isLoggedIn}/>
                    </div>

                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(open => !open)}
                        className="rounded p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
                        aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
                        aria-controls="public-mobile-menu"
                        aria-expanded={mobileMenuOpen}
                    >
                        {mobileMenuOpen ? <X className="h-6 w-6"/> : <Menu className="h-6 w-6"/>}
                    </button>
                </div>
            </header>

            {mobileMenuOpen && (
                <div
                    id="public-mobile-menu"
                    className="fixed inset-0 top-20 z-30 bg-white/95 backdrop-blur-xl dark:bg-[#05050a]/95 md:hidden"
                >
                    <div className="flex flex-col gap-4 p-4">
                        <PublicNavigation mobile onNavigate={() => setMobileMenuOpen(false)}/>

                        <div className="my-2 h-px bg-slate-200 dark:bg-slate-800"/>

                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="flex w-full items-center justify-center gap-3 rounded-lg bg-slate-100 p-4 font-bold uppercase tracking-wider text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
