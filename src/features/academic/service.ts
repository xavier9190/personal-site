import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import {
  buildNewMilestoneRecord,
  buildNewProjectLinkRecord,
  buildNewProjectRecord,
  buildUpdatedMilestoneRecord,
  buildUpdatedProjectLinkRecord,
  buildUpdatedProjectRecord,
  mapProjectView,
} from './builders';
import { AcademicRepository } from './repository';
import type {
  AcademicProjectRecord,
  AcademicProjectView,
  CreateMilestoneInput,
  CreateProjectInput,
  CreateProjectLinkInput,
  ProjectLinkRecord,
  ProjectMilestoneRecord,
  UpdateMilestoneInput,
  UpdateProjectInput,
  UpdateProjectLinkInput,
} from './types';

export * from './types';

export class AcademicService {
  private readonly repo: AcademicRepository;

  constructor(db: AppDatabase = getDb()) {
    this.repo = new AcademicRepository(db);
  }

  async createProject(input: CreateProjectInput): Promise<AcademicProjectRecord> {
    const { record, links } = buildNewProjectRecord(input);
    await this.repo.insertProject(record);
    for (const link of links) {
      await this.repo.insertLink(link);
    }
    return record;
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<AcademicProjectRecord> {
    const existing = await this.repo.getProjectById(id);
    if (!existing) throw new Error(`PROJETO NÃO ENCONTRADO: ${id}`);

    const { record, links } = buildUpdatedProjectRecord(existing, input);
    await this.repo.updateProject(id, record);

    if (links !== undefined) {
      await this.repo.deleteLinksByProjectId(id);
      for (const link of links) {
        await this.repo.insertLink(link);
      }
    }
    return record;
  }

  async deleteProject(id: string): Promise<void> {
    await this.repo.deleteProject(id);
  }

  private async setProjectStatus(
    id: string,
    status: AcademicProjectRecord['status'],
  ): Promise<void> {
    const existing = await this.repo.getProjectById(id);
    if (!existing) throw new Error(`PROJETO NÃO ENCONTRADO: ${id}`);
    await this.repo.updateProject(id, {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    });
  }

  async startProject(id: string): Promise<void> {
    await this.setProjectStatus(id, 'IN_PROGRESS');
  }

  async completeProject(id: string): Promise<void> {
    await this.setProjectStatus(id, 'COMPLETED');
  }

  async reopenProject(id: string): Promise<void> {
    await this.setProjectStatus(id, 'IN_PROGRESS');
  }

  async addMilestone(
    projectId: string,
    input: Omit<CreateMilestoneInput, 'projectId'>,
  ): Promise<ProjectMilestoneRecord> {
    const project = await this.repo.getProjectById(projectId);
    if (!project) throw new Error(`PROJETO NÃO ENCONTRADO: ${projectId}`);
    const record = buildNewMilestoneRecord(projectId, input);
    await this.repo.insertMilestone(record);
    await this.syncProjectStatusFromMilestones(projectId);
    return record;
  }

  async getMilestoneById(id: string): Promise<ProjectMilestoneRecord | null> {
    return (await this.repo.getMilestoneById(id)) ?? null;
  }

  async updateMilestone(id: string, input: UpdateMilestoneInput): Promise<ProjectMilestoneRecord> {
    const existing = await this.repo.getMilestoneById(id);
    if (!existing) throw new Error(`MARCO NÃO ENCONTRADO: ${id}`);

    const updated = buildUpdatedMilestoneRecord(existing, input);
    await this.repo.updateMilestone(id, updated);
    await this.syncProjectStatusFromMilestones(existing.projectId);
    return updated;
  }

  async toggleMilestone(id: string): Promise<ProjectMilestoneRecord> {
    const existing = await this.repo.getMilestoneById(id);
    if (!existing) throw new Error(`MARCO NÃO ENCONTRADO: ${id}`);

    const updated = { ...existing, isCompleted: !existing.isCompleted };
    await this.repo.updateMilestone(id, updated);
    await this.syncProjectStatusFromMilestones(existing.projectId);
    return updated;
  }

  async deleteMilestone(id: string): Promise<void> {
    const existing = await this.repo.getMilestoneById(id);
    if (!existing) return;
    await this.repo.deleteMilestone(id);
    await this.syncProjectStatusFromMilestones(existing.projectId);
  }

  async addProjectLink(
    projectId: string,
    input: Omit<CreateProjectLinkInput, 'projectId'>,
  ): Promise<ProjectLinkRecord> {
    const project = await this.repo.getProjectById(projectId);
    if (!project) throw new Error(`PROJETO NÃO ENCONTRADO: ${projectId}`);
    const record = buildNewProjectLinkRecord(projectId, input);
    await this.repo.insertLink(record);
    return record;
  }

  async getProjectLinkById(id: string): Promise<ProjectLinkRecord | null> {
    return (await this.repo.getLinkById(id)) ?? null;
  }

  async updateProjectLink(id: string, input: UpdateProjectLinkInput): Promise<ProjectLinkRecord> {
    const existing = await this.repo.getLinkById(id);
    if (!existing) throw new Error(`LINK NÃO ENCONTRADO: ${id}`);
    const updated = buildUpdatedProjectLinkRecord(existing, input);
    await this.repo.updateLink(id, updated);
    return updated;
  }

  async deleteProjectLink(id: string): Promise<void> {
    await this.repo.deleteLink(id);
  }

  private async syncProjectStatusFromMilestones(projectId: string): Promise<void> {
    const project = await this.repo.getProjectById(projectId);
    if (!project) return;

    const milestones = await this.repo.getMilestonesByProjectId(projectId);
    if (milestones.length === 0) return;

    const allCompleted = milestones.every((m) => m.isCompleted);
    if (allCompleted && project.status === 'IN_PROGRESS') {
      await this.repo.updateProject(projectId, {
        ...project,
        status: 'COMPLETED',
        updatedAt: new Date().toISOString(),
      });
    } else if (!allCompleted && project.status === 'COMPLETED') {
      await this.repo.updateProject(projectId, {
        ...project,
        status: 'IN_PROGRESS',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  async getProjectDetails(id: string): Promise<AcademicProjectView | null> {
    const project = await this.repo.getProjectById(id);
    if (!project) return null;

    const [links, milestones] = await Promise.all([
      this.repo.getLinksByProjectId(id),
      this.repo.getMilestonesByProjectId(id),
    ]);
    return mapProjectView(project, links, milestones);
  }

  async listProjectsByStatus(): Promise<{
    planned: AcademicProjectView[];
    inProgress: AcademicProjectView[];
    completed: AcademicProjectView[];
  }> {
    const [allProjects, allLinks, allMilestones] = await Promise.all([
      this.repo.getAllProjects(),
      this.repo.getAllLinks(),
      this.repo.getAllMilestones(),
    ]);

    const linksByProject = new Map<string, ProjectLinkRecord[]>();
    for (const link of allLinks) {
      const list = linksByProject.get(link.projectId);
      if (list) list.push(link);
      else linksByProject.set(link.projectId, [link]);
    }

    const milestonesByProject = new Map<string, ProjectMilestoneRecord[]>();
    for (const milestone of allMilestones) {
      const list = milestonesByProject.get(milestone.projectId);
      if (list) list.push(milestone);
      else milestonesByProject.set(milestone.projectId, [milestone]);
    }

    const views = allProjects
      .map((project) =>
        mapProjectView(
          project,
          linksByProject.get(project.id) ?? [],
          milestonesByProject.get(project.id) ?? [],
        ),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      planned: views.filter((p) => p.status === 'PLANNED'),
      inProgress: views.filter((p) => p.status === 'IN_PROGRESS'),
      completed: views.filter((p) => p.status === 'COMPLETED'),
    };
  }
}
