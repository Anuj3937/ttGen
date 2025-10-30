import TimetableDashboard from "@/components/timetable/TimetableDashboard";
import { TimetableProvider } from "@/context/TimetableContext";

export default function DashboardPage() {
    return (
        <div className="p-4 md:p-6">
            <TimetableDashboard />
        </div>
    )
}