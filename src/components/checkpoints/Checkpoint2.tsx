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
  FormLabel,
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
import { divisionSchema, type Division } from '@/lib/types';
import {
  SEMESTER_YEARS_OPTIONS,
  SEMESTER_OPTIONS,
} from '@/lib/constants';
import Papa from 'papaparse';
import { useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

const divisionsSchema = z.object({
  divisions: z.array(divisionSchema),
});

export default function Checkpoint2() {
  const { timetableData, setTimetableData, nextStep, prevStep } =
    useTimetable();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof divisionsSchema>>({
    resolver: zodResolver(divisionsSchema),
    defaultValues: {
      divisions: timetableData.divisions.length > 0 ? timetableData.divisions : [{
        id: crypto.randomUUID(),
        branch: timetableData.basicSetup?.branches[0] || '',
        year: 'SE',
        semester: 'III',
        divisionName: 'A',
        numberOfBatches: 2,
        studentCount: 60,
      }],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'divisions',
  });

  const onSubmit = (data: z.infer<typeof divisionsSchema>) => {
    setTimetableData((prev) => ({ ...prev, divisions: data.divisions }));
    nextStep();
  };
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const parsedData = z.array(divisionSchema.omit({id: true})).parse(results.data);
            const dataWithIds = parsedData.map(item => ({ ...item, id: crypto.randomUUID() }));
            replace(dataWithIds);
            toast({
              title: 'Import Successful',
              description: `${parsedData.length} divisions imported from CSV.`,
            });
          } catch (error) {
            if (error instanceof z.ZodError) {
               toast({
                variant: 'destructive',
                title: 'Import Failed',
                description: `CSV data is invalid. ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
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
        }
      });
    }
    // Reset file input
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };


  const selectedBranches = timetableData.basicSetup?.branches || [];

  return (
    <CheckpointWrapper
      title="Divisions & Batches"
      description="Define the structure of classes for each branch and year."
      onNext={form.handleSubmit(onSubmit)}
      onBack={prevStep}
    >
      <Form {...form}>
        <form className="space-y-6">
        <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Batches</TableHead>
                <TableHead>Students</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`divisions.${index}.branch`}
                      render={({ field }) => (
                        <FormItem>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Branch" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {selectedBranches.map((branch) => (
                                <SelectItem key={branch} value={branch}>
                                  {branch}
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
                      name={`divisions.${index}.year`}
                      render={({ field }) => (
                        <FormItem>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Year" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SEMESTER_YEARS_OPTIONS.map((year) => (
                                <SelectItem key={year} value={year}>
                                  {year}
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
                      name={`divisions.${index}.semester`}
                      render={({ field }) => (
                        <FormItem>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sem" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SEMESTER_OPTIONS.map((sem) => (
                                <SelectItem key={sem} value={sem}>
                                  {sem}
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
                      name={`divisions.${index}.divisionName`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} placeholder="e.g., A" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`divisions.${index}.numberOfBatches`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                     <FormField
                      control={form.control}
                      name={`divisions.${index}.studentCount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="number" {...field} />
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                id: crypto.randomUUID(),
                branch: timetableData.basicSetup?.branches[0] || '',
                year: 'SE',
                semester: 'III',
                divisionName: String.fromCharCode(65 + fields.length), // A, B, C...
                numberOfBatches: 2,
                studentCount: 60,
              })
            }
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Division
          </Button>
        </form>
      </Form>
    </CheckpointWrapper>
  );
}
