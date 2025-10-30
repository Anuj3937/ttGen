'use client';
import { useTimetable } from '@/context/TimetableContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMemo, useState } from 'react';
import { TimetableEntry as TimetableEntryType } from '@/lib/types';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  UniqueIdentifier,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Download } from 'lucide-react'; // Import Download icon
import Papa from 'papaparse'; // Import papaparse

const DraggableTimetableEntry = ({
  entry,
  filterBy,
}: {
  entry: TimetableEntryType;
  filterBy: 'divisionName' | 'facultyName' | 'roomNumber';
}) => {
  const { timetableData } = useTimetable();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${entry.day}-${entry.timeSlot}-${entry.subjectCode}-${entry.divisionName}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  const subject = timetableData.subjects.find(
    (s) => s.subjectCode === entry.subjectCode
  );

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 text-xs space-y-1 mb-1">
        <p className="font-bold">{entry.subjectCode}</p>
        <p>{subject?.subjectName}</p>
        <p className="text-muted-foreground">
          {filterBy !== 'facultyName' ? entry.facultyName : ''}
        </p>
        <p className="text-muted-foreground">
          {filterBy !== 'roomNumber' ? `Room: ${entry.roomNumber}` : ''}
        </p>
      </div>
    </div>
  );
};

export default function TimetableDashboard() {
  const { timetableData, setGenerated, setStep, setTimetableData } =
    useTimetable();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const handleBackToSetup = () => {
    setGenerated(false);
    setStep(1);
  };

  const { timetable, unassignedSubjects } = timetableData;

  const { workingDays, timeSlots, divisions, faculty, rooms } = useMemo(() => {
    const workingDays = timetableData.basicSetup?.workingDays || [];
    const timeSlots = timetableData.basicSetup?.timeSlots || [];
    const divisions = Array.from(
      new Set(timetable.map((entry) => entry.divisionName))
    );
    const faculty = Array.from(
      new Set(timetable.map((entry) => entry.facultyName))
    );
    const rooms = Array.from(
      new Set(timetable.map((entry) => entry.roomNumber))
    );
    return { workingDays, timeSlots, divisions, faculty, rooms };
  }, [timetable, timetableData.basicSetup]);

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setTimetableData((prevData) => {
        const oldTimetable = prevData.timetable;
        const activeEntryIndex = oldTimetable.findIndex(
          (entry) =>
            `${entry.day}-${entry.timeSlot}-${entry.subjectCode}-${entry.divisionName}` ===
            active.id
        );

        // over.id is the cell `day-time`
        const [newDay, newTime] = (over.id as string).split('_');

        if (activeEntryIndex > -1 && newDay && newTime) {
          const newTimetable = [...oldTimetable];
          const activeEntry = newTimetable[activeEntryIndex];

          // Find if there's an entry in the 'over' slot for the same division/faculty/room
          const overEntryIndex = newTimetable.findIndex(
            (e) =>
              e.day === newDay &&
              e.timeSlot === newTime &&
              e.divisionName === activeEntry.divisionName
          );

          if (overEntryIndex > -1) {
            // Swap
            const overEntry = newTimetable[overEntryIndex];
            newTimetable[activeEntryIndex] = {
              ...overEntry,
              day: activeEntry.day,
              timeSlot: activeEntry.timeSlot,
            };
            newTimetable[overEntryIndex] = {
              ...activeEntry,
              day: newDay,
              timeSlot: newTime,
            };
          } else {
            // Move
            newTimetable[activeEntryIndex] = {
              ...activeEntry,
              day: newDay,
              timeSlot: newTime,
            };
          }

          return { ...prevData, timetable: newTimetable };
        }
        return prevData;
      });
    }
  };

  const getEntry = (
    day: string,
    time: string,
    filterValue: string,
    filterBy: 'divisionName' | 'facultyName' | 'roomNumber'
  ) => {
    return timetable.filter(
      (entry) =>
        entry.day === day &&
        entry.timeSlot === time &&
        entry[filterBy] === filterValue
    );
  };

  const DroppableCell = ({
    day,
    time,
    children,
  }: {
    day: string;
    time: string;
    children: React.ReactNode;
  }) => {
    const { setNodeRef, isOver } = useSortable({ id: `${day}_${time}` });
    return (
      <td
        ref={setNodeRef}
        className={`p-2 border align-top min-w-[150px] ${
          isOver ? 'bg-accent/20' : ''
        }`}
      >
        {children}
      </td>
    );
  };

  const TimetableView = ({
    filterBy,
    filterValues,
  }: {
    filterBy: 'divisionName' | 'facultyName' | 'roomNumber';
    filterValues: string[];
  }) => {
    const sortableIds = useMemo(() => {
      const cellIds = workingDays.flatMap((day) =>
        timeSlots.map((time) => `${day}_${time}`)
      );
      const entryIds = timetable.map(
        (entry) =>
          `${entry.day}-${entry.timeSlot}-${entry.subjectCode}-${entry.divisionName}`
      );
      return [...cellIds, ...entryIds];
    }, [workingDays, timeSlots, timetable]);

    return (
      <Tabs defaultValue={filterValues[0]} className="w-full">
        <TabsList>
          {filterValues.map((val) => (
            <TabsTrigger key={val} value={val}>
              {val}
            </TabsTrigger>
          ))}
        </TabsList>
        {filterValues.map((val) => (
          <TabsContent key={val} value={val}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortableIds}
                strategy={rectSortingStrategy}
              >
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 border">Day</th>
                            {timeSlots.map((time) => (
                              <th key={time} className="p-2 border">
                                {time}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {workingDays.map((day) => (
                            <tr key={day}>
                              <td className="p-2 border font-semibold">
                                {day}
                              </td>
                              {timeSlots.map((time) => (
                                <DroppableCell key={time} day={day} time={time}>
                                  {getEntry(day, time, val, filterBy).map(
                                    (entry, i) => (
                                      <DraggableTimetableEntry
                                        key={`${i}-${entry.subjectCode}`}
                                        entry={entry}
                                        filterBy={filterBy}
                                      />
                                    )
                                  )}
                                </DroppableCell>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </SortableContext>
              <DragOverlay>
                {activeId ? (
                  <div className="bg-primary/20 border border-primary/40 rounded-lg p-2 text-xs space-y-1">
                    Dragging...
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </TabsContent>
        ))}
      </Tabs>
    );
  };

  // --- ADDED DOWNLOAD HANDLER ---
  const handleDownload = () => {
    const { timetable, subjects, divisions, basicSetup } = timetableData;

    if (!timetable || timetable.length === 0) {
      alert('No timetable data to download.');
      return;
    }

    // We'll create a flat, detailed CSV
    const dataForCsv = timetable.map((entry) => {
      const subject = subjects.find(
        (s) => s.subjectCode === entry.subjectCode
      );
      const division = divisions.find(
        (d) => `${d.branch}-${d.year}-${d.divisionName}` === entry.divisionName
      );

      return {
        Day: entry.day,
        TimeSlot: entry.timeSlot,
        Division: entry.divisionName,
        'Subject Code': entry.subjectCode,
        'Subject Name': subject?.subjectName || 'N/A',
        Faculty: entry.facultyName,
        Room: entry.roomNumber,
        Branch: division?.branch || 'N/A',
        Year: division?.year || 'N/A',
      };
    });

    // Sort by day, then time, then division for a readable CSV
    const sortedData = dataForCsv.sort((a, b) => {
      const dayOrder =
        (basicSetup?.workingDays || []).indexOf(a.Day) -
        (basicSetup?.workingDays || []).indexOf(b.Day);
      if (dayOrder !== 0) return dayOrder;

      const timeOrder =
        (basicSetup?.timeSlots || []).indexOf(a.TimeSlot) -
        (basicSetup?.timeSlots || []).indexOf(b.TimeSlot);
      if (timeOrder !== 0) return timeOrder;

      return a.Division.localeCompare(b.Division);
    });

    const csv = Papa.unparse(sortedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'timetable.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  // --- END DOWNLOAD HANDLER ---

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight font-headline">
          Generated Timetable
        </h2>
        {/* --- ADDED WRAPPER AND BUTTON --- */}
        <div className="flex gap-2">
          <Button onClick={handleDownload} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
          <Button onClick={handleBackToSetup} variant="outline">
            Back to Setup
          </Button>
        </div>
        {/* --- END UPDATE --- */}
      </div>

      {unassignedSubjects && unassignedSubjects.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">
              Unassigned Subjects
            </CardTitle>
            <CardDescription>
              The following subjects could not be scheduled due to conflicts or
              lack of resources.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1">
              {unassignedSubjects.map((code) => {
                const subject = timetableData.subjects.find(
                  (s) => s.subjectCode === code
                );
                return (
                  <li key={code}>
                    {subject ? `${code} - ${subject.subjectName}` : code}
                  </li>
                );
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