import React from 'react';
import { RiceProvider } from '@/contexts/RiceContext';
import RiceDashboard from '@/components/RiceDashboard';

const Index: React.FC = () => {
  return (
    <RiceProvider>
      <RiceDashboard />
    </RiceProvider>
  );
};

export default Index;
