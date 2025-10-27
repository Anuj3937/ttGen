'use server';

/**
 * @fileOverview Suggests alternative timetable slots, considering faculty availability, room capacity, and subject requirements.
 *
 * - optimizeTimetableSlot - A function that handles the timetable slot optimization process.
 * - OptimizeTimetableSlotInput - The input type for the optimizeTimetableSlot function.
 * - OptimizeTimetableSlotOutput - The return type for the optimizeTimetableSlot function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const OptimizeTimetableSlotInputSchema = z.object({
  subject: z.string().describe('The subject to optimize the slot for.'),
  faculty: z.string().describe('The faculty assigned to the slot.'),
  room: z.string().describe('The room assigned to the slot.'),
  division: z.string().describe('The division assigned to the slot.'),
  currentTimeSlot: z.string().describe('The current time slot for the subject.'),
  availableTimeSlots: z.array(z.string()).describe('The list of available time slots.'),
  facultyAvailability: z
    .record(z.string(), z.array(z.string()))
    .describe('A map of faculty to their available time slots.'),
  roomAvailability: z
    .record(z.string(), z.array(z.string()))
    .describe('A map of rooms to their available time slots.'),
  subjectRequirements: z.string().describe('Any specific requirements for the subject.'),
});

export type OptimizeTimetableSlotInput = z.infer<typeof OptimizeTimetableSlotInputSchema>;

const OptimizeTimetableSlotOutputSchema = z.object({
  suggestedTimeSlots: z
    .array(z.string())
    .describe('A list of suggested time slots that meet the requirements.'),
  reasoning: z.string().describe('The reasoning behind the suggested time slots.'),
});

export type OptimizeTimetableSlotOutput = z.infer<typeof OptimizeTimetableSlotOutputSchema>;

export async function optimizeTimetableSlot(input: OptimizeTimetableSlotInput): Promise<
  OptimizeTimetableSlotOutput
> {
  return optimizeTimetableSlotFlow(input);
}

const optimizeTimetableSlotPrompt = ai.definePrompt({
  name: 'optimizeTimetableSlotPrompt',
  input: {schema: OptimizeTimetableSlotInputSchema},
  output: {schema: OptimizeTimetableSlotOutputSchema},
  prompt: `You are an AI assistant that suggests alternative timetable slots based on the following information:

Subject: {{{subject}}}
Faculty: {{{faculty}}}
Room: {{{room}}}
Division: {{{division}}}
Current Time Slot: {{{currentTimeSlot}}}
Available Time Slots: {{#each availableTimeSlots}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
Faculty Availability: {{#each facultyAvailability}}{{{@key}}}: {{#each this}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}\n{{/each}}
Room Availability: {{#each roomAvailability}}{{{@key}}}: {{#each this}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}\n{{/each}}
Subject Requirements: {{{subjectRequirements}}}

Considering the above information, suggest alternative time slots that meet the requirements and provide a reasoning for your suggestions.
`,
});

const optimizeTimetableSlotFlow = ai.defineFlow(
  {
    name: 'optimizeTimetableSlotFlow',
    inputSchema: OptimizeTimetableSlotInputSchema,
    outputSchema: OptimizeTimetableSlotOutputSchema,
  },
  async input => {
    const {output} = await optimizeTimetableSlotPrompt(input);
    return output!;
  }
);
