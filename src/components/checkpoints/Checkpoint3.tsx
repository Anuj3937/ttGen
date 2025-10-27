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
import { subjectSchema } from '@/lib/types';
import {
  SEMESTER_YEARS_OPTIONS,
  SEMESTER_OPTIONS,
  SUBJECT_TYPES,
} from '@/lib/constants';
import Papa from 'papaparse';
import { useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

const subjectsSchema = z.object({
  subjects: z.array(subjectSchema),
});

export default function Checkpoint3() {
  const { timetableData, setTimetableData, nextStep, prevStep } =
    useTimetable();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof subjectsSchema>>({
    resolver: zodResolver(subjectsSchema),
    defaultValues: {
      subjects: timetableData.subjects.length > 0 ? timetableData.subjects : [{
        id: crypto.randomUUID(),
        subjectCode: 'CS301',
        subjectName: 'Data Structures',
        branch: timetableData.basicSetup?.branches[0] || '',
        year: 'SE',
        semester: 'III',
        theoryHoursPerWeek: 3,
        practicalHoursPerWeek: 2,
        type: 'Core',
      }],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'subjects',
  });
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            // Transform checkbox string to boolean
            const transformedData = (results.data as any[]).map(item => ({
                ...item,
                theoryHoursPerWeek: Number(item.theoryHoursPerWeek) || 0,
                practicalHoursPerWeek: Number(item.practicalHoursPerWeek) || 0,
            }));

            const parsedData = z.array(subjectSchema.omit({id: true})).parse(transformedData);
            const dataWithIds = parsedData.map(item => ({ ...item, id: crypto.randomUUID() }));
            replace(dataWithIds);
            toast({
              title: 'Import Successful',
              description: `${parsedData.length} subjects imported from CSV.`,
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

  const onSubmit = (data: z.infer<typeof subjectsSchema>) => {
    setTimetableData((prev) => ({ ...prev, subjects: data.subjects }));
    nextStep();
  };

  const selectedBranches = timetableData.basicSetup?.branches || [];

  return (
    <CheckpointWrapper
      title="Add Subjects"
      description="List all subjects to be taught, including their weekly hour requirements."
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
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[120px]">Branch</TableHead>
                  <TableHead className="w-[100px]">Year</TableHead>
                  <TableHead className="w-[100px]">Sem</TableHead>
                  <TableHead className="w-[100px]">Theory</TableHead>
                  <TableHead className="w-[100px]">Practical</TableHead>
                  <TableHead className="w-[130px]">Type</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`subjects.${index}.subjectCode`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`subjects.${index}.subjectName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`subjects.${index}.branch`}
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
                        name={`subjects.${index}.year`}
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
                        name={`subjects.${index}.semester`}
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
                        name={`subjects.${index}.theoryHoursPerWeek`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="number" {...field} min={0} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`subjects.${index}.practicalHoursPerWeek`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="number" {...field} min={0} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`subjects.${index}.type`}
                        render={({ field }) => (
                          <FormItem>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {SUBJECT_TYPES.map((type) => (
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
                subjectCode: '',
                subjectName: '',
                branch: timetableData.basicSetup?.branches[0] || '',
                year: 'SE',
                semester: 'III',
                theoryHoursPerWeek: 3,
                practicalHoursPerWeek: 0,
                type: 'Core',
              })
            }
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Subject
          </Button>
        </form>
      </Form>
    </CheckpointWrapper>
  );
}
