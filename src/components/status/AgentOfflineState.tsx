import {UnlinkIcon} from 'lucide-react';

export const AgentOfflineState = ({compact = false}: {compact?: boolean}) => (
    <div
        role="status"
        title="探针连接已断开，正在等待重新连接"
        className="inline-flex w-fit items-center gap-2.5 text-danger"
    >
        <span className="relative flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden="true">
            <UnlinkIcon className="h-4 w-4"/>
            <span className="absolute right-0 top-0 h-1.5 w-1.5 animate-pulse rounded-full bg-danger"/>
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
            <span className="whitespace-nowrap text-xs font-semibold">连接已断开</span>
            {!compact && <span className="mt-0.5 whitespace-nowrap text-[10px] font-normal text-danger/70">等待重连</span>}
        </span>
    </div>
);
