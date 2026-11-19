import { AcademicService } from '@/features/academic/service';
import { AcademicDashboardClient } from '@/features/academic/components/AcademicDashboardClient';

export const dynamic = 'force-dynamic';

export default function AcademicoPage() {
  const academicService = new AcademicService();
  const { planned, inProgress, completed } = academicService.listProjectsByStatus();

  return (
    <AcademicDashboardClient
      planned={planned}
      inProgress={inProgress}
      completed={completed}
    />
  );
}
