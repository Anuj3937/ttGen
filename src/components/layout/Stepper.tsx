'use client';

import { useTimetable } from '@/context/TimetableContext';
import { cn } from '@/lib/utils';
import {
  FileText,
  Users,
  LayoutGrid,
  ClipboardList,
  DoorOpen,
  School,
  Sparkles,
} from 'lucide-react';
import React from 'react';

const steps = [
  { id: 1, name: 'Basic Setup', icon: School },
  { id: 2, name: 'Divisions', icon: LayoutGrid },
  { id: 3, name: 'Subjects', icon: ClipboardList },
  { id: 4, name: 'Faculty', icon: Users },
  { id: 5, name: 'Rooms', icon: DoorOpen },
  { id: 6, name: 'Generate', icon: Sparkles },
];

export default function Stepper() {
  const { step, setStep, isGenerated } = useTimetable();

  if (isGenerated) {
    return null; // Don't show stepper on the final timetable view
  }

  return (
    <nav className="grid items-start gap-1 text-sm font-medium">
      {steps.map((s) => {
        const isActive = step === s.id;
        const isCompleted = step > s.id;
        return (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            disabled={!isCompleted && !isActive}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed',
              {
                'bg-muted text-primary': isActive,
                'text-primary': isCompleted,
              }
            )}
          >
            <s.icon className="h-4 w-4" />
            {s.name}
          </button>
        );
      })}
    </nav>
  );
}
