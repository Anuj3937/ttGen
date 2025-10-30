'use client';
import { useTimetable } from '@/context/TimetableContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemo, useState, useCallback, useEffect } from 'react';
import { TimetableEntry as TimetableEntryType, Subject, Division, Room, Faculty } from '@/lib/types';
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
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Download, Edit, PlusCircle, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';

// --- Zod Schema for the Edit Form ---
const editSlotSchema = z.object({
  subjectCode: z.string().min(1, 'Subject is required.'),
  facultyName: z.string().min(1, 'Faculty is required.'),
  roomNumber: z.string().min(1, 'Room is required.'),
});
type EditSlotFormData = z.infer<typeof editSlotSchema>;

// --- Draggable Entry Component (with Double Click) ---
const DraggableTimetableEntry = ({
  entry,
  filterBy,
  onDoubleClick,
}: {
  entry: TimetableEntryType;
  filterBy: 'divisionName' | 'facultyName' | 'roomNumber';
  onDoubleClick: (entry: TimetableEntryType) => void; // Pass handler
}) => {
  const { timetableData } = useTimetable();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${entry.day}-${entry.timeSlot}-${entry.subjectCode}-${entry.divisionName}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  const subject = timetableData.subjects.find(s => s.subjectCode === entry.subjectCode);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onDoubleClick={() => onDoubleClick(entry)} // Add double click
    >
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 text-xs space-y-1 mb-1 relative group">
        <p className="font-bold">{entry.subjectCode}</p>
        <p>{subject?.subjectName}</p>
        <p className="text-muted-foreground">{filterBy !== 'facultyName' ? entry.facultyName : ''}</p>
        <p className="text-muted-foreground">{filterBy !== 'roomNumber' ? `Room: ${entry.roomNumber}` : ''}</p>
         {/* Edit icon appears on hover */}
         <button
            onClick={() => onDoubleClick(entry)}
            className="absolute top-1 right-1 p-0.5 bg-background/70 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            aria-label="Edit slot"
         >
            <Edit className="h-3 w-3 text-primary" />
         </button>
      </div>
    </div>
  );
};


