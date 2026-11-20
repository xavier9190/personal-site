import { asc, eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db';
import * as schema from './schema';
import type {
  AcademicProjectRecord,
  ProjectLinkRecord,
  ProjectMilestoneRecord,
} from './types';

export class AcademicRepository {
  constructor(private readonly db: AppDatabase) {}

  async insertProject(record: AcademicProjectRecord): Promise<void> {
    await this.db.insert(schema.academicProjects).values(record);
  }

  async getProjectById(id: string): Promise<AcademicProjectRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.academicProjects)
      .where(eq(schema.academicProjects.id, id));
    return row;
  }

  async getAllProjects(): Promise<AcademicProjectRecord[]> {
    return this.db.select().from(schema.academicProjects);
  }

  async updateProject(id: string, record: AcademicProjectRecord): Promise<void> {
    await this.db
      .update(schema.academicProjects)
      .set(record)
      .where(eq(schema.academicProjects.id, id));
  }

  async deleteProject(id: string): Promise<void> {
    await this.db.delete(schema.projectMilestones).where(eq(schema.projectMilestones.projectId, id));
    await this.db.delete(schema.projectLinks).where(eq(schema.projectLinks.projectId, id));
    await this.db.delete(schema.academicProjects).where(eq(schema.academicProjects.id, id));
  }

  async insertLink(record: ProjectLinkRecord): Promise<void> {
    await this.db.insert(schema.projectLinks).values(record);
  }

  async getLinksByProjectId(projectId: string): Promise<ProjectLinkRecord[]> {
    return this.db
      .select()
      .from(schema.projectLinks)
      .where(eq(schema.projectLinks.projectId, projectId));
  }

  async getAllLinks(): Promise<ProjectLinkRecord[]> {
    return this.db.select().from(schema.projectLinks);
  }

  async deleteLinksByProjectId(projectId: string): Promise<void> {
    await this.db.delete(schema.projectLinks).where(eq(schema.projectLinks.projectId, projectId));
  }

  async insertMilestone(record: ProjectMilestoneRecord): Promise<void> {
    await this.db.insert(schema.projectMilestones).values(record);
  }

  async getMilestoneById(id: string): Promise<ProjectMilestoneRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.projectMilestones)
      .where(eq(schema.projectMilestones.id, id));
    return row;
  }

  async getMilestonesByProjectId(projectId: string): Promise<ProjectMilestoneRecord[]> {
    return this.db
      .select()
      .from(schema.projectMilestones)
      .where(eq(schema.projectMilestones.projectId, projectId))
      .orderBy(asc(schema.projectMilestones.sortOrder), asc(schema.projectMilestones.dueDate));
  }

  async getAllMilestones(): Promise<ProjectMilestoneRecord[]> {
    return this.db
      .select()
      .from(schema.projectMilestones)
      .orderBy(asc(schema.projectMilestones.sortOrder), asc(schema.projectMilestones.dueDate));
  }

  async updateMilestone(id: string, record: ProjectMilestoneRecord): Promise<void> {
    await this.db
      .update(schema.projectMilestones)
      .set(record)
      .where(eq(schema.projectMilestones.id, id));
  }

  async deleteMilestone(id: string): Promise<void> {
    await this.db.delete(schema.projectMilestones).where(eq(schema.projectMilestones.id, id));
  }
}
