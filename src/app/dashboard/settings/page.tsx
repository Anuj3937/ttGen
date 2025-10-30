import { TimetableProvider } from "@/context/TimetableContext";
import Checkpoint1 from "@/components/checkpoints/Checkpoint1";

export default function SettingsPage() {
    return (
        <TimetableProvider>
            <div className="p-4 md:p-6">
                <h2 className="text-2xl font-bold tracking-tight mb-4">General Settings</h2>
                <p className="text-muted-foreground mb-6">Manage the basic setup for your department's timetable.</p>
                <Checkpoint1 />
            </div>
        </TimetableProvider>
    )
}