export default function TimetableDashboard() {
  const { timetableData, setGenerated, setStep, setTimetableData, saveDataToFirestore } =
    useTimetable();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const { toast } = useToast();

  // --- State for Edit Dialog ---
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{
    day: string;
    timeSlot: string;
    divisionName: string; // The division currently being viewed
    existingEntry?: TimetableEntryType | null; // The entry being edited (if any)
  } | null>(null);

  // --- Form Hook for Dialog ---
  const editForm = useForm<EditSlotFormData>({
    resolver: zodResolver(editSlotSchema),
    defaultValues: {
      subjectCode: '',
      facultyName: '',
      roomNumber: '',
    },
  });

  // --- Effect to reset form when dialog opens ---
  useEffect(() => {
    if (isEditDialogOpen && editingSlot) {
      editForm.reset({
        subjectCode: editingSlot.existingEntry?.subjectCode || '',
        facultyName: editingSlot.existingEntry?.facultyName || '',
        roomNumber: editingSlot.existingEntry?.roomNumber || '',
      });
    } else {
        editForm.reset({ subjectCode: '', facultyName: '', roomNumber: '' }); // Clear on close
    }
  }, [isEditDialogOpen, editingSlot, editForm]);


  const handleBackToSetup = () => {
    setGenerated(false);
    setStep(1);
  };

  const { timetable, unassignedSubjects } = timetableData;

  const { workingDays, timeSlots, divisions, faculty, rooms, subjects, basicSetup } = useMemo(() => {
    const workingDays = timetableData.basicSetup?.workingDays || [];
    const timeSlots = timetableData.basicSetup?.timeSlots || [];
    const divisions = Array.from(new Set(timetable.map(entry => entry.divisionName)));
    const faculty = timetableData.faculty; // Use full faculty data
    const rooms = timetableData.rooms; // Use full room data
    const subjects = timetableData.subjects; // Use full subject data
    return { workingDays, timeSlots, divisions, faculty, rooms, subjects, basicSetup: timetableData.basicSetup };
  }, [timetable, timetableData]);


  // --- Validation Logic ---
  const isMoveValid = useCallback((
    currentTimetable: TimetableEntryType[],
    entryToCheck: TimetableEntryType, // The entry being moved or manually added
    newDay: string,
    newTimeSlot: string
  ): { valid: boolean; conflictType?: string; conflictingEntry?: TimetableEntryType } => {
    const subjectDetails = subjects.find(s => s.subjectCode === entryToCheck.subjectCode);
    const roomDetails = rooms.find(r => r.roomNumber === entryToCheck.roomNumber);

    for (const existingEntry of currentTimetable) {
      // Skip checking against itself if it's an existing entry being moved
      if (
        editingSlot?.existingEntry &&
        existingEntry.day === editingSlot.existingEntry.day &&
        existingEntry.timeSlot === editingSlot.existingEntry.timeSlot &&
        existingEntry.divisionName === editingSlot.existingEntry.divisionName &&
        existingEntry.subjectCode === editingSlot.existingEntry.subjectCode
      ) {
        continue;
      }

      if (existingEntry.day === newDay && existingEntry.timeSlot === newTimeSlot) {
        // Faculty Conflict
        if (existingEntry.facultyName === entryToCheck.facultyName) {
          return { valid: false, conflictType: 'Faculty Conflict', conflictingEntry: existingEntry };
        }
        // Room Conflict
        if (existingEntry.roomNumber === entryToCheck.roomNumber) {
          return { valid: false, conflictType: 'Room Conflict', conflictingEntry: existingEntry };
        }
        // Division Conflict
        if (existingEntry.divisionName === entryToCheck.divisionName) {
          return { valid: false, conflictType: 'Division Conflict', conflictingEntry: existingEntry };
        }
      }
    }

    // Room Type Check
    if (subjectDetails?.type === 'Lab' && roomDetails?.roomType !== 'Lab') {
        return { valid: false, conflictType: 'Room Type Conflict (Lab subject needs Lab room)' };
    }
    if (subjectDetails?.type !== 'Lab' && roomDetails?.roomType === 'Lab') {
         // Allow theory in lab if needed, maybe add a stricter check later
         // console.warn("Assigning non-lab subject to a lab room.");
    }

    // --- Add More Constraints as Needed ---
    // e.g., Consecutive theory lectures, Lab blocks, etc.
    // This requires looking at adjacent slots and is more complex. Start with basic conflicts.

    return { valid: true };
  }, [subjects, rooms, editingSlot]); // Dependencies for validation

  // --- Updated Drag Handlers ---
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
        return; // No move or dropped on itself
    }

    const activeEntry = timetable.find(
      entry => `${entry.day}-${entry.timeSlot}-${entry.subjectCode}-${entry.divisionName}` === active.id
    );

    if (!activeEntry) {
        console.error("Dragged item not found in timetable data:", active.id);
        return;
    }

    const [newDay, newTime] = (over.id as string).split('_'); // Dropped onto a cell 'day_time'

    if (!newDay || !newTime) {
        console.error("Invalid drop target ID:", over.id);
        return; // Dropped somewhere invalid
    }

    // --- Validation Check ---
    const { valid, conflictType, conflictingEntry } = isMoveValid(timetable, activeEntry, newDay, newTime);

    if (!valid) {
      toast({
        variant: 'destructive',
        title: 'Invalid Move',
        description: `${conflictType || 'Conflict detected'}. ${
          conflictingEntry
            ? `Conflicts with ${conflictingEntry.subjectCode} for ${conflictingEntry.divisionName} taught by ${conflictingEntry.facultyName} in ${conflictingEntry.roomNumber}.`
            : ''
        }`,
      });
      return; // Stop processing, item snaps back automatically
    }

    // --- If Valid, Proceed with Update ---
    setTimetableData(prevData => {
      const oldTimetable = prevData.timetable;
      const activeEntryIndex = oldTimetable.findIndex(e => e === activeEntry); // Find by object reference

      if (activeEntryIndex === -1) {
          console.error("Could not find active entry index during update");
          return prevData; // Should not happen if activeEntry was found
      }

      const newTimetable = [...oldTimetable];

      // Find if there's an entry in the 'over' slot *for the same division* to swap with
      const overEntryIndex = newTimetable.findIndex(
          e => e.day === newDay && e.timeSlot === newTime && e.divisionName === activeEntry.divisionName
      );

      if (overEntryIndex > -1) {
          // Swap
          const overEntry = newTimetable[overEntryIndex];
          newTimetable[activeEntryIndex] = { // Update the original slot with the 'over' entry's data but original day/time
              ...overEntry,
              day: activeEntry.day,
              timeSlot: activeEntry.timeSlot,
          };
           newTimetable[overEntryIndex] = { // Update the 'over' slot with the active entry's data and new day/time
              ...activeEntry,
              day: newDay,
              timeSlot: newTime,
          };

      } else {
          // Move to an empty slot for this division
          newTimetable[activeEntryIndex] = {
              ...activeEntry,
              day: newDay,
              timeSlot: newTime,
          };
      }

      // Save the updated timetable to Firestore
      saveDataToFirestore({ timetable: newTimetable });
      return { ...prevData, timetable: newTimetable };
    });

  };

  // --- Handlers for Manual Edit Dialog ---
  const openEditDialog = (day: string, timeSlot: string, currentDivision: string, entryToEdit?: TimetableEntryType | null) => {
    setEditingSlot({ day, timeSlot, divisionName: currentDivision, existingEntry: entryToEdit });
    setIsEditDialogOpen(true);
  };

  const handleEditFormSubmit = (formData: EditSlotFormData) => {
    if (!editingSlot) return;

    const { day, timeSlot, divisionName, existingEntry } = editingSlot;

    const newEntryData: TimetableEntryType = {
      ...formData,
      day,
      timeSlot,
      divisionName,
    };

    // Validate the manually entered data
    const { valid, conflictType, conflictingEntry } = isMoveValid(timetable, newEntryData, day, timeSlot);

    if (!valid) {
      toast({
        variant: 'destructive',
        title: 'Invalid Entry',
        description: `${conflictType || 'Conflict detected'}. ${
          conflictingEntry
            ? `Conflicts with ${conflictingEntry.subjectCode} for ${conflictingEntry.divisionName} taught by ${conflictingEntry.facultyName} in ${conflictingEntry.roomNumber}.`
            : ''
        }`,
      });
      return; // Keep dialog open
    }

    // --- If valid, update timetable ---
    const updatedTimetable = [...timetable];
    const existingIndex = timetable.findIndex(
      (e) =>
        e.day === day &&
        e.timeSlot === timeSlot &&
        e.divisionName === divisionName
    );

    if (existingIndex > -1) {
      // Update existing entry
      updatedTimetable[existingIndex] = newEntryData;
    } else {
      // Add new entry
      updatedTimetable.push(newEntryData);
    }

    setTimetableData(prev => ({ ...prev, timetable: updatedTimetable }));
    saveDataToFirestore({ timetable: updatedTimetable });
    setIsEditDialogOpen(false); // Close dialog
     toast({
        title: 'Slot Updated',
        description: `Successfully updated slot for ${divisionName} on ${day} at ${timeSlot}.`,
      });
  };

  const handleClearSlot = () => {
    if (!editingSlot || !editingSlot.existingEntry) return;

    const { day, timeSlot, divisionName } = editingSlot.existingEntry;

    const updatedTimetable = timetable.filter(
      (e) => !(e.day === day && e.timeSlot === timeSlot && e.divisionName === divisionName)
    );

    setTimetableData(prev => ({ ...prev, timetable: updatedTimetable }));
    saveDataToFirestore({ timetable: updatedTimetable });
    setIsEditDialogOpen(false); // Close dialog
     toast({
        title: 'Slot Cleared',
        description: `Successfully cleared slot for ${divisionName} on ${day} at ${timeSlot}.`,
      });
  }


  // --- Helper to get entries for a cell ---
  const getEntriesForCell = (day: string, time: string, filterValue: string, filterBy: 'divisionName' | 'facultyName' | 'roomNumber') => {
    return timetable.filter(
      (entry) =>
        entry.day === day &&
        entry.timeSlot === time &&
        entry[filterBy] === filterValue
    );
  };

  // --- Droppable Cell Component (with Double Click) ---
  const DroppableCell = ({ day, time, children, currentDivision }: { day: string, time: string, children: React.ReactNode, currentDivision: string }) => {
    const { setNodeRef, isOver } = useSortable({ id: `${day}_${time}` });

    // Find if there's *any* entry in this cell for the *current division*
    const entryInCellForDivision = timetable.find(e => e.day === day && e.timeSlot === time && e.divisionName === currentDivision);

    return (
        <td
            ref={setNodeRef}
            className={`p-1 border align-top min-w-[150px] relative ${isOver ? 'bg-accent/20' : ''}`}
            onDoubleClick={() => openEditDialog(day, time, currentDivision, entryInCellForDivision)}
        >
            {children}
            {/* Show Add button only if cell is empty for this division */}
            {!entryInCellForDivision && (
                <button
                    onClick={() => openEditDialog(day, time, currentDivision)}
                    className="absolute top-1 right-1 p-1 bg-background/50 rounded opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
                    aria-label="Add entry"
                >
                    <PlusCircle className="h-4 w-4 text-green-600" />
                </button>
            )}
        </td>
    )
  }

  // --- Main Timetable View Component ---
  const TimetableView = ({ filterBy, filterValues }: { filterBy: 'divisionName' | 'facultyName' | 'roomNumber', filterValues: string[] }) => {

    const sortableIds = useMemo(() => {
        const cellIds = workingDays.flatMap(day => timeSlots.map(time => `${day}_${time}`));
        const entryIds = timetable.map(entry => `${entry.day}-${entry.timeSlot}-${entry.subjectCode}-${entry.divisionName}`);
        return [...cellIds, ...entryIds];
    }, [workingDays, timeSlots, timetable]);


    return (
        <Tabs defaultValue={filterValues.length > 0 ? filterValues[0] : undefined} className="w-full">
        <TabsList>
            {filterValues.map(val => <TabsTrigger key={val} value={val}>{val}</TabsTrigger>)}
        </TabsList>
        {filterValues.map(val => (
            <TabsContent key={val} value={val}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
             <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
                <Card>
                    <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-muted">
                            <tr>
                            <th className="p-2 border sticky left-0 bg-muted z-10">Day</th>
                            {timeSlots.map(time => <th key={time} className="p-2 border min-w-[150px]">{time}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {workingDays.map(day => (
                            <tr key={day}>
                                <td className="p-2 border font-semibold sticky left-0 bg-background z-10">{day}</td>
                                {timeSlots.map(time => (
                                <DroppableCell key={time} day={day} time={time} currentDivision={val}>
                                    {getEntriesForCell(day, time, val, filterBy).map((entry, i) => (
                                        <DraggableTimetableEntry
                                            key={`${i}-${entry.subjectCode}-${entry.divisionName}`} // Ensure key uniqueness
                                            entry={entry}
                                            filterBy={filterBy}
                                            onDoubleClick={openEditDialog.bind(null, entry.day, entry.timeSlot, entry.divisionName, entry)}
                                        />
                                    ))}
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
                    {activeId ? <div className="bg-primary/20 border border-primary/40 rounded-lg p-2 text-xs space-y-1 opacity-75">Dragging...</div> : null}
                </DragOverlay>
             </DndContext>
            </TabsContent>
        ))}
        </Tabs>
    );
  }

  // --- Download Handler ---
  const handleDownload = () => {
    // ... (keep your existing download logic here - no changes needed)
    if (!timetable || timetable.length === 0) {
      alert('No timetable data to download.');
      return;
    }
    const dataForCsv = timetable.map((entry) => {
      const subject = subjects.find(
        (s) => s.subjectCode === entry.subjectCode
      );
      const divisionData = timetableData.divisions.find( // Use original divisions data
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
        Branch: divisionData?.branch || 'N/A',
        Year: divisionData?.year || 'N/A',
      };
    });
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


  // --- Render ---
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight font-headline">Generated Timetable</h2>
        <div className="flex gap-2">
          <Button onClick={handleDownload} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
          <Button onClick={handleBackToSetup} variant="outline">
            Back to Setup
          </Button>
        </div>
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
           <TimetableView filterBy="facultyName" filterValues={faculty.map(f => f.facultyName)} />
        </TabsContent>
        <TabsContent value="room">
           <TimetableView filterBy="roomNumber" filterValues={rooms.map(r => r.roomNumber)} />
        </TabsContent>
      </Tabs>

      {/* --- Edit Slot Dialog --- */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingSlot?.existingEntry ? 'Edit Slot' : 'Add Slot'} - {editingSlot?.divisionName}
            </DialogTitle>
            <DialogDescription>
              Manually assign a subject, faculty, and room for {editingSlot?.day} at {editingSlot?.timeSlot}.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditFormSubmit)} className="space-y-4 py-4">
              <FormField
                control={editForm.control}
                name="subjectCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a subject" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                         <ScrollArea className="h-48">
                            {subjects
                              // Optionally filter subjects relevant to the division's branch/year
                              .filter(s => editingSlot?.divisionName?.startsWith(`${s.branch}-${s.year}`))
                              .map(s => (
                              <SelectItem key={s.id} value={s.subjectCode}>
                                {s.subjectCode} - {s.subjectName} ({s.type})
                              </SelectItem>
                            ))}
                         </ScrollArea>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="facultyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Faculty</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select faculty" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <ScrollArea className="h-48">
                            {faculty
                              // Optionally filter faculty qualified for the selected subject
                              .filter(f => {
                                const selectedSubject = editForm.watch('subjectCode');
                                return !selectedSubject || f.qualifiedSubjects.includes(selectedSubject);
                              })
                              .map(f => (
                              <SelectItem key={f.id} value={f.facultyName}>
                                {f.facultyName}
                              </SelectItem>
                            ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={editForm.control}
                name="roomNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select room" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <ScrollArea className="h-48">
                           {rooms
                             // Optionally filter rooms based on selected subject type
                            .filter(r => {
                                const selectedSubjectCode = editForm.watch('subjectCode');
                                const selectedSubject = subjects.find(s => s.subjectCode === selectedSubjectCode);
                                if (!selectedSubject) return true; // Show all if no subject selected
                                return selectedSubject.type === 'Lab' ? r.roomType === 'Lab' : r.roomType === 'Classroom';
                            })
                           .map(r => (
                              <SelectItem key={r.id} value={r.roomNumber}>
                                {r.roomNumber} ({r.roomType}, Cap: {r.capacity})
                              </SelectItem>
                            ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-2 sm:gap-0">
                  {editingSlot?.existingEntry && (
                    <Button type="button" variant="destructive" onClick={handleClearSlot} className="mr-auto">
                        <Trash2 className="mr-2 h-4 w-4"/> Clear Slot
                    </Button>
                  )}
                <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit">Save changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}