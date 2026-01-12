import React from 'react';
import Header from '../components/Header';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="app-root">
      <Header />
      <main className="app-main">
        {children}
      </main>
    </div>
  );
};

export default Layout;
