'use client';

import { useTimetable } from '@/context/TimetableContext';
import CheckpointWrapper from './CheckpointWrapper';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Trash2, Upload } from 'lucide-react';
import { roomSchema } from '@/lib/types';
import { ROOM_TYPES } from '@/lib/constants';
import Papa from 'papaparse';
import { useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

const roomsSchema = z.object({
  rooms: z.array(roomSchema),
});

export default function Checkpoint5() {
  const { timetableData, nextStep, prevStep, saveDataToFirestore } = // Get new function
    useTimetable();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof roomsSchema>>({
    resolver: zodResolver(roomsSchema),
    defaultValues: {
      rooms:
        timetableData.rooms.length > 0
          ? timetableData.rooms
          : [
              {
                id: crypto.randomUUID(),
                roomNumber: 'CR-101',
                roomType: 'Classroom',
                capacity: 70,
                building: 'Main Building',
              },
              {
                id: crypto.randomUUID(),
                roomNumber: 'LAB-1',
                roomType: 'Lab',
                capacity: 30,
                building: 'Main Building',
              },
            ],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'rooms',
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const transformedData = (results.data as any[]).map((item) => ({
              ...item,
              capacity: Number(item.capacity),
            }));

            const parsedData = z
              .array(roomSchema.omit({ id: true }))
              .parse(transformedData);
            const dataWithIds = parsedData.map((item) => ({
              ...item,
              id: crypto.randomUUID(),
            }));
            replace(dataWithIds);
            toast({
              title: 'Import Successful',
              description: `${parsedData.length} rooms imported from CSV.`,
            });
          } catch (error) {
            if (error instanceof z.ZodError) {
              toast({
                variant: 'destructive',
                title: 'Import Failed',
                description: `CSV data is invalid. ${error.errors
                  .map((e) => `${e.path.join('.')}: ${e.message}`)
                  .join(', ')}`,
              });
            } else {
              toast({
                variant: 'destructive',
                title: 'Import Failed',
                description: 'An unexpected error occurred during CSV import.',
              });
            }
          }
        },
        error: (error) => {
          toast({
            variant: 'destructive',
            title: 'Import Failed',
            description: `Error parsing CSV file: ${error.message}`,
          });
        },
      });
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // --- UPDATED onSubmit ---
  const onSubmit = async (data: z.infer<typeof roomsSchema>) => {
    await saveDataToFirestore({ rooms: data.rooms });
    nextStep();
  };
  // --- END UPDATE ---

  return (
    <CheckpointWrapper
      title="Add Rooms"
      description="List all available classrooms and labs with their capacities."
      onNext={form.handleSubmit(onSubmit)}
      onBack={prevStep}
    >
      <Form {...form}>
        <form className="space-y-6">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import from CSV
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv"
              onChange={handleFileUpload}
            />
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room No.</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`rooms.${index}.roomNumber`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} placeholder="Room Number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`rooms.${index}.roomType`}
                        render={({ field }) => (
                          <FormItem>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Room Type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ROOM_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`rooms.${index}.capacity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="number" {...field} min={1} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`rooms.${index}.building`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} placeholder="Building Name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        disabled={fields.length <= 1}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                id: crypto.randomUUID(),
                roomNumber: '',
                roomType: 'Classroom',
                capacity: 70,
                building: 'Main Building',
              })
            }
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Room
          </Button>
        </form>
      </Form>
    </CheckpointWrapper>
  );
}