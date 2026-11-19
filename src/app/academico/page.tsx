import { AcademicService } from '@/features/academic/service';
import { AcademicDashboardClient } from '@/features/academic/components/AcademicDashboardClient';

export const dynamic = 'force-dynamic';

export default async function AcademicoPage() {
  const academicService = new AcademicService();
  const { planned, inProgress, completed } = await academicService.listProjectsByStatus();

  return (
    <AcademicDashboardClient
      planned={planned}
      inProgress={inProgress}
      completed={completed}
    />
  );
}
