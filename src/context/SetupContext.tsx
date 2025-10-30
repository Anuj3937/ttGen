'use client';

import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useRouter } from 'next/navigation';

// Define the context shape
interface SetupContextType {
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
  nextStep: () => void;
  prevStep: () => void;
  departmentSetupId: string | null;
  setDepartmentSetupId: (id: string | null) => void;
  isGenerated: boolean;
  setGenerated: Dispatch<SetStateAction<boolean>>;
  resetSetup: () => void;
}

// Create the context with a default value
export const SetupContext = createContext<SetupContextType>({
  step: 1,
  setStep: () => {},
  nextStep: () => {},
  prevStep: () => {},
  departmentSetupId: null,
  setDepartmentSetupId: () => {},
  isGenerated: false,
  setGenerated: () => {},
  resetSetup: () => {},
});

// Create a provider component
export const SetupProvider = ({ children }: { children: ReactNode }) => {
  const [step, setStep] = useState(1);
  const [isGenerated, setGenerated] = useLocalStorage('isTimetableGenerated', false);
  const [departmentSetupId, setDepartmentSetupId] = useLocalStorage<string | null>('departmentSetupId', null);
  const router = useRouter();

  const nextStep = () => setStep((prev) => (prev < 6 ? prev + 1 : prev));
  const prevStep = () => setStep((prev) => (prev > 1 ? prev - 1 : prev));

  const resetSetup = () => {
    setStep(1);
    setGenerated(false);
    setDepartmentSetupId(null);
    // Also clear other related local storage if any
    if (typeof window !== 'undefined') {
      localStorage.removeItem('isTimetableGenerated');
    }
  };

  // When a setup is finished or reset, if there's no ID, go to step 1
  useEffect(() => {
    if (!departmentSetupId && !isGenerated) {
        setStep(1);
    }
  }, [departmentSetupId, isGenerated]);


  const value = {
    step,
    setStep,
    nextStep,
    prevStep,
    departmentSetupId,
    setDepartmentSetupId,
    isGenerated,
    setGenerated,
    resetSetup,
  };

  return (
    <SetupContext.Provider value={value}>
      {children}
    </SetupContext.Provider>
  );
};

// Create a custom hook for easy access to the context
export const useSetup = () => {
  const context = useContext(SetupContext);
  if (context === undefined) {
    throw new Error('useSetup must be used within a SetupProvider');
  }
  return context;
};
