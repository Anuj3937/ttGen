import { TimetableProvider } from "@/context/TimetableContext";
import Checkpoint4 from "@/components/checkpoints/Checkpoint4";

export default function FacultyPage() {
    return (
        <div className="p-4 md:p-6">
             <h2 className="text-2xl font-bold tracking-tight mb-4">Manage Faculty</h2>
             <p className="text-muted-foreground mb-6">Add, edit, or remove faculty for your department.</p>
            <Checkpoint4 />
        </div>
    )
}