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

  insertProject(record: AcademicProjectRecord): void {
    this.db.insert(schema.academicProjects).values(record).run();
  }

  getProjectById(id: string): AcademicProjectRecord | undefined {
    return this.db
      .select()
      .from(schema.academicProjects)
      .where(eq(schema.academicProjects.id, id))
      .get();
  }

  getAllProjects(): AcademicProjectRecord[] {
    return this.db.select().from(schema.academicProjects).all();
  }

  updateProject(id: string, record: AcademicProjectRecord): void {
    this.db
      .update(schema.academicProjects)
      .set(record)
      .where(eq(schema.academicProjects.id, id))
      .run();
  }

  deleteProject(id: string): void {
    this.db.delete(schema.projectMilestones).where(eq(schema.projectMilestones.projectId, id)).run();
    this.db.delete(schema.projectLinks).where(eq(schema.projectLinks.projectId, id)).run();
    this.db.delete(schema.academicProjects).where(eq(schema.academicProjects.id, id)).run();
  }

  insertLink(record: ProjectLinkRecord): void {
    this.db.insert(schema.projectLinks).values(record).run();
  }

  getLinksByProjectId(projectId: string): ProjectLinkRecord[] {
    return this.db
      .select()
      .from(schema.projectLinks)
      .where(eq(schema.projectLinks.projectId, projectId))
      .all();
  }

  deleteLinksByProjectId(projectId: string): void {
    this.db.delete(schema.projectLinks).where(eq(schema.projectLinks.projectId, projectId)).run();
  }

  insertMilestone(record: ProjectMilestoneRecord): void {
    this.db.insert(schema.projectMilestones).values(record).run();
  }

  getMilestoneById(id: string): ProjectMilestoneRecord | undefined {
    return this.db
      .select()
      .from(schema.projectMilestones)
      .where(eq(schema.projectMilestones.id, id))
      .get();
  }

  getMilestonesByProjectId(projectId: string): ProjectMilestoneRecord[] {
    return this.db
      .select()
      .from(schema.projectMilestones)
      .where(eq(schema.projectMilestones.projectId, projectId))
      .orderBy(asc(schema.projectMilestones.sortOrder), asc(schema.projectMilestones.dueDate))
      .all();
  }

  updateMilestone(id: string, record: ProjectMilestoneRecord): void {
    this.db
      .update(schema.projectMilestones)
      .set(record)
      .where(eq(schema.projectMilestones.id, id))
      .run();
  }

  deleteMilestone(id: string): void {
    this.db.delete(schema.projectMilestones).where(eq(schema.projectMilestones.id, id)).run();
  }
}
