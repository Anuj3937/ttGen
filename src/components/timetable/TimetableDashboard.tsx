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

// --- Draggable Entry Component (with Single Click Edit) ---
const DraggableTimetableEntry = ({
  entry,
  filterBy,
  onEditClick, // Changed from onDoubleClick
}: {
  entry: TimetableEntryType;
  filterBy: 'divisionName' | 'facultyName' | 'roomNumber';
  onEditClick: (entry: TimetableEntryType) => void; // Pass handler
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
    >
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 text-xs space-y-1 mb-1 relative group">
        <p className="font-bold">{entry.subjectCode}</p>
        <p>{subject?.subjectName}</p>
        <p className="text-muted-foreground">{filterBy !== 'facultyName' ? entry.facultyName : ''}</p>
        <p className="text-muted-foreground">{filterBy !== 'roomNumber' ? `Room: ${entry.roomNumber}` : ''}</p>
         
         <button
            onClick={() => onEditClick(entry)}
            onMouseDown={(e) => e.stopPropagation()} // This prevents dnd-kit listeners from firing
            onTouchStart={(e) => e.stopPropagation()} // For touch devices
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
  
  // --- ADDED: State to track active tab ---
  const [activeTab, setActiveTab] = useState('division');

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

  // --- Destructure timetableData *once* for memo ---
  const { timetable, unassignedSubjects, subjects, rooms, faculty, divisions: rawDivisions, basicSetup } = timetableData;

  const { workingDays, timeSlots, divisions, facultyList, roomList, subjectList } = useMemo(() => {
    const workingDays = basicSetup?.workingDays || [];
    const timeSlots = basicSetup?.timeSlots || [];
    // 'divisions' will be the list of unique division names for the tab
    const divisions = Array.from(new Set(timetable.map(entry => entry.divisionName))).sort();
    // 'facultyList' will be the full faculty objects, and we'll map names for the tab
    const facultyList = faculty;
    // 'roomList' will be the full room objects, and we'll map names for the tab
    const roomList = rooms;
    const subjectList = subjects;
    return { workingDays, timeSlots, divisions, facultyList, roomList, subjectList };
  }, [basicSetup, timetable, faculty, rooms, subjects]);


  // --- Helper to get entries for a cell (re-used by download) ---
  const getEntriesForCell = (day: string, time: string, filterValue: string, filterBy: 'divisionName' | 'facultyName' | 'roomNumber') => {
    return timetable.filter(
      (entry) =>
        entry.day === day &&
        entry.timeSlot === time &&
        entry[filterBy] === filterValue
    );
  };

  // --- Combined Validation Logic ---
  const isSlotValid = useCallback((
    currentTimetable: TimetableEntryType[],
    entryDataToCheck: TimetableEntryType, // The new/moved entry's data
    newDay: string,
    newTimeSlot: string,
    originalEntryToIgnore?: TimetableEntryType | null // The entry we are moving/replacing
  ): { valid: boolean; conflictType?: string; conflictingEntry?: TimetableEntryType } => {
      
    const subjectDetails = subjectList.find(s => s.subjectCode === entryDataToCheck.subjectCode);
    const roomDetails = roomList.find(r => r.roomNumber === entryDataToCheck.roomNumber);
  
    for (const existingEntry of currentTimetable) {
      // If we are moving/replacing an entry, ignore the *original* entry in the list
      if (
        originalEntryToIgnore &&
        existingEntry.day === originalEntryToIgnore.day &&
        existingEntry.timeSlot === originalEntryToIgnore.timeSlot &&
        existingEntry.divisionName === originalEntryToIgnore.divisionName
      ) {
        continue;
      }
  
      // Check for conflicts at the *new* position
      if (existingEntry.day === newDay && existingEntry.timeSlot === newTimeSlot) {
        // Faculty Conflict
        if (existingEntry.facultyName === entryDataToCheck.facultyName) {
          return { valid: false, conflictType: 'Faculty Conflict', conflictingEntry: existingEntry };
        }
        // Room Conflict
        if (existingEntry.roomNumber === entryDataToCheck.roomNumber) {
          return { valid: false, conflictType: 'Room Conflict', conflictingEntry: existingEntry };
        }
        // Division Conflict
        if (existingEntry.divisionName === entryDataToCheck.divisionName) {
          return { valid: false, conflictType: 'Division Conflict', conflictingEntry: existingEntry };
        }
      }
    }
  
    // Room Type Check
    if (subjectDetails?.type === 'Lab' && roomDetails?.roomType !== 'Lab') {
        return { valid: false, conflictType: 'Room Type Conflict (Lab subject needs Lab room)' };
    }
    
    return { valid: true };
  }, [subjectList, roomList]); // Dependencies


  // --- Updated Drag Handlers ---
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null); // Reset active drag overlay

    if (!over || active.id === over.id) {
      return; // No move or dropped on itself
    }

    const [newDay, newTime] = (over.id as string).split('_'); // Dropped onto a cell 'day_time'
    if (!newDay || !newTime) {
      console.error("Invalid drop target ID:", over.id);
      return; // Dropped somewhere invalid
    }

    // --- All logic is now inside the state updater ---
    setTimetableData(prevData => {
      const oldTimetable = prevData.timetable;

      // 1. Find the entry *inside* the state updater using the active ID
      const activeEntry = oldTimetable.find(
        entry => `${entry.day}-${entry.timeSlot}-${entry.subjectCode}-${entry.divisionName}` === active.id
      );

      if (!activeEntry) {
        console.error("Could not find active entry *inside state updater*:", active.id);
        return prevData; // Return previous state, no change
      }

      // 2. Validate the move using the *current* timetable state
      const { valid, conflictType, conflictingEntry } = isSlotValid(
          oldTimetable, 
          activeEntry, 
          newDay, 
          newTime, 
          activeEntry // Pass the entry itself as the one to ignore from its *original* position
      );

      if (!valid) {
        toast({
          variant: 'destructive',
          title: 'Invalid Move',
          description: `${conflictType || 'Conflict detected'}. ${
            conflictingEntry
              ? `Conflicts with ${conflictingEntry.subjectCode} for ${conflictingEntry.divisionName}.`
              : ''
          }`,
        });
        return prevData; // Return previous state, no change
      }

      // 3. If Valid, Proceed with Update
      const activeEntryIndex = oldTimetable.findIndex(e => e === activeEntry);

      if (activeEntryIndex === -1) {
          console.error("Critical error: activeEntry found but its index was not. Aborting drag.");
          return prevData;
      }

      const newTimetable = [...oldTimetable]; // Create new array

      // Find if there's an entry in the 'over' slot *for the same division* to swap with
      const overEntryIndex = newTimetable.findIndex(
          e => e.day === newDay && e.timeSlot === newTime && e.divisionName === activeEntry.divisionName
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
        // Move to an empty slot for this division
        newTimetable[activeEntryIndex] = {
            ...activeEntry,
            day: newDay,
            timeSlot: newTime,
        };
      }

      // 4. Save the updated timetable to Firestore
      saveDataToFirestore({ timetable: newTimetable }); 
      
      // 5. Return the new state
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
    const { valid, conflictType, conflictingEntry } = isSlotValid(
        timetable, 
        newEntryData, 
        day, 
        timeSlot, 
        existingEntry // Pass the entry being *replaced* as the one to ignore
    );

    if (!valid) {
      toast({
        variant: 'destructive',
        title: 'Invalid Entry',
        description: `${conflictType || 'Conflict detected'}. ${
          conflictingEntry
            ? `Conflicts with ${conflictingEntry.subjectCode} for ${conflictingEntry.divisionName}.`
            : ''
        }`,
      });
      return; // Keep dialog open
    }

    // --- If valid, update timetable ---
    const updatedTimetable = [...timetable];
    
    // Find the *index* of the entry we are replacing (if it exists)
    const existingIndex = existingEntry 
      ? updatedTimetable.findIndex(
          (e) =>
            e.day === existingEntry.day &&
            e.timeSlot === existingEntry.timeSlot &&
            e.divisionName === existingEntry.divisionName
        )
      : -1;
    

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

    // Filter out the *exact* entry to be cleared
    const updatedTimetable = timetable.filter(
      (e) => !(
          e.day === day && 
          e.timeSlot === timeSlot && 
          e.divisionName === divisionName &&
          e.subjectCode === editingSlot.existingEntry?.subjectCode // Be precise
      )
    );

    setTimetableData(prev => ({ ...prev, timetable: updatedTimetable }));
    saveDataToFirestore({ timetable: updatedTimetable });
    setIsEditDialogOpen(false); // Close dialog
     toast({
        title: 'Slot Cleared',
        description: `Successfully cleared slot for ${divisionName} on ${day} at ${timeSlot}.`,
      });
  }

  // --- Droppable Cell Component (with Double Click for empty, Single Click for icon) ---
  const DroppableCell = ({ day, time, children, currentDivision }: { day: string, time: string, children: React.ReactNode, currentDivision: string }) => {
    const { setNodeRef, isOver } = useSortable({ id: `${day}_${time}` });

    // Find if there's *any* entry in this cell for the *current division*
    const entryInCellForDivision = timetable.find(e => e.day === day && e.timeSlot === time && e.divisionName === currentDivision);

    return (
        <td
            ref={setNodeRef}
            className={`p-1 border align-top min-w-[150px] relative ${isOver ? 'bg-accent/20' : ''}`}
            onDoubleClick={() => {
                // Only trigger add on double-click if the cell is empty
                if (!entryInCellForDivision) {
                    openEditDialog(day, time, currentDivision);
                }
            }}
        >
            {children}
            {/* Show Add button only if cell is empty for this division */}
            {!entryInCellForDivision && (
                <button
                    onClick={() => openEditDialog(day, time, currentDivision)}
                    onMouseDown={(e) => e.stopPropagation()} // Prevent drag/double-click issues
                    onTouchStart={(e) => e.stopPropagation()}
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
      <Tabs
        // Controlled component
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="division">View by Division</TabsTrigger>
          <TabsTrigger value="faculty">View by Faculty</TabsTrigger>
          <TabsTrigger value="room">View by Room</TabsTrigger>
        </TabsList>
        
        {/* --- Division Tab --- */}
        <TabsContent value="division">
            <TimetableGrid
                filterBy="divisionName"
                filterValues={divisions}
                sortableIds={sortableIds}
            />
        </TabsContent>

        {/* --- Faculty Tab --- */}
        <TabsContent value="faculty">
            <TimetableGrid
                filterBy="facultyName"
                filterValues={facultyList.map(f => f.facultyName).sort()}
                sortableIds={sortableIds}
            />
        </TabsContent>
        
        {/* --- Room Tab --- */}
        <TabsContent value="room">
            <TimetableGrid
                filterBy="roomNumber"
                filterValues={roomList.map(r => r.roomNumber).sort()}
                sortableIds={sortableIds}
            />
        </TabsContent>
      </Tabs>
    );
  };

  // --- Reusable Grid Component ---
  const TimetableGrid = ({
      filterBy,
      filterValues,
      sortableIds
  }: {
      filterBy: 'divisionName' | 'facultyName' | 'roomNumber',
      filterValues: string[],
      sortableIds: string[]
  }) => {
      // Find the *active* sub-tab (the specific division, faculty, or room)
      const [activeSubTab, setActiveSubTab] = useState(filterValues[0]);
      
      // Update sub-tab if filterValues change (e.g., new division added)
      useEffect(() => {
          if (!filterValues.includes(activeSubTab)) {
              setActiveSubTab(filterValues[0]);
          }
      }, [filterValues, activeSubTab]);
      
      return (
          <Tabs
              value={activeSubTab}
              onValueChange={setActiveSubTab}
              defaultValue={filterValues[0]}
              className="w-full"
          >
              <TabsList className="flex flex-wrap h-auto justify-start">
                  {filterValues.map((val) => (
                      <TabsTrigger key={val} value={val}>
                          {val}
                      </TabsTrigger>
                  ))}
              </TabsList>
              {filterValues.map((val) => (
                  <TabsContent key={val} value={val} className="mt-2">
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
                                          <table className="w-full text-sm text-left border-collapse">
                                              <thead className="bg-muted">
                                                  <tr>
                                                      <th className="p-2 border sticky left-0 bg-muted z-10">
                                                          Day
                                                      </th>
                                                      {timeSlots.map((time) => (
                                                          <th key={time} className="p-2 border min-w-[150px]">
                                                              {time}
                                                          </th>
                                                      ))}
                                                  </tr>
                                              </thead>
                                              <tbody>
                                                  {workingDays.map((day) => (
                                                      <tr key={day}>
                                                          <td className="p-2 border font-semibold sticky left-0 bg-background z-10">
                                                              {day}
                                                          </td>
                                                          {timeSlots.map((time) => (
                                                              <DroppableCell
                                                                  key={time}
                                                                  day={day}
                                                                  time={time}
                                                                  currentDivision={filterBy === 'divisionName' ? val : ''} // Pass division only if in division view
                                                              >
                                                                  {getEntriesForCell(day, time, val, filterBy).map(
                                                                      (entry, i) => (
                                                                          <DraggableTimetableEntry
                                                                              key={`${i}-${entry.subjectCode}-${entry.divisionName}`}
                                                                              entry={entry}
                                                                              filterBy={filterBy}
                                                                              onEditClick={() => openEditDialog(entry.day, entry.timeSlot, entry.divisionName, entry)}
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
                                  <div className="bg-primary/20 border border-primary/40 rounded-lg p-2 text-xs space-y-1 opacity-75">
                                      Dragging...
                                  </div>
                              ) : null}
                          </DragOverlay>
                      </DndContext>
                  </TabsContent>
              ))}
          </Tabs>
      );
  }

  // ---
  // --- *** NEW DOWNLOAD HANDLER *** ---
  // ---
  const handleDownload = () => {
    if (!timetable || timetable.length === 0) {
      toast({ variant: 'destructive', title: 'No timetable data to download.' });
      return;
    }

    // Determine which set of filters to use based on the active *main* tab
    let filterValues: string[];
    let filterBy: 'divisionName' | 'facultyName' | 'roomNumber';
    let mainTitle: string;

    if (activeTab === 'division') {
      filterValues = divisions;
      filterBy = 'divisionName';
      mainTitle = 'Timetable by Division';
    } else if (activeTab === 'faculty') {
      filterValues = facultyList.map(f => f.facultyName).sort();
      filterBy = 'facultyName';
      mainTitle = 'Timetable by Faculty';
    } else { // 'room'
      filterValues = roomList.map(r => r.roomNumber).sort();
      filterBy = 'roomNumber';
      mainTitle = 'Timetable by Room';
    }

    let csvContent = `"${mainTitle}"\r\n\r\n`; // Main title for the file

    // Helper function to format cell content
    const formatCellContent = (entries: TimetableEntryType[]) => {
      if (entries.length === 0) return ""; // Empty cell
      
      const cellStrings = entries.map(entry => {
        const subjectName = subjectList.find(s => s.subjectCode === entry.subjectCode)?.subjectName || '';
        let parts = [`${entry.subjectCode} (${subjectName})`];

        if (filterBy !== 'divisionName') parts.push(`Div: ${entry.divisionName}`);
        if (filterBy !== 'facultyName') parts.push(`Faculty: ${entry.facultyName}`);
        if (filterBy !== 'roomNumber') parts.push(`Room: ${entry.roomNumber}`);
        
        return parts.join(', '); // Join parts with a comma and space
      });
      
      // Join multiple entries in the same cell with a newline
      return cellStrings.join('\n');
    };

    // Create a grid for *each* item in the filter list (e.g., each division)
    for (const filterValue of filterValues) {
      csvContent += `"${filterValue}"\r\n`; // Add the sub-title (e.g., "CE-SE-A")
      
      // Add Header Row
      const header = ['Day', ...timeSlots].map(h => `"${h}"`).join(',');
      csvContent += header + '\r\n';

      // Add Data Rows (one for each day)
      for (const day of workingDays) {
        const row: string[] = [`"${day}"`]; // Start row with the day name
        
        for (const slot of timeSlots) {
          const entries = getEntriesForCell(day, slot, filterValue, filterBy);
          const cellContent = formatCellContent(entries);
          
          // Wrap in quotes and escape internal quotes
          row.push(`"${cellContent.replace(/"/g, '""')}"`); 
        }
        
        csvContent += row.join(',') + '\r\n';
      }
      csvContent += '\r\n'; // Add a blank line between tables
    }

    // --- Create and download the blob ---
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `timetable_${activeTab}_view.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  // --- *** END OF NEW DOWNLOAD HANDLER *** ---


  // --- Render ---
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight font-headline">Generated Timetable</h2>
        <div className="flex gap-2">
          <Button onClick={handleDownload} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download View
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
                const subject = subjectList.find(s => s.subjectCode === code);
                return <li key={code}>{subject ? `${code} - ${subject.subjectName}` : code}</li>
              })}
            </ul>
          </CardContent>
        </Card>
      )}
      
      {/* --- Main Tabs (Division, Faculty, Room) --- */}
      <TimetableView filterBy="divisionName" filterValues={divisions} />


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
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a subject" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                         <ScrollArea className="h-48">
                            {subjectList
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
                     <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select faculty" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <ScrollArea className="h-48">
                            {facultyList
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
                     <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select room" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <ScrollArea className="h-48">
                           {roomList
                             // Optionally filter rooms based on selected subject type
                            .filter(r => {
                                const selectedSubjectCode = editForm.watch('subjectCode');
                                const selectedSubject = subjectList.find(s => s.subjectCode === selectedSubjectCode);
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