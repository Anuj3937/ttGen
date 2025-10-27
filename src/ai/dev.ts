import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-faculty-for-subject.ts';
import '@/ai/flows/generate-initial-timetable.ts';
import '@/ai/flows/optimize-timetable-slot.ts';