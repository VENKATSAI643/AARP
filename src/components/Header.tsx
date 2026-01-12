import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="top-header">
      <div className="top-header__brand">
        {/* <span className="top-header__logo-dot" /> */}
        <span className="top-header__title">AARP</span>
      </div>

      <div className="top-header__actions">
        <button className="btn btn-light">Dashboard</button>
        <button className="btn btn-outline-light">Logout</button>
      </div>
    </header>
  );
};

export default Header;
