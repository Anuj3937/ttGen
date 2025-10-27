'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTimetable } from '@/context/TimetableContext';
import { basicSetupSchema, type BasicSetup } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import CheckpointWrapper from './CheckpointWrapper';
import { BRANCHES, WORKING_DAYS, TIME_SLOTS } from '@/lib/constants';

export default function Checkpoint1() {
  const { timetableData, setTimetableData, nextStep } = useTimetable();

  const form = useForm<BasicSetup>({
    resolver: zodResolver(basicSetupSchema),
    defaultValues: timetableData.basicSetup || {
      departmentName: 'Computer Engineering',
      academicYear: '2025-2026',
      branches: ['CE', 'CSBS'],
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      semesterType: 'ODD',
      timeSlots: [
        '09:00-10:00',
        '10:00-11:00',
        '11:00-12:00',
        '13:00-14:00',
        '14:00-15:00',
        '15:00-16:00',
        '16:00-17:00',
      ],
      labPreference: true,
    },
  });

  const onSubmit = (data: BasicSetup) => {
    setTimetableData((prev) => ({ ...prev, basicSetup: data }));
    nextStep();
  };

  return (
    <CheckpointWrapper
      title="Basic Setup"
      description="Configure the fundamental details for your department's timetable."
      onNext={form.handleSubmit(onSubmit)}
    >
      <Form {...form}>
        <form className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="departmentName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Computer Engineering" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="academicYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Academic Year</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 2025-2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="branches"
            render={() => (
              <FormItem>
                <div className="mb-4">
                  <FormLabel className="text-base">Branches</FormLabel>
                  <FormDescription>
                    Select the branches in your department.
                  </FormDescription>
                </div>
                <div className="flex flex-wrap gap-4">
                  {BRANCHES.map((item) => (
                    <FormField
                      key={item}
                      control={form.control}
                      name="branches"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={item}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(item)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), item])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== item
                                        )
                                      );
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {item}
                            </FormLabel>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="semesterType"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Semester Type</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex flex-col space-y-1"
                  >
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="ODD" />
                      </FormControl>
                      <FormLabel className="font-normal">ODD</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="EVEN" />
                      </FormControl>
                      <FormLabel className="font-normal">EVEN</FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="workingDays"
            render={() => (
              <FormItem>
                <div className="mb-4">
                  <FormLabel className="text-base">Working Days</FormLabel>
                </div>
                <div className="flex flex-wrap gap-4">
                {WORKING_DAYS.map((item) => (
                  <FormField
                    key={item}
                    control={form.control}
                    name="workingDays"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={item}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(item)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...(field.value || []), item])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== item
                                      )
                                    );
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {item}
                          </FormLabel>
                        </FormItem>
                      );
                    }}
                  />
                ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="timeSlots"
            render={() => (
              <FormItem>
                <div className="mb-4">
                  <FormLabel className="text-base">Time Slots</FormLabel>
                  <FormDescription>Select at least 4 teaching slots. Lunch break is non-teaching.</FormDescription>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Morning</h4>
                  <div className="flex flex-wrap gap-4">
                    {TIME_SLOTS.morning.map((item) => (
                      <TimeSlotCheckbox key={item} item={item} control={form.control} name="timeSlots" />
                    ))}
                  </div>
                  <h4 className="font-medium">Lunch (Non-teaching)</h4>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-3 p-2 bg-muted rounded-md">
                      <Checkbox checked disabled />
                      <label className="text-sm font-medium leading-none text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {TIME_SLOTS.lunch}
                      </label>
                    </div>
                  </div>
                  <h4 className="font-medium">Afternoon</h4>
                   <div className="flex flex-wrap gap-4">
                    {TIME_SLOTS.afternoon.map((item) => (
                      <TimeSlotCheckbox key={item} item={item} control={form.control} name="timeSlots" />
                    ))}
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="labPreference"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    Prefer afternoon slots for labs
                  </FormLabel>
                  <FormDescription>
                    Recommended, but not mandatory. The algorithm will prioritize this if checked.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </CheckpointWrapper>
  );
}

// Helper component for time slot checkboxes
const TimeSlotCheckbox = ({ item, control, name }: { item: string, control: any, name: "timeSlots" }) => (
   <FormField
    key={item}
    control={control}
    name={name}
    render={({ field }) => {
      return (
        <FormItem
          key={item}
          className="flex flex-row items-start space-x-3 space-y-0"
        >
          <FormControl>
            <Checkbox
              checked={field.value?.includes(item)}
              onCheckedChange={(checked) => {
                return checked
                  ? field.onChange([...(field.value || []), item])
                  : field.onChange(
                      field.value?.filter(
                        (value) => value !== item
                      )
                    );
              }}
            />
          </FormControl>
          <FormLabel className="font-normal">
            {item}
          </FormLabel>
        </FormItem>
      );
    }}
  />
);
