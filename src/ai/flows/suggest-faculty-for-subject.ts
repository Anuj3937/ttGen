'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting qualified faculty for a given subject.
 *
 * The flow takes a subject and a list of faculty members as input, and returns a list of suggested faculty members who are qualified to teach the subject, considering their qualifications and availability.
 *
 * @exported {
 *   SuggestFacultyForSubjectInput: The input type for the suggestFacultyForSubject function.
 *   SuggestFacultyForSubjectOutput: The output type for the suggestFacultyForSubject function.
 *   suggestFacultyForSubject: The main function that triggers the flow.
 * }
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

/**
 * Input schema for the suggestFacultyForSubject flow.
 */
const SuggestFacultyForSubjectInputSchema = z.object({
  subjectCode: z.string().describe('The code of the subject to find faculty for.'),
  facultyList: z.array(
    z.object({
      employeeId: z.string().describe('The employee ID of the faculty member.'),
      facultyName: z.string().describe('The name of the faculty member.'),
      qualifiedSubjects: z.array(
        z.string().describe('A list of subject codes the faculty member is qualified to teach.')
      ).describe('The subjects the faculty member is qualified to teach.'),
      maxWeeklyHours: z.number().describe('The maximum number of hours the faculty member can teach per week.'),
      assignedHours: z.number().optional().describe('The number of hours the faculty member is currently assigned.'),
    })
  ).describe('A list of available faculty members.'),
});

export type SuggestFacultyForSubjectInput = z.infer<typeof SuggestFacultyForSubjectInputSchema>;

/**
 * Output schema for the suggestFacultyForSubject flow.
 */
const SuggestFacultyForSubjectOutputSchema = z.array(
  z.object({
    employeeId: z.string().describe('The employee ID of the suggested faculty member.'),
    facultyName: z.string().describe('The name of the suggested faculty member.'),
    reason: z.string().describe('The reason why this faculty member is suggested (e.g., qualified, available).'),
  })
).describe('A list of suggested faculty members for the subject.');

export type SuggestFacultyForSubjectOutput = z.infer<typeof SuggestFacultyForSubjectOutputSchema>;

/**
 * Wrapper function to trigger the suggestFacultyForSubject flow.
 * @param input - The input for the flow.
 * @returns A promise that resolves to the output of the flow.
 */
export async function suggestFacultyForSubject(input: SuggestFacultyForSubjectInput): Promise<SuggestFacultyForSubjectOutput> {
  return suggestFacultyForSubjectFlow(input);
}

/**
 * Prompt definition for suggesting faculty for a subject.
 */
const suggestFacultyForSubjectPrompt = ai.definePrompt({
  name: 'suggestFacultyForSubjectPrompt',
  input: {schema: SuggestFacultyForSubjectInputSchema},
  output: {schema: SuggestFacultyForSubjectOutputSchema},
  prompt: `You are an AI assistant designed to suggest qualified faculty members for a given subject.

Given the following subject code: {{{subjectCode}}}
And the following list of faculty members with their qualifications and assigned hours:

{{#each facultyList}}
- Name: {{facultyName}}, Employee ID: {{employeeId}}, Qualified Subjects: {{qualifiedSubjects}}, Max Hours: {{maxWeeklyHours}}, Assigned Hours: {{assignedHours}}
{{/each}}

Suggest faculty members who are qualified to teach the subject, considering their qualifications and availability (assigned hours vs. max hours). Explain briefly why each faculty is suggested.

Format your response as a JSON array of objects, where each object contains the employeeId, facultyName, and a brief reason for the suggestion.
`,
});

/**
 * Genkit flow definition for suggesting faculty for a subject.
 */
const suggestFacultyForSubjectFlow = ai.defineFlow(
  {
    name: 'suggestFacultyForSubjectFlow',
    inputSchema: SuggestFacultyForSubjectInputSchema,
    outputSchema: SuggestFacultyForSubjectOutputSchema,
  },
  async input => {
    const {output} = await suggestFacultyForSubjectPrompt(input);
    return output!;
  }
);
