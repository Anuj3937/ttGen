// [COPY/PASTE THE ENTIRE FILE]
//
// src/components/checkpoints/Checkpoint6.tsx

'use client';

import React, { useState, useMemo } from 'react';
import { useTimetable } from '@/context/TimetableContext';
import CheckpointWrapper from './CheckpointWrapper';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Badge } from '../ui/badge';
import {
  generateInitialTimetable,
  GenerateInitialTimetableInput,
} from '@/ai/flows/generate-initial-timetable';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type {
  Faculty,
  Subject,
  Division,
  Room,
  AllocationEntry,
  AllocatableUnit,
} from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

// --- Algorithm Helper Types ---

// Tracks remaining hours for a faculty member
class FacultyWorkload {
  faculty: Faculty;
  remainingHours: number;
  
  constructor(faculty: Faculty) {
    this.faculty = faculty;
    this.remainingHours = faculty.maxWeeklyHours;
  }
  
  // Check if faculty can take a load (in hours)
  canTakeLoad(hours: number): boolean {
    return this.remainingHours >= hours;
  }
  
  // Assign load
  assignLoad(hours: number): boolean {
    if (this.canTakeLoad(hours)) {
      this.remainingHours -= hours;
      return true;
    }
    return false;
  }
  
  isQualified(subjectCode: string): boolean {
    return this.faculty.qualifiedSubjects.includes(subjectCode);
  }
}

// --- NEW ALGORITHM IMPLEMENTATION ---

/**
 * PART 1: Create Allocatable Units
 * This implements your "Load Calculation Algorithm" by creating a
 * single 1-hour "unit" for every hour of every class, per batch.
 */
function createAllocatableUnits(
  subjects: Subject[],
  divisions: Division[]
): AllocatableUnit[] {
  const units: AllocatableUnit[] = [];

  for (const subject of subjects) {
    const matchingDivisions = divisions.filter(
      (d) => d.branch === subject.branch && d.year === subject.year
    );

    for (const division of matchingDivisions) {
      const divName = `${division.branch}-${division.year}-${division.divisionName}`;
      
      // 1. Create THEORY units
      for (let i = 0; i < subject.theoryHoursPerWeek; i++) {
        units.push({
          id: `${subject.subjectCode}_${divName}_Theory_${i+1}`,
          subject: subject,
          division: division,
          type: 'Theory',
          // Schedulable unit is the *entire division*
          schedulableUnit: divName,
          // Group for consecutive checks
          unitGroup: `${subject.subjectCode}_${divName}_Theory`,
        });
      }

      // 2. Create LAB units (per-batch)
      for (let i = 0; i < subject.practicalHoursPerWeek; i++) {
        for (let batchNum = 1; batchNum <= division.numberOfBatches; batchNum++) {
          const batchIdentifier = `B${batchNum}`;
          const schedulableUnit = `${divName}_${batchIdentifier}`; // "CE-SE-A_B1"
          
          units.push({
            id: `${subject.subjectCode}_${schedulableUnit}_Lab_${i+1}`,
            subject: subject,
            division: division,
            type: 'Lab',
            batchNumber: batchNum,
            // Schedulable unit is just this *one batch*
            schedulableUnit: schedulableUnit,
            // Group for 2-hour block
            unitGroup: `${subject.subjectCode}_${schedulableUnit}_Lab`,
          });
        }
      }
    }
  }
  return units;
}

/**
 * PART 2 & 3: Faculty Allocation Algorithm
 * This implements your "Faculty Allocation Algorithm" and "Priority-Based" logic.
 */
function runFacultyAllocation(
  allUnits: AllocatableUnit[],
  faculty: Faculty[]
): {
  allocatedEntries: AllocationEntry[];
  unassignedUnits: AllocatableUnit[];
} {
  
  // --- Setup ---
  const facultyWorkloads = new Map<string, FacultyWorkload>();
  for (const f of faculty) {
    facultyWorkloads.set(f.id, new FacultyWorkload(f));
  }
  
  // Sort faculty by priority (TAs for labs, then designation)
  const facultyPriority = [...faculty].sort((a, b) => {
    // TAs (or lab-preferring faculty) get priority
    if (a.preferLabs && !b.preferLabs) return -1;
    if (!a.preferLabs && b.preferLabs) return 1;
    // Simple sort by designation (assuming order in constants is priority)
    const designations = ['Teaching Assistant', 'Assistant Professor', 'Associate Professor', 'Professor', 'HOD'];
    return designations.indexOf(a.designation) - designations.indexOf(b.designation);
  });
  
  const allocatedEntriesMap = new Map<string, AllocationEntry>();
  const unassignedUnits: AllocatableUnit[] = [];
  
  // Tracks { "DSA_CE-SE-A_B1": "facultyId" }
  // This is for your "Same Faculty Preference" rule
  const unitGroupFaculty = new Map<string, string>();

  // --- Allocation Loop ---
  for (const unit of allUnits) {
    let assignedFaculty: Faculty | null = null;
    let facultyId: string | null = null;
    
    // **RULE: Same Faculty Preference**
    // Has this subject/division/batch group been assigned?
    const preferredFacultyId = unitGroupFaculty.get(unit.unitGroup);
    if (preferredFacultyId) {
      const workload = facultyWorkloads.get(preferredFacultyId);
      if (workload && workload.canTakeLoad(1)) {
        // This faculty is already teaching this class, assign them
        assignedFaculty = workload.faculty;
        facultyId = workload.faculty.id;
      }
    }
    
    // **RULE: Find a new faculty**
    if (!assignedFaculty) {
      // Loop by priority (TAs first for labs)
      for (const f of facultyPriority) {
        const workload = facultyWorkloads.get(f.id);
        if (!workload) continue;

        // **RULE: Teaching Assistant Priority for Labs**
        if (unit.type === 'Lab' && !f.preferLabs) {
          // If it's a lab and this faculty doesn't prefer labs,
          // check if a lab-preferring faculty is available.
          const hasTAPreference = facultyPriority.some(p => 
            p.preferLabs && 
            facultyWorkloads.get(p.id)?.canTakeLoad(1) && 
            facultyWorkloads.get(p.id)?.isQualified(unit.subject.subjectCode)
          );
          if (hasTAPreference) continue; // Skip this non-lab faculty
        }

        // **RULE: Qualification & Load Limits**
        if (workload.canTakeLoad(1) && workload.isQualified(unit.subject.subjectCode)) {
          assignedFaculty = f;
          facultyId = f.id;
          break; // Found a faculty
        }
      }
    }
    
    // --- Process Assignment ---
    if (assignedFaculty && facultyId) {
      // Decrement faculty load
      facultyWorkloads.get(facultyId)!.assignLoad(1);
      
      // Remember this assignment for "Same Faculty" rule
      unitGroupFaculty.set(unit.unitGroup, facultyId);

      // Group this unit with others of its kind
      // (e.g., group 2x 1-hour lab units into 1x 2-hour entry)
      const divisionName = `${unit.division.branch}-${unit.division.year}-${unit.division.divisionName}`;
      const batchIdentifier = unit.batchNumber ? `B${unit.batchNumber}` : undefined;
      
      // We use the unitGroup as the ID for the *final* entry
      const entryId = unit.unitGroup; 
      
      if (allocatedEntriesMap.has(entryId)) {
        // This is the 2nd or 3rd hour of a class, just increment duration
        allocatedEntriesMap.get(entryId)!.duration += 1;
      } else {
        // This is the 1st hour, create a new entry
        allocatedEntriesMap.set(entryId, {
          id: entryId,
          subjectCode: unit.subject.subjectCode,
          subjectName: unit.subject.subjectName,
          facultyName: assignedFaculty.facultyName,
          divisionName: divisionName,
          batchIdentifier: batchIdentifier,
          roomType: unit.type === 'Lab' ? 'Lab' : 'Classroom',
          schedulableUnit: unit.schedulableUnit,
          duration: 1, // 1 hour (will be incremented if >1)
        });
      }
    } else {
      // **PHASE 4: Mark Remaining as Pending**
      unassignedUnits.push(unit);
    }
  }

  return {
    allocatedEntries: Array.from(allocatedEntriesMap.values()),
    unassignedUnits,
  };
}

