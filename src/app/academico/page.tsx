import { AcademicService } from '@/features/academic/service';
import { AcademicDashboardClient } from '@/features/academic/components/AcademicDashboardClient';

export const dynamic = 'force-dynamic';

export default function AcademicoPage() {
  const academicService = new AcademicService();
  const { inProgress, completed } = academicService.listProjectsByStatus();

  return <AcademicDashboardClient inProgress={inProgress} completed={completed} />;
}
