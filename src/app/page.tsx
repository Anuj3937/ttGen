'use client';

import { TimetableProvider } from '@/context/TimetableContext';
import Header from '@/components/layout/Header';
import Stepper from '@/components/layout/Stepper';
import Checkpoint1 from '@/components/checkpoints/Checkpoint1';
import Checkpoint2 from '@/components/checkpoints/Checkpoint2';
import Checkpoint3 from '@/components/checkpoints/Checkpoint3';
import Checkpoint4 from '@/components/checkpoints/Checkpoint4';
import Checkpoint5 from '@/components/checkpoints/Checkpoint5';
import Checkpoint6 from '@/components/checkpoints/Checkpoint6';
import TimetableDashboard from '@/components/timetable/TimetableDashboard';
import { useContext } from 'react';
import { TimetableContext } from '@/context/TimetableContext';
import { Toaster } from '@/components/ui/toaster';

const AppContent = () => {
  const { step, isGenerated } = useContext(TimetableContext);

  const renderContent = () => {
    if (isGenerated) {
      return <TimetableDashboard />;
    }

    switch (step) {
      case 1:
        return <Checkpoint1 />;
      case 2:
        return <Checkpoint2 />;
      case 3:
        return <Checkpoint3 />;
      case 4:
        return <Checkpoint4 />;
      case 5:
        return <Checkpoint5 />;
      case 6:
        return <Checkpoint6 />;
      default:
        return <Checkpoint1 />;
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <div className="flex flex-col md:grid md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr] gap-6">
          <aside className="hidden md:flex">
            <Stepper />
          </aside>
          <div className="flex flex-col gap-6">{renderContent()}</div>
        </div>
      </main>
    </div>
  );
};

export default function Home() {
  return (
    <TimetableProvider>
      <AppContent />
    </TimetableProvider>
  );
}
