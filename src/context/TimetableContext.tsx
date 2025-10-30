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
import { useFirebase } from '@/firebase/provider'; // Import useFirebase
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, setDoc } from 'firebase/firestore';

// Define the shape of the data
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
  isRestoring: boolean; // Loading state (includes auth check now)
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
  const { firestore, isUserLoading, user } = useFirebase(); // Get auth state
  const [isRestoring, setIsRestoring] = useState(true); // Combined loading state
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false); // Track if load attempt was made

  // 1. Create a memoized document reference (only when auth is ready and ID exists)
  const docRef = useMemo(
    () =>
      !isUserLoading && user && departmentSetupId // Check auth is ready AND user exists
        ? doc(firestore, 'timetable_setups', departmentSetupId)
        : null,
    [departmentSetupId, firestore, isUserLoading, user] // Add auth state dependencies
  );

  // 2. Subscribe to the document (useDoc hook)
  const { data: firestoreData, isLoading: isDocLoading } = useDoc(docRef);

  // 3. Effect to restore data from Firestore on load (only when auth is ready)
  useEffect(() => {
      // Don't do anything until Firebase auth check is complete
      if (isUserLoading) {
          setIsRestoring(true); // Keep showing loader while auth loads
          return;
      }

      // If user is not logged in (e.g., anonymous sign-in failed), stop loading
      if (!user) {
          console.warn("User not authenticated, cannot load or save data.");
          setIsRestoring(false);
          setHasAttemptedLoad(true); // Mark load as attempted (even if failed)
          setTimetableData(defaultTimetableData); // Reset local data
          setGenerated(false);
          return;
      }

      // If we have an ID and haven't loaded yet, useDoc will trigger loading
      if (departmentSetupId && !hasAttemptedLoad) {
           setIsRestoring(isDocLoading); // Reflect doc loading state
      } else {
           // No ID or load already attempted, we are done restoring
           setIsRestoring(false);
      }

      // If firestoreData becomes available, update state
      if (firestoreData && !isDocLoading) {
          console.log("Restoring data from Firestore:", firestoreData);
          setTimetableData(firestoreData as TimetableData);
          if (
              firestoreData.timetable &&
              (firestoreData.timetable as any[]).length > 0
          ) {
              setGenerated(true);
          } else {
              setGenerated(false); // Ensure generated is false if no timetable data
          }
          setHasAttemptedLoad(true); // Mark load as complete
      } else if (!isDocLoading && departmentSetupId && !firestoreData && !hasAttemptedLoad) {
          // If doc finished loading, ID exists, but no data found (e.g., new setup ID)
          console.log("No existing data found for setup ID:", departmentSetupId);
          setTimetableData(defaultTimetableData); // Ensure clean state
          setGenerated(false);
          setHasAttemptedLoad(true); // Mark load attempt as complete
      } else if (!departmentSetupId && !isUserLoading) {
          // If no setup ID and auth is ready, reset to default and stop loading
           console.log("No departmentSetupId, resetting state.");
           setTimetableData(defaultTimetableData);
           setGenerated(false);
           setIsRestoring(false);
           setHasAttemptedLoad(true); // Mark as "attempted" (nothing to load)
      }

  }, [firestoreData, isDocLoading, departmentSetupId, isUserLoading, user, hasAttemptedLoad]);


  // 4. Create a function to save data to Firestore (check auth before saving)
  const saveDataToFirestore = useCallback(
    async (dataToSave: Partial<TimetableData>) => {
      // --- Wait for Auth Check ---
      if (isUserLoading) {
        console.warn('Auth is still loading. Save deferred.');
        // Optionally show a toast or handle this case
        return;
      }
      if (!user) {
        console.error('User not authenticated. Cannot save data.');
        // Show error toast
        // toast({ variant: 'destructive', title: 'Error', description: 'You must be signed in to save.' });
        return;
      }
      // --- End Auth Check ---

      let currentId = departmentSetupId;

      // If this is the first save, create a new ID
      if (!currentId) {
        currentId = crypto.randomUUID();
        console.log("Assigning new setup ID:", currentId);
        setDepartmentSetupId(currentId); // This will trigger a re-render and docRef update
      }

      // Ensure we use the potentially *new* ID for the doc ref
      const effectiveId = currentId || departmentSetupId;
      if (!effectiveId) {
           console.error("No valid setup ID available for saving.");
           return;
      }

      const currentDocRef = doc(firestore, 'timetable_setups', effectiveId);
      // Merge incoming data with the *current* state before saving
      const updatedData = { ...timetableData, ...dataToSave };

      console.log("Saving data to Firestore:", effectiveId, updatedData);

      // Update local state immediately for a responsive feel
      setTimetableData(updatedData);

      // Save to Firestore (non-blocking)
      setDoc(currentDocRef, updatedData, { merge: true }).catch((err) => {
        console.error('Failed to save data: ', err);
        // You could use toast() here to show a save error
      });
    },
    [departmentSetupId, firestore, setDepartmentSetupId, timetableData, isUserLoading, user] // Add auth dependencies
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
    saveDataToFirestore,
    isGenerated,
    setGenerated,
    isRestoring, // Pass down the combined loading state
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