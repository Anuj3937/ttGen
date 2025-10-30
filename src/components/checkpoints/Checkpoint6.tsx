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

export default function Checkpoint6() {
  const {
    timetableData,
    setTimetableData,
    prevStep,
    setGenerated,
    saveDataToFirestore, // Get new function
  } = useTimetable();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // --- UPDATED handleGenerate ---
  const handleGenerate = async () => {
    setIsLoading(true);
    toast({
      title: 'Generating Timetable...',
      description: 'hopefully this time this works! lol',
    });

    if (!timetableData.basicSetup) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Basic setup data is missing.',
      });
      setIsLoading(false);
      return;
    }

    const input: GenerateInitialTimetableInput = {
      departmentName: timetableData.basicSetup.departmentName,
      branches: timetableData.basicSetup.branches,
      academicYear: timetableData.basicSetup.academicYear,
      semesterType: timetableData.basicSetup.semesterType,
      workingDays: timetableData.basicSetup.workingDays,
      timeSlots: timetableData.basicSetup.timeSlots,
      labSchedulingPreference: timetableData.basicSetup.labPreference,
      divisions: timetableData.divisions.map((d) => ({
        ...d,
        divisionName: `${d.branch}-${d.year}-${d.divisionName}`,
      })),
      subjects: timetableData.subjects,
      faculty: timetableData.faculty.map((f) => ({
        facultyName: f.facultyName,
        employeeID: f.employeeId,
        designation: f.designation,
        maxWeeklyHours: f.maxWeeklyHours,
        qualifiedSubjects: f.qualifiedSubjects,
        preferLabs: f.preferLabs,
      })),
      rooms: timetableData.rooms,
    };

    try {
      const result = await generateInitialTimetable(input);

      // --- SAVE TO FIRESTORE ---
      await saveDataToFirestore({
        timetable: result.timetable,
        unassignedSubjects: result.unassignedSubjects,
      });

      // Update local state (now handled by saveDataToFirestore, but good for safety)
      setTimetableData((prev) => ({
        ...prev,
        timetable: result.timetable,
        unassignedSubjects: result.unassignedSubjects,
      }));

      toast({
        title: 'Timetable Generated!',
        description: 'The initial draft of your timetable is ready.',
      });
      setGenerated(true);
    } catch (error) {
      console.error('Error generating timetable:', error);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description:
          'Something went wrong while generating the timetable. Please check your inputs and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };
  // --- END UPDATE ---

  const { totalLoad, totalCapacity } = useMemo(() => {
    const totalLoad = timetableData.subjects.reduce(
      (acc, s) => acc + s.theoryHoursPerWeek + s.practicalHoursPerWeek,
      0
    );
    const totalCapacity = timetableData.faculty.reduce(
      (acc, f) => acc + f.maxWeeklyHours,
      0
    );
    return { totalLoad, totalCapacity };
  }, [timetableData]);

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
            <div className="flex items-center gap-4 text-sm">
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

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>Show All Entered Data</AccordionTrigger>
            <AccordionContent>
              <Card>
                <CardHeader>
                  <CardTitle>Raw Data</CardTitle>
                  <CardDescription>
                    Expand the sections below to see the data you've entered.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="mt-2 w-full max-h-[400px] overflow-auto rounded-md bg-slate-950 p-4">
                    <code className="text-white">
                      {JSON.stringify(
                        timetableData,
                        (key, value) => {
                          // remove IDs from the display
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