import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import {
  buildNewMilestoneRecord,
  buildNewProjectRecord,
  buildUpdatedMilestoneRecord,
  buildUpdatedProjectRecord,
  mapProjectView,
} from './builders';
import { AcademicRepository } from './repository';
import type {
  AcademicProjectRecord,
  AcademicProjectView,
  CreateMilestoneInput,
  CreateProjectInput,
  ProjectMilestoneRecord,
  UpdateMilestoneInput,
  UpdateProjectInput,
} from './types';

export * from './types';

export class AcademicService {
  private readonly repo: AcademicRepository;

  constructor(db: AppDatabase = getDb()) {
    this.repo = new AcademicRepository(db);
  }

  createProject(input: CreateProjectInput): AcademicProjectRecord {
    const { record, links } = buildNewProjectRecord(input);
    this.repo.insertProject(record);
    for (const link of links) {
      this.repo.insertLink(link);
    }
    return record;
  }

  updateProject(id: string, input: UpdateProjectInput): AcademicProjectRecord {
    const existing = this.repo.getProjectById(id);
    if (!existing) throw new Error(`PROJETO NÃO ENCONTRADO: ${id}`);

    const { record, links } = buildUpdatedProjectRecord(existing, input);
    this.repo.updateProject(id, record);

    if (links !== undefined) {
      this.repo.deleteLinksByProjectId(id);
      for (const link of links) {
        this.repo.insertLink(link);
      }
    }
    return record;
  }

  deleteProject(id: string): void {
    this.repo.deleteProject(id);
  }

  completeProject(id: string): void {
    const existing = this.repo.getProjectById(id);
    if (!existing) throw new Error(`PROJETO NÃO ENCONTRADO: ${id}`);
    this.repo.updateProject(id, {
      ...existing,
      status: 'COMPLETED',
      updatedAt: new Date().toISOString(),
    });
  }

  reopenProject(id: string): void {
    const existing = this.repo.getProjectById(id);
    if (!existing) throw new Error(`PROJETO NÃO ENCONTRADO: ${id}`);
    this.repo.updateProject(id, {
      ...existing,
      status: 'IN_PROGRESS',
      updatedAt: new Date().toISOString(),
    });
  }

  addMilestone(
    projectId: string,
    input: Omit<CreateMilestoneInput, 'projectId'>,
  ): ProjectMilestoneRecord {
    const record = buildNewMilestoneRecord(projectId, input);
    this.repo.insertMilestone(record);
    this.syncProjectStatusFromMilestones(projectId);
    return record;
  }

  updateMilestone(id: string, input: UpdateMilestoneInput): ProjectMilestoneRecord {
    const existing = this.repo.getMilestoneById(id);
    if (!existing) throw new Error(`MARCO NÃO ENCONTRADO: ${id}`);

    const updated = buildUpdatedMilestoneRecord(existing, input);
    this.repo.updateMilestone(id, updated);
    this.syncProjectStatusFromMilestones(existing.projectId);
    return updated;
  }

  toggleMilestone(id: string): ProjectMilestoneRecord {
    const existing = this.repo.getMilestoneById(id);
    if (!existing) throw new Error(`MARCO NÃO ENCONTRADO: ${id}`);

    const updated = { ...existing, isCompleted: !existing.isCompleted };
    this.repo.updateMilestone(id, updated);
    this.syncProjectStatusFromMilestones(existing.projectId);
    return updated;
  }

  deleteMilestone(id: string): void {
    const existing = this.repo.getMilestoneById(id);
    if (!existing) return;
    this.repo.deleteMilestone(id);
    this.syncProjectStatusFromMilestones(existing.projectId);
  }

  private syncProjectStatusFromMilestones(projectId: string): void {
    const project = this.repo.getProjectById(projectId);
    if (!project) return;

    const milestones = this.repo.getMilestonesByProjectId(projectId);
    if (milestones.length === 0) return;

    const allCompleted = milestones.every((m) => m.isCompleted);
    if (allCompleted && project.status === 'IN_PROGRESS') {
      this.repo.updateProject(projectId, {
        ...project,
        status: 'COMPLETED',
        updatedAt: new Date().toISOString(),
      });
    } else if (!allCompleted && project.status === 'COMPLETED') {
      this.repo.updateProject(projectId, {
        ...project,
        status: 'IN_PROGRESS',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  getProjectDetails(id: string): AcademicProjectView | null {
    const project = this.repo.getProjectById(id);
    if (!project) return null;

    const links = this.repo.getLinksByProjectId(id);
    const milestones = this.repo.getMilestonesByProjectId(id);
    return mapProjectView(project, links, milestones);
  }

  listProjectsByStatus(): {
    inProgress: AcademicProjectView[];
    completed: AcademicProjectView[];
  } {
    const all = this.repo.getAllProjects();
    const views = all
      .map((p) => this.getProjectDetails(p.id)!)
      .filter(Boolean)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      inProgress: views.filter((p) => p.status === 'IN_PROGRESS'),
      completed: views.filter((p) => p.status === 'COMPLETED'),
    };
  }
}
