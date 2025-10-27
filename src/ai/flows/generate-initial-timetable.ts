'use server';

/**
 * @fileOverview Generates an initial timetable draft based on the entered data.
 *
 * - generateInitialTimetable - A function that generates the initial timetable.
 * - GenerateInitialTimetableInput - The input type for the generateInitialTimetable function.
 * - GenerateInitialTimetableOutput - The return type for the generateInitialTimetable function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateInitialTimetableInputSchema = z.object({
  departmentName: z.string().describe('The name of the department.'),
  branches: z.array(z.string()).describe('The branches in the department.'),
  academicYear: z.string().describe('The academic year.'),
  semesterType: z.enum(['ODD', 'EVEN']).describe('The semester type.'),
  workingDays: z.array(z.string()).describe('The working days of the week.'),
  timeSlots: z.array(z.string()).describe('The time slots available.'),
  labSchedulingPreference: z
    .boolean()
    .describe('Whether afternoon slots are preferred for labs.'),
  divisions: z.array(
    z.object({
      branch: z.string().describe('The branch of the division.'),
      year: z.string().describe('The year of the division.'),
      semester: z.string().describe('The semester of the division.'),
      divisionName: z.string().describe('The name of the division.'),
      numberOfBatches: z.number().describe('The number of batches in the division.'),
    })
  ).describe('The divisions and batches.'),
  subjects: z.array(
    z.object({
      subjectCode: z.string().describe('The subject code.'),
      subjectName: z.string().describe('The subject name.'),
      branch: z.string().describe('The branch of the subject.'),
      year: z.string().describe('The year of the subject.'),
      semester: z.string().describe('The semester of the subject.'),
      theoryHoursPerWeek: z.number().describe('The number of theory hours per week.'),
      practicalHoursPerWeek: z.number().describe('The number of practical hours per week.'),
      type: z.string().describe('The type of the subject (Core, Lab, Elective, etc.).'),
    })
  ).describe('The subjects to be scheduled.'),
  faculty: z.array(
    z.object({
      facultyName: z.string().describe('The name of the faculty.'),
      employeeID: z.string().describe('The employee ID of the faculty.'),
      designation: z.string().describe('The designation of the faculty.'),
      maxWeeklyHours: z.number().describe('The maximum weekly hours of the faculty.'),
      qualifiedSubjects: z.array(z.string()).describe('The subjects the faculty is qualified to teach.'),
      preferLabs: z.boolean().describe('Whether the faculty prefers teaching labs.'),
    })
  ).describe('The faculty members available.'),
  rooms: z.array(
    z.object({
      roomNumber: z.string().describe('The room number.'),
      roomType: z.enum(['Lab', 'Classroom']).describe('The type of the room.'),
      capacity: z.number().describe('The capacity of the room.'),
      building: z.string().describe('The building the room is in.'),
    })
  ).describe('The rooms available.'),
});
export type GenerateInitialTimetableInput = z.infer<typeof GenerateInitialTimetableInputSchema>;

const GenerateInitialTimetableOutputSchema = z.object({
  timetable: z.array(
    z.object({
      subjectCode: z.string().describe('The subject code.'),
      facultyName: z.string().describe('The name of the faculty assigned.'),
      roomNumber: z.string().describe('The room number assigned.'),
      divisionName: z.string().describe('The division name.'),
      day: z.string().describe('The day of the week.'),
      timeSlot: z.string().describe('The time slot assigned.'),
    })
  ).describe('The generated timetable.'),
  unassignedSubjects: z.array(z.string()).describe('Subjects that could not be assigned.'),
});
export type GenerateInitialTimetableOutput = z.infer<typeof GenerateInitialTimetableOutputSchema>;

export async function generateInitialTimetable(input: GenerateInitialTimetableInput): Promise<GenerateInitialTimetableOutput> {
  return generateInitialTimetableFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateInitialTimetablePrompt',
  input: {schema: GenerateInitialTimetableInputSchema},
  output: {schema: GenerateInitialTimetableOutputSchema},
  prompt: `You are a timetable generation expert. Your task is to generate an initial timetable based on the provided data, adhering to several constraints.

Department Name: {{{departmentName}}}
Branches: {{#each branches}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
Academic Year: {{{academicYear}}}
Semester Type: {{{semesterType}}}
Working Days: {{#each workingDays}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
Time Slots: {{#each timeSlots}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
Lab Scheduling Preference: {{{labSchedulingPreference}}}

Divisions: {{#each divisions}}
- Branch: {{{this.branch}}}, Year: {{{this.year}}}, Semester: {{{this.semester}}}, Division: {{{this.divisionName}}}, Batches: {{{this.numberOfBatches}}}{{/each}}

Subjects: {{#each subjects}}
- Code: {{{this.subjectCode}}}, Name: {{{this.subjectName}}}, Branch: {{{this.branch}}}, Year: {{{this.year}}}, Semester: {{{this.semester}}}, Theory Hours: {{{this.theoryHoursPerWeek}}}, Practical Hours: {{{this.practicalHoursPerWeek}}}, Type: {{{this.type}}}{{/each}}

Faculty: {{#each faculty}}
- Name: {{{this.facultyName}}}, ID: {{{this.employeeID}}}, Designation: {{{this.designation}}}, Max Hours: {{{this.maxWeeklyHours}}}, Qualified Subjects: {{#each this.qualifiedSubjects}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}, Prefers Labs: {{{this.preferLabs}}}{{/each}}

Rooms: {{#each rooms}}
- Number: {{{this.roomNumber}}}, Type: {{{this.roomType}}}, Capacity: {{{this.capacity}}}, Building: {{{this.building}}}{{/each}}

Please generate a timetable as a JSON object with a 'timetable' array and an 'unassignedSubjects' array.

**Constraints:**
1.  **Faculty Conflict:** A faculty member cannot be assigned to two different classes in the same time slot.
2.  **Division Conflict:** A division cannot have two different subjects scheduled in the same time slot.
3.  **Room Conflict:** A room cannot be used for two different classes in the same time slot.
4.  **Consecutive Lectures:** A theory subject (any subject that is not type 'Lab') should not be scheduled in consecutive time slots for the same division on the same day.
5.  **Lab Sessions:** Subjects of type 'Lab' with 2 practical hours per week must be scheduled in a single, 2-hour consecutive block on one day.
6.  **Weekly Hours:** The total number of hours scheduled for each subject must match its 'theoryHoursPerWeek' and 'practicalHoursPerWeek'.
7.  **Faculty Load:** Do not exceed the 'maxWeeklyHours' for any faculty member.
8.  **Room Type:** 'Lab' type subjects must be assigned to rooms of type 'Lab'. 'Classroom' is for other subjects.
9.  **Lab Preference:** If 'labSchedulingPreference' is true, prioritize scheduling labs in the afternoon slots.

First, try to schedule all subjects. If a subject cannot be scheduled without violating the constraints, add its 'subjectCode' to the 'unassignedSubjects' array.
`,
});

const generateInitialTimetableFlow = ai.defineFlow(
  {
    name: 'generateInitialTimetableFlow',
    inputSchema: GenerateInitialTimetableInputSchema,
    outputSchema: GenerateInitialTimetableOutputSchema,
  },
  async input => {
    const maxRetries = 3;
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const {output} = await prompt(input);
        return output!;
      } catch (error) {
        attempt++;
        console.log(`Attempt ${attempt} failed. Retrying in 2 seconds...`);
        if (attempt >= maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    // This should not be reached, but typescript needs a return path.
    throw new Error('Timetable generation failed after multiple retries.');
  }
);
