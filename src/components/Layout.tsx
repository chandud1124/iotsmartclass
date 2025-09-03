
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useIsMobile } from '@/hooks/use-mobile';

export const Layout = () => {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background w-full">
      <div className="flex h-screen w-full min-w-0">
        <Sidebar className={`${isMobile ? 'hidden' : 'flex-shrink-0 block'}`} />
        <div className="flex-1 flex flex-col min-w-0 relative ml-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 min-h-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};