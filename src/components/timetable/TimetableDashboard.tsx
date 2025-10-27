'use client';
import { useTimetable } from '@/context/TimetableContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMemo } from 'react';
import { TimetableEntry as TimetableEntryType, Subject } from '@/lib/types';


export default function TimetableDashboard() {
  const { timetableData, setGenerated, setStep } = useTimetable();

  const handleBackToSetup = () => {
    setGenerated(false);
    setStep(1);
  };
  
  const { timetable, unassignedSubjects } = timetableData;

  const { workingDays, timeSlots, divisions, faculty, rooms } = useMemo(() => {
    const workingDays = timetableData.basicSetup?.workingDays || [];
    const timeSlots = timetableData.basicSetup?.timeSlots || [];
    const divisions = Array.from(new Set(timetable.map(entry => entry.divisionName)));
    const faculty = Array.from(new Set(timetable.map(entry => entry.facultyName)));
    const rooms = Array.from(new Set(timetable.map(entry => entry.roomNumber)));
    return { workingDays, timeSlots, divisions, faculty, rooms };
  }, [timetable, timetableData.basicSetup]);

  const getEntry = (day: string, time: string, filterValue: string, filterBy: 'divisionName' | 'facultyName' | 'roomNumber') => {
    return timetable.filter(
      (entry) =>
        entry.day === day &&
        entry.timeSlot === time &&
        entry[filterBy] === filterValue
    );
  };

  const TimetableView = ({ filterBy, filterValues }: { filterBy: 'divisionName' | 'facultyName' | 'roomNumber', filterValues: string[] }) => {
    const TimetableEntry = ({ entry, filterBy }: { entry: TimetableEntryType, filterBy: 'divisionName' | 'facultyName' | 'roomNumber' }) => {
        const subject = timetableData.subjects.find(s => s.subjectCode === entry.subjectCode);
        return (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 text-xs space-y-1 mb-1">
                <p className="font-bold">{entry.subjectCode}</p>
                <p>{subject?.subjectName}</p>
                <p className="text-muted-foreground">{filterBy !== 'facultyName' ? entry.facultyName : ''}</p>
                <p className="text-muted-foreground">{filterBy !== 'roomNumber' ? `Room: ${entry.roomNumber}` : ''}</p>
            </div>
        )
    };

    return (
        <Tabs defaultValue={filterValues[0]} className="w-full">
        <TabsList>
            {filterValues.map(val => <TabsTrigger key={val} value={val}>{val}</TabsTrigger>)}
        </TabsList>
        {filterValues.map(val => (
            <TabsContent key={val} value={val}>
            <Card>
                <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                    <thead className="bg-muted">
                        <tr>
                        <th className="p-2 border">Day</th>
                        {timeSlots.map(time => <th key={time} className="p-2 border">{time}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {workingDays.map(day => (
                        <tr key={day}>
                            <td className="p-2 border font-semibold">{day}</td>
                            {timeSlots.map(time => (
                            <td key={time} className="p-2 border align-top min-w-[150px]">
                                {getEntry(day, time, val, filterBy).map((entry, i) => (
                                <TimetableEntry key={i} entry={entry} filterBy={filterBy} />
                                ))}
                            </td>
                            ))}
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                </CardContent>
            </Card>
            </TabsContent>
        ))}
        </Tabs>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight font-headline">Generated Timetable</h2>
        <Button onClick={handleBackToSetup} variant="outline">
          Back to Setup
        </Button>
      </div>

       {unassignedSubjects && unassignedSubjects.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Unassigned Subjects</CardTitle>
            <CardDescription>
              The following subjects could not be scheduled due to conflicts or lack of resources.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1">
              {unassignedSubjects.map(code => {
                const subject = timetableData.subjects.find(s => s.subjectCode === code);
                return <li key={code}>{subject ? `${code} - ${subject.subjectName}` : code}</li>
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="division" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="division">View by Division</TabsTrigger>
          <TabsTrigger value="faculty">View by Faculty</TabsTrigger>
          <TabsTrigger value="room">View by Room</TabsTrigger>
        </TabsList>
        <TabsContent value="division">
          <TimetableView filterBy="divisionName" filterValues={divisions} />
        </TabsContent>
        <TabsContent value="faculty">
           <TimetableView filterBy="facultyName" filterValues={faculty} />
        </TabsContent>
        <TabsContent value="room">
           <TimetableView filterBy="roomNumber" filterValues={rooms} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
