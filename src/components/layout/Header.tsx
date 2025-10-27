import { CalendarDays } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold font-headline tracking-tight">
          Timetable Ace
        </h1>
      </div>
    </header>
  );
}
