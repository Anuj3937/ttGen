import TimetableDashboard from "@/components/timetable/TimetableDashboard";
import { TimetableProvider } from "@/context/TimetableContext";

export default function DashboardPage() {
    return (
        <TimetableProvider>
            <div className="p-4 md:p-6">
                <TimetableDashboard />
            </div>
        </TimetableProvider>
    )
}