export default function Checkpoint6() {
  const {
    timetableData,
    setTimetableData,
    prevStep,
    setGenerated,
    saveDataToFirestore,
  } = useTimetable();
  const [isLoading, setIsLoading] = useState(false);
  const [unassignedList, setUnassignedList] = useState<string[]>([]);
  const { toast } = useToast();

  const { totalLoad, totalCapacity } = useMemo(() => {
    let load = 0;
    if (timetableData.subjects.length > 0 && timetableData.divisions.length > 0) {
      const units = createAllocatableUnits(timetableData.subjects, timetableData.divisions);
      load = units.length;
    }
    const capacity = timetableData.faculty.reduce(
      (acc, f) => acc + f.maxWeeklyHours,
      0
    );
    return { totalLoad: load, totalCapacity: capacity };
  }, [timetableData]);

  const handleGenerate = async () => {
    setIsLoading(true);
    setUnassignedList([]);
    toast({
      title: 'Generating Timetable...',
      description: 'Phase 1: Running Faculty Allocation Algorithm...',
    });

    if (!timetableData.basicSetup) {
      toast({ variant: 'destructive', title: 'Error', description: 'Basic setup data is missing.' });
      setIsLoading(false);
      return;
    }

    // --- ALGORITHM PHASE 1: Create Allocatable Units ---
    const allUnits = createAllocatableUnits(
      timetableData.subjects,
      timetableData.divisions
    );

    // --- ALGORITHM PHASE 2: Run Faculty Allocation ---
    const { allocatedEntries, unassignedUnits } = runFacultyAllocation(
      allUnits,
      timetableData.faculty
    );

    const unassignedSubjectNames = [
      ...new Set(unassignedUnits.map(u => u.subject.subjectName)),
    ];
    setUnassignedList(unassignedSubjectNames);

    if (allocatedEntries.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Allocation Failed',
        description: 'No classes could be allocated to faculty. Check faculty qualifications and load.',
      });
      setIsLoading(false);
      return;
    }
    
    toast({
      title: 'Allocation Complete!',
      description: `Phase 2: Sending ${allocatedEntries.length} pre-allocated classes to AI for scheduling...`,
    });

    // --- ALGORITHM PHASE 3: AI Slot Placement ---
    
    const aiInput: GenerateInitialTimetableInput = {
      allocations: allocatedEntries,
      rooms: timetableData.rooms.map(r => ({ roomNumber: r.roomNumber, roomType: r.roomType })),
      workingDays: timetableData.basicSetup.workingDays,
      timeSlots: timetableData.basicSetup.timeSlots,
      labSchedulingPreference: timetableData.basicSetup.labPreference,
    };

    try {
      const result = await generateInitialTimetable(aiInput);

      // --- SAVE TO FIRESTORE ---
      await saveDataToFirestore({
        timetable: result.timetable,
        // We use the *human-readable* list from our local algorithm
        unassignedSubjects: unassignedSubjectNames,
      });

      // Update local state
      setTimetableData((prev) => ({
        ...prev,
        timetable: result.timetable,
        unassignedSubjects: unassignedSubjectNames,
      }));

      toast({
        title: 'Timetable Generated!',
        description: `Successfully scheduled ${result.timetable.length} classes.`,
      });
      setGenerated(true);
      
    } catch (error) {
      console.error('Error generating timetable:', error);
      toast({
        variant: 'destructive',
        title: 'AI Scheduling Failed',
        description: 'The AI flow failed to schedule the classes. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CheckpointWrapper
      title="Review & Generate"
      description="Review all entered data and generate the timetable."
      onNext={handleGenerate}
      onBack={prevStep}
      nextLabel={isLoading ? 'Generating...' : 'Generate Timetable'}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>
              Here is a summary of the data you have provided.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Divisions"
              value={timetableData.divisions.length}
            />
            <SummaryCard
              title="Subjects"
              value={timetableData.subjects.length}
            />
            <SummaryCard title="Faculty" value={timetableData.faculty.length} />
            <SummaryCard title="Rooms" value={timetableData.rooms.length} />
          </CardContent>
          <CardFooter>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div>
                Total Weekly Load:{' '}
                <Badge variant="secondary">{totalLoad} hours</Badge>
              </div>
              <div>
                Total Faculty Capacity:{' '}
                <Badge variant="secondary">{totalCapacity} hours</Badge>
              </div>
              {totalLoad > totalCapacity && (
                <p className="text-destructive text-sm font-semibold">
                  Warning: Department load exceeds faculty capacity!
                </p>
              )}
            </div>
          </CardFooter>
        </Card>
        
        {unassignedList.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Allocation Warning</AlertTitle>
            <AlertDescription>
              Based on your rules, the following subjects could not be fully assigned to a faculty and will NOT be scheduled: {unassignedList.join(', ')}
            </AlertDescription>
          </Alert>
        )}

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>Show All Entered Data</AccordionTrigger>
            <AccordionContent>
              <Card>
                <CardHeader>
                  <CardTitle>Raw Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="mt-2 w-full max-h-[400px] overflow-auto rounded-md bg-slate-950 p-4">
                    <code className="text-white">
                      {JSON.stringify(
                        timetableData,
                        (key, value) => {
                          if (key === 'id') return undefined;
                          return value;
                        },
                        2
                      )}
                    </code>
                  </pre>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-lg">Generating timetable, please wait...</p>
          </div>
        </div>
      )}
    </CheckpointWrapper>
  );
}

const SummaryCard = ({
  title,
  value,
}: {
  title: string;
  value: number | string;
}) => (
  <div className="flex items-center justify-between rounded-lg border p-3">
    <p className="text-sm font-medium text-muted-foreground">{title}</p>
    <p className="text-2xl font-bold">{value}</p>
  </div>
);