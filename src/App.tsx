import React from 'react';
import Layout from './layout/Layout';
import ManageOnboarding from './pages/ManageOnboarding';

const App: React.FC = () => {
  return (
    <Layout>
      <ManageOnboarding />
    </Layout>
  );
};

export default App;
