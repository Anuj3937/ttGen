import { TimetableProvider } from "@/context/TimetableContext";
import Checkpoint2 from "@/components/checkpoints/Checkpoint2";

export default function DivisionsPage() {
    return (
        <TimetableProvider>
            <div className="p-4 md:p-6">
                <h2 className="text-2xl font-bold tracking-tight mb-4">Manage Divisions</h2>
                <p className="text-muted-foreground mb-6">Add, edit, or remove divisions for your department.</p>
                <Checkpoint2 />
            </div>
        </TimetableProvider>
    )
}
