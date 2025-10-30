'use client';

import {
  Book,
  CalendarDays,
  DoorOpen,
  LayoutGrid,
  Plus,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { useSetup } from '@/context/SetupContext';

const menuItems = [
  { href: '/dashboard/subjects', label: 'Subjects', icon: Book },
  { href: '/dashboard/faculty', label: 'Faculty', icon: Users },
  { href: '/dashboard/rooms', label: 'Rooms', icon: DoorOpen },
  { href: '/dashboard/divisions', label: 'Divisions', icon: LayoutGrid },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { resetSetup, departmentSetupId } = useSetup();
  const router = useRouter();

  const handleNewSetup = () => {
    resetSetup();
    router.push('/');
    router.refresh();
  };

  return (
    <SidebarProvider>
      <Sidebar side="left" variant="sidebar" collapsible="icon">
        <SidebarHeader>
          <div className="flex w-full items-center justify-between p-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 font-headline text-lg font-semibold tracking-tight text-foreground"
            >
              <CalendarDays className="size-6 text-primary" />
              <span className="group-data-[collapsible=icon]:hidden">
                Timetable Ace
              </span>
            </Link>
            <SidebarTrigger className="hidden md:flex" />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <Button
                onClick={handleNewSetup}
                className="w-full justify-start"
              >
                <Plus />
                <span>New Timetable Setup</span>
              </Button>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <Link href={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          {departmentSetupId && (
             <div className="p-2 group-data-[collapsible=icon]:hidden">
                <p className="text-xs text-muted-foreground">Current Setup ID:</p>
                <p className="text-xs font-mono break-all">{departmentSetupId}</p>
             </div>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
