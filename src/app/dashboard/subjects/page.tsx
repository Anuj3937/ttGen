import { TimetableProvider } from "@/context/TimetableContext";
import Checkpoint3 from "@/components/checkpoints/Checkpoint3";

export default function SubjectsPage() {
    return (
        <div className="p-4 md:p-6">
             <h2 className="text-2xl font-bold tracking-tight mb-4">Manage Subjects</h2>
             <p className="text-muted-foreground mb-6">Add, edit, or remove subjects for your department.</p>
            <Checkpoint3 />
        </div>
    )
}