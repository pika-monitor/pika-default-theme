import type {ReactNode} from 'react';
import {cn} from '../lib/utils';

interface PublicPageContainerProps {
    children: ReactNode;
    className?: string;
}

const PublicPageContainer = ({children, className}: PublicPageContainerProps) => (
    <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>
        {children}
    </div>
);

export default PublicPageContainer;
