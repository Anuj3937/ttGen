import { z } from 'zod';

// Checkpoint 1: Basic Setup
export const basicSetupSchema = z.object({
  departmentName: z.string().min(1, 'Department name is required.'),
  branches: z.array(z.string()).min(1, 'Select at least one branch.'),
  academicYear: z.string().min(1, 'Academic year is required.'),
  semesterType: z.enum(['ODD', 'EVEN'], {
    required_error: 'Semester type is required.',
  }),
  workingDays: z.array(z.string()).min(1, 'Select at least one working day.'),
  timeSlots: z.array(z.string()).min(4, 'Select at least 4 time slots.'),
  labPreference: z.boolean().default(false),
});
export type BasicSetup = z.infer<typeof basicSetupSchema>;

// Checkpoint 2: Divisions & Batches
export const divisionSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  branch: z.string().min(1, 'Branch is required.'),
  year: z.string().min(1, 'Year is required.'),
  semester: z.string().min(1, 'Semester is required.'),
  divisionName: z.string().min(1, 'Division name is required.'),
  numberOfBatches: z
    .number({ coerce: true })
    .min(1, 'Number of batches must be at least 1.'),
  studentCount: z
    .number({ coerce: true })
    .min(1, 'Student count must be at least 1.'),
});
export type Division = z.infer<typeof divisionSchema>;

// Checkpoint 3: Subjects
export const subjectSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  subjectCode: z.string().min(1, 'Subject code is required.'),
  subjectName: z.string().min(1, 'Subject name is required.'),
  branch: z.string().min(1, 'Branch is required.'),
  year: z.string().min(1, 'Year is required.'),
  semester: z.string().min(1, 'Semester is required.'),
  theoryHoursPerWeek: z.number({ coerce: true }).min(0),
  practicalHoursPerWeek: z.number({ coerce: true }).min(0),
  type: z.string().min(1, 'Subject type is required.'),
}).refine(data => data.theoryHoursPerWeek + data.practicalHoursPerWeek > 0, {
    message: "Total hours (Theory + Practical) must be greater than 0.",
    path: ["theoryHoursPerWeek"],
});
export type Subject = z.infer<typeof subjectSchema>;


// Checkpoint 4: Faculty
export const facultySchema = z.object({
    id: z.string().default(() => crypto.randomUUID()),
    facultyName: z.string().min(1, 'Faculty name is required.'),
    employeeId: z.string().min(1, 'Employee ID is required.'),
    designation: z.string().min(1, 'Designation is required.'),
    maxWeeklyHours: z.number({ coerce: true }).min(1, 'Max hours must be at least 1.'),
    qualifiedSubjects: z.array(z.string()).min(1, 'Select at least one qualified subject.'),
    preferLabs: z.boolean().default(false),
});
export type Faculty = z.infer<typeof facultySchema>;


// Checkpoint 5: Rooms
export const roomSchema = z.object({
    id: z.string().default(() => crypto.randomUUID()),
    roomNumber: z.string().min(1, 'Room number is required.'),
    roomType: z.enum(['Lab', 'Classroom'], { required_error: 'Room type is required.' }),
    capacity: z.number({ coerce: true }).min(1, 'Capacity must be at least 1.'),
    building: z.string().min(1, 'Building is required.'),
});
export type Room = z.infer<typeof roomSchema>;

// Timetable Entry for generated schedule
export interface TimetableEntry {
  subjectCode: string;
  facultyName: string;
  roomNumber: string;
  divisionName: string;
  day: string;
  timeSlot: string;
}
