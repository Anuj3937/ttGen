'use client';

import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from 'react';
import type { BasicSetup, Division, Subject, Faculty, Room } from '@/lib/types';
import type { GenerateInitialTimetableOutput } from '@/ai/flows/generate-initial-timetable';

// Define the shape of the data collected from all checkpoints
interface TimetableData {
  basicSetup: BasicSetup | null;
  divisions: Division[];
  subjects: Subject[];
  faculty: Faculty[];
  rooms: Room[];
  timetable: GenerateInitialTimetableOutput['timetable'];
  unassignedSubjects: GenerateInitialTimetableOutput['unassignedSubjects'];
}

// Define the context shape
interface TimetableContextType {
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
  nextStep: () => void;
  prevStep: () => void;
  timetableData: TimetableData;
  setTimetableData: Dispatch<SetStateAction<TimetableData>>;
  isGenerated: boolean;
  setGenerated: Dispatch<SetStateAction<boolean>>;
}

// Create the context with a default value
export const TimetableContext = createContext<TimetableContextType>({
  step: 1,
  setStep: () => {},
  nextStep: () => {},
  prevStep: () => {},
  timetableData: {
    basicSetup: null,
    divisions: [],
    subjects: [],
    faculty: [],
    rooms: [],
    timetable: [],
    unassignedSubjects: [],
  },
  setTimetableData: () => {},
  isGenerated: false,
  setGenerated: () => {},
});

// Create a provider component
export const TimetableProvider = ({ children }: { children: ReactNode }) => {
  const [step, setStep] = useState(1);
  const [isGenerated, setGenerated] = useState(false);
  const [timetableData, setTimetableData] = useState<TimetableData>({
    basicSetup: null,
    divisions: [],
    subjects: [],
    faculty: [],
    rooms: [],
    timetable: [],
    unassignedSubjects: [],
  });

  const nextStep = () => setStep((prev) => (prev < 6 ? prev + 1 : prev));
  const prevStep = () => setStep((prev) => (prev > 1 ? prev - 1 : prev));

  const value = {
    step,
    setStep,
    nextStep,
    prevStep,
    timetableData,
    setTimetableData,
    isGenerated,
    setGenerated,
  };

  return (
    <TimetableContext.Provider value={value}>
      {children}
    </TimetableContext.Provider>
  );
};

// Create a custom hook for easy access to the context
export const useTimetable = () => {
  const context = useContext(TimetableContext);
  if (context === undefined) {
    throw new Error('useTimetable must be used within a TimetableProvider');
  }
  return context;
};
