// [COPY/PASTE THE ENTIRE FILE]
//
// src/ai/flows/generate-initial-timetable.ts

'use server';

/**
 * @fileOverview Generates a slotted timetable from a pre-allocated list of classes.
 *
 * This flow does NOT allocate faculty. It only places pre-allocated
 * classes into time slots based on a set of constraints.
 *
 * - generateInitialTimetable - A function that places entries into slots.
 * - GenerateInitialTimetableInput - The input type (list of pre-allocated entries).
 * - GenerateInitialTimetableOutput - The output type (list of slotted entries).
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod'; // <-- CORRECTED IMPORT

// This is the schema for a single pre-allocated class.
// This is the INPUT to the AI.
const AllocationEntrySchema = z.object({
  id: z.string().describe('A unique identifier for this class entry.'),
  subjectCode: z.string().describe('The subject code.'),
  subjectName: z.string().describe('The name of the subject.'),
  facultyName: z.string().describe('The faculty member pre-assigned to this class.'),
  divisionName: z.string().describe('The division this class is for (e.g., "CE-SE-A").'),
  batchIdentifier: z.string().optional().describe('The specific batch, if this is a lab (e.g., "B1", "B2").'),
  roomType: z.enum(['Lab', 'Classroom']).describe('The required room type.'),

  // This is the key field for conflict detection.
  // "CE-SE-A" for theory (whole class busy)
  // "CE-SE-A_B1" for a lab (only batch 1 is busy)
  schedulableUnit: z.string().describe('The unit that is busy. Batches from the same division (e.g., "CE-SE-A_B1", "CE-SE-A_B2") are different units and CAN be scheduled at the same time.'),

  duration: z.number().describe('The number of consecutive time slots this class requires (e.g., 1 for theory, 2 for lab).'),
});

// This is the input schema for the *entire flow*.
const GenerateInitialTimetableInputSchema = z.object({
  allocations: z.array(AllocationEntrySchema).describe('The list of pre-allocated classes to be scheduled.'),
  rooms: z.array(
    z.object({
      roomNumber: z.string(),
      roomType: z.enum(['Lab', 'Classroom']),
    })
  ).describe('The list of available rooms and their types.'),
  workingDays: z.array(z.string()).describe('The working days of the week.'),
  timeSlots: z.array(z.string()).describe('The time slots available each day.'),
  labSchedulingPreference: z
    .boolean()
    .describe('Whether afternoon slots are preferred for labs.'),
});

export type GenerateInitialTimetableInput = z.infer<typeof GenerateInitialTimetableInputSchema>;

// This is the schema for a single *slotted* class.
// This is the OUTPUT from the AI.
const TimetableEntrySchema = z.object({
  subjectCode: z.string().describe('The subject code.'),
  facultyName: z.string().describe('The name of the faculty assigned.'),
  roomNumber: z.string().describe('The room number assigned.'),
  divisionName: z.string().describe('The division name (e.g., "CE-SE-A").'),
  batchIdentifier: z.string().optional().describe('The batch identifier if it was a lab (e.g., "B1").'),
  day: z.string().describe('The day of the week.'),
  timeSlot: z.string().describe('The *starting* time slot assigned.'),
  // Note: The AI will just return the single TimetableEntry.
  // Our frontend will understand that a 2-hour lab at 13:00 also occupies 14:00.
});

// The output of the flow is a list of slotted entries and a list of failures.
const GenerateInitialTimetableOutputSchema = z.object({
  timetable: z.array(TimetableEntrySchema).describe('The generated timetable with assigned slots.'),
  unassignedEntries: z.array(z.string()).describe('A list of IDs for allocations that could not be scheduled.'),
});

export type GenerateInitialTimetableOutput = z.infer<typeof GenerateInitialTimetableOutputSchema>;

export async function generateInitialTimetable(input: GenerateInitialTimetableInput): Promise<
  GenerateInitialTimetableOutput
> {
  return generateInitialTimetableFlow(input);
}

// <-- RENAMED VARIABLE for clarity and safety
const generateInitialTimetablePrompt = ai.definePrompt({
  name: 'generateInitialTimetablePrompt',
  input: { schema: GenerateInitialTimetableInputSchema },
  output: { schema: GenerateInitialTimetableOutputSchema },
  prompt: `You are a highly intelligent scheduling assistant. Your task is to take a list of pre-allocated classes and assign each one to a valid room, day, and time slot. You MUST NOT change the faculty, subject, or division.

**Available Resources:**
Working Days: {{#each workingDays}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
Time Slots: {{#each timeSlots}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}} (Total {{timeSlots.length}} slots per day)
Rooms: {{#each rooms}}
- {{{this.roomNumber}}} (Type: {{{this.roomType}}}){{/each}}
Lab Preference: {{{labSchedulingPreference}}}

**Classes to Schedule:**
{{#each allocations}}
- ID: {{{this.id}}}
  Entry: {{{this.subjectName}}} ({{{this.subjectCode}}})
  Faculty: {{{this.facultyName}}}
  Unit: {{{this.schedulableUnit}}}
  Duration: {{{this.duration}}} slots
  Room Type: {{{this.roomType}}}
  {{#if this.batchIdentifier}}Batch: {{{this.batchIdentifier}}}{{/if}}
{{/each}}

**SCHEDULING CONSTRAINTS (MANDATORY):**
1.  **Faculty Conflict:** A faculty member (e.g., "{{allocations.[0].facultyName}}") cannot be in two places at once.
2.  **Room Conflict:** A room (e.g., "CR-101") cannot be used by two classes at once.
3.  **Unit Conflict:** A schedulable unit (e.g., "{{allocations.[0].schedulableUnit}}") cannot have two classes at the same time.
    * **CRITICAL:** Units like "CE-SE-A_B1" and "CE-SE-A_B2" are DIFFERENT. They represent different batches and CAN be scheduled at the same time (e.g., A1 in DSA Lab, A2 in OS Lab). A unit like "CE-SE-A" (for theory) is for the *entire* division and IS NOT THE SAME as "CE-SE-A_B1".
4.  **Consecutive Duration:** An entry with \`duration: 2\` MUST be scheduled in two *consecutive* time slots (e.g., "13:00-14:00" and "14:00-15:00"). Assign the *starting* slot. Do not schedule a 2-hour lab in the last slot of the day.
5.  **Room Type:** An entry requiring a 'Lab' room MUST be assigned to a 'Lab' room. 'Classroom' entries must go in 'Classroom' rooms.
6.  **Lab Preference:** If \`labSchedulingPreference\` is true, try to schedule 'Lab' roomType entries in the afternoon.
7.  **Consecutive Theory:** A specific 'schedulableUnit' (e.g., "CE-SE-A") should not have the same theory subject (e.g., "DSA") in consecutive slots on the same day.

**Output:**
Return a JSON object with two keys:
1.  \`timetable\`: An array of objects. Each object must be a *successfully scheduled* class and include: \`subjectCode\`, \`facultyName\`, \`roomNumber\`, \`divisionName\`, \`batchIdentifier\` (if present), \`day\`, and \`timeSlot\` (the *starting* slot).
2.  \`unassignedEntries\`: An array of \`id\` strings for any allocation entries you could not schedule without violating a constraint.
`,
});

const generateInitialTimetableFlow = ai.defineFlow(
  {
    name: 'generateInitialTimetableFlow',
    inputSchema: GenerateInitialTimetableInputSchema,
    outputSchema: GenerateInitialTimetableOutputSchema,
  },
  async (input) => {
    const maxRetries = 3;
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        // <-- USING RENAMED VARIABLE
        const { output } = await generateInitialTimetablePrompt(input);
        return output!;
      } catch (error) {
        attempt++;
        console.error(`Attempt ${attempt} failed. Retrying...`, error);
        if (attempt >= maxRetries) {
          console.error('Timetable generation failed after multiple retries.');
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    // This should not be reached
    throw new Error('Timetable generation failed.');
  }
);