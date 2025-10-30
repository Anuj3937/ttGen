import { TimetableProvider } from "@/context/TimetableContext";
import Checkpoint5 from "@/components/checkpoints/Checkpoint5";

export default function RoomsPage() {
    return (
        <div className="p-4 md:p-6">
            <h2 className="text-2xl font-bold tracking-tight mb-4">Manage Rooms</h2>
            <p className="text-muted-foreground mb-6">Add, edit, or remove rooms for your department.</p>
            <Checkpoint5 />
        </div>
    )
}