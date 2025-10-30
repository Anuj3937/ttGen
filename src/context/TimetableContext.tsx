'use client';

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import type { BasicSetup, Division, Subject, Faculty, Room } from '@/lib/types';
import type { GenerateInitialTimetableOutput } from '@/ai/flows/generate-initial-timetable';
import { useSetup } from '@/context/SetupContext';
import { useFirebase } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, setDoc } from 'firebase/firestore';

// Define the shape of the data (this is your TimetableData interface)
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
  setTimetableData: Dispatch<SetStateAction<TimetableData>>; // For local changes
  saveDataToFirestore: (
    dataToSave: Partial<TimetableData>
  ) => Promise<void>; // Save to DB
  isGenerated: boolean;
  setGenerated: Dispatch<SetStateAction<boolean>>;
  isRestoring: boolean; // Loading state
}

const defaultTimetableData: TimetableData = {
  basicSetup: null,
  divisions: [],
  subjects: [],
  faculty: [],
  rooms: [],
  timetable: [],
  unassignedSubjects: [],
};

// Create the context with a default value
export const TimetableContext = createContext<TimetableContextType>({
  step: 1,
  setStep: () => {},
  nextStep: () => {},
  prevStep: () => {},
  timetableData: defaultTimetableData,
  setTimetableData: () => {},
  saveDataToFirestore: async () => {},
  isGenerated: false,
  setGenerated: () => {},
  isRestoring: true, // Start in loading state
});

// Create a provider component
export const TimetableProvider = ({ children }: { children: ReactNode }) => {
  const [step, setStep] = useState(1);
  const [isGenerated, setGenerated] = useState(false);
  const [timetableData, setTimetableData] =
    useState<TimetableData>(defaultTimetableData);

  // --- Firestore Persistence Logic ---
  const { departmentSetupId, setDepartmentSetupId } = useSetup();
  const { firestore } = useFirebase();
  const [isRestoring, setIsRestoring] = useState(true);

  // 1. Create a memoized document reference
  const docRef = useMemo(
    () =>
      departmentSetupId
        ? doc(firestore, 'timetable_setups', departmentSetupId)
        : null,
    [departmentSetupId, firestore]
  );

  // 2. Subscribe to the document
  const { data: firestoreData, isLoading: isDocLoading } = useDoc(docRef);

  // 3. Effect to restore data from Firestore on load
  useEffect(() => {
    if (firestoreData) {
      // If data exists in Firestore, load it into state
      setTimetableData(firestoreData as TimetableData);
      // Also restore the 'generated' status
      if (
        firestoreData.timetable &&
        (firestoreData.timetable as any[]).length > 0
      ) {
        setGenerated(true);
      }
    }
    // We are done restoring when the doc is no longer loading
    if (!isDocLoading) {
      setIsRestoring(false);
    }
  }, [firestoreData, isDocLoading]);

  // 4. Create a function to save data to Firestore
  const saveDataToFirestore = useCallback(
    async (dataToSave: Partial<TimetableData>) => {
      let currentId = departmentSetupId;

      // If this is the first save, create a new ID
      if (!currentId) {
        currentId = crypto.randomUUID();
        setDepartmentSetupId(currentId);
      }

      const currentDocRef = doc(firestore, 'timetable_setups', currentId);
      const updatedData = { ...timetableData, ...dataToSave };

      // Update local state immediately for a responsive feel
      setTimetableData(updatedData);

      // Save to Firestore (non-blocking)
      setDoc(currentDocRef, updatedData, { merge: true }).catch((err) => {
        console.error('Failed to save data: ', err);
        // You could use toast() here to show a save error
      });
    },
    [departmentSetupId, firestore, setDepartmentSetupId, timetableData]
  );
  // --- End of Persistence Logic ---

  const nextStep = () => setStep((prev) => (prev < 6 ? prev + 1 : prev));
  const prevStep = () => setStep((prev) => (prev > 1 ? prev - 1 : prev));

  const value = {
    step,
    setStep,
    nextStep,
    prevStep,
    timetableData,
    setTimetableData,
    saveDataToFirestore, // Pass down the save function
    isGenerated,
    setGenerated,
    isRestoring, // Pass down the loading state
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