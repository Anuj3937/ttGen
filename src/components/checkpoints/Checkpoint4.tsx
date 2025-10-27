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
import { facultySchema } from '@/lib/types';
import { FACULTY_DESIGNATIONS } from '@/lib/constants';
import { Checkbox } from '../ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import Papa from 'papaparse';
import { useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

const facultyListSchema = z.object({
  faculty: z.array(facultySchema),
});

export default function Checkpoint4() {
  const { timetableData, setTimetableData, nextStep, prevStep } =
    useTimetable();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof facultyListSchema>>({
    resolver: zodResolver(facultyListSchema),
    defaultValues: {
      faculty: timetableData.faculty.length > 0 ? timetableData.faculty : [
        {
          id: crypto.randomUUID(),
          facultyName: 'Dr. Smith',
          employeeId: 'EMP001',
          designation: 'Professor',
          maxWeeklyHours: 18,
          qualifiedSubjects: [],
          preferLabs: false,
        }
      ],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'faculty',
  });
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
             const transformedData = (results.data as any[]).map(item => ({
                ...item,
                maxWeeklyHours: Number(item.maxWeeklyHours),
                qualifiedSubjects: item.qualifiedSubjects ? item.qualifiedSubjects.split(',').map((s:string) => s.trim()) : [],
                preferLabs: item.preferLabs?.toLowerCase() === 'true' || item.preferLabs === '1'
            }));

            const parsedData = z.array(facultySchema.omit({id: true})).parse(transformedData);
            const dataWithIds = parsedData.map(item => ({ ...item, id: crypto.randomUUID() }));
            replace(dataWithIds);
            toast({
              title: 'Import Successful',
              description: `${parsedData.length} faculty members imported from CSV.`,
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

  const onSubmit = (data: z.infer<typeof facultyListSchema>) => {
    setTimetableData((prev) => ({ ...prev, faculty: data.faculty }));
    nextStep();
  };

  const subjectOptions = timetableData.subjects.map(s => ({
    label: `${s.subjectCode} - ${s.subjectName}`,
    value: s.subjectCode,
  }));

  return (
    <CheckpointWrapper
      title="Add Faculty"
      description="Enter faculty details, including their qualifications and teaching load."
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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Emp. ID</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Max Hours</TableHead>
                  <TableHead>Qualified Subjects</TableHead>
                  <TableHead>Prefers Labs</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`faculty.${index}.facultyName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} placeholder="Faculty Name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`faculty.${index}.employeeId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} placeholder="Employee ID" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`faculty.${index}.designation`}
                        render={({ field }) => (
                          <FormItem>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Designation" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {FACULTY_DESIGNATIONS.map((d) => (
                                  <SelectItem key={d} value={d}>
                                    {d}
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
                        name={`faculty.${index}.maxWeeklyHours`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="number" {...field} min={1}/>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`faculty.${index}.qualifiedSubjects`}
                        render={({ field }) => (
                          <FormItem>
                             <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                      "w-[200px] justify-between",
                                      !field.value?.length && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value?.length > 0
                                      ? `${field.value.length} selected`
                                      : "Select subjects"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[300px] p-0">
                                <Command>
                                  <CommandInput placeholder="Search subjects..." />
                                  <CommandList>
                                    <CommandEmpty>No subjects found.</CommandEmpty>
                                    <CommandGroup>
                                       <ScrollArea className="h-48">
                                      {subjectOptions.map((option) => (
                                        <CommandItem
                                          key={option.value}
                                          onSelect={() => {
                                            const selected = field.value || [];
                                            const newValue = selected.includes(option.value)
                                              ? selected.filter((v) => v !== option.value)
                                              : [...selected, option.value];
                                            field.onChange(newValue);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              (field.value || []).includes(option.value)
                                                ? "opacity-100"
                                                : "opacity-0"
                                            )}
                                          />
                                          {option.label}
                                        </CommandItem>
                                      ))}
                                      </ScrollArea>
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                     <TableCell>
                      <FormField
                        control={form.control}
                        name={`faculty.${index}.preferLabs`}
                        render={({ field }) => (
                          <FormItem className="flex justify-center">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
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
                facultyName: '',
                employeeId: '',
                designation: 'Assistant Professor',
                maxWeeklyHours: 18,
                qualifiedSubjects: [],
                preferLabs: false,
              })
            }
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Faculty
          </Button>
        </form>
      </Form>
    </CheckpointWrapper>
  );
}
