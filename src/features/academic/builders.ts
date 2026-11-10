import crypto from 'node:crypto';
import {
  createMilestoneSchema,
  createProjectSchema,
  updateMilestoneSchema,
  updateProjectSchema,
  type AcademicProjectRecord,
  type AcademicProjectView,
  type CreateMilestoneInput,
  type CreateProjectInput,
  type ProjectLinkRecord,
  type ProjectMilestoneRecord,
  type UpdateMilestoneInput,
  type UpdateProjectInput,
} from './types';

export function buildNewProjectRecord(input: CreateProjectInput): {
  record: AcademicProjectRecord;
  links: Array<{ id: string; projectId: string; label: string; url: string }>;
} {
  const parsed = createProjectSchema.parse(input);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const record: AcademicProjectRecord = {
    id,
    title: parsed.title.toUpperCase(),
    description: parsed.description.toUpperCase(),
    finalDeliveryDate: parsed.finalDeliveryDate ?? null,
    groupMembers: JSON.stringify(parsed.groupMembers.map((m) => m.trim().toUpperCase())),
    status: 'IN_PROGRESS',
    createdAt: now,
    updatedAt: now,
  };

  const links = parsed.links.map((link) => ({
    id: crypto.randomUUID(),
    projectId: id,
    label: link.label.trim().toUpperCase(),
    url: link.url.trim(),
  }));

  return { record, links };
}

export function buildUpdatedProjectRecord(
  existing: AcademicProjectRecord,
  input: UpdateProjectInput,
): {
  record: AcademicProjectRecord;
  links?: Array<{ id: string; projectId: string; label: string; url: string }>;
} {
  const parsed = updateProjectSchema.parse(input);
  const now = new Date().toISOString();

  const record: AcademicProjectRecord = {
    ...existing,
    title: parsed.title !== undefined ? parsed.title.toUpperCase() : existing.title,
    description:
      parsed.description !== undefined ? parsed.description.toUpperCase() : existing.description,
    finalDeliveryDate:
      parsed.finalDeliveryDate !== undefined
        ? parsed.finalDeliveryDate
        : existing.finalDeliveryDate,
    groupMembers:
      parsed.groupMembers !== undefined
        ? JSON.stringify(parsed.groupMembers.map((m) => m.trim().toUpperCase()))
        : existing.groupMembers,
    updatedAt: now,
  };

  const links = parsed.links
    ? parsed.links.map((link) => ({
        id: crypto.randomUUID(),
        projectId: existing.id,
        label: link.label.trim().toUpperCase(),
        url: link.url.trim(),
      }))
    : undefined;

  return { record, links };
}

export function buildNewMilestoneRecord(
  projectId: string,
  input: Omit<CreateMilestoneInput, 'projectId'>,
): ProjectMilestoneRecord {
  const parsed = createMilestoneSchema.parse({ ...input, projectId });
  return {
    id: crypto.randomUUID(),
    projectId,
    title: parsed.title.toUpperCase(),
    dueDate: parsed.dueDate,
    isCompleted: false,
    sortOrder: parsed.sortOrder,
  };
}

export function buildUpdatedMilestoneRecord(
  existing: ProjectMilestoneRecord,
  input: UpdateMilestoneInput,
): ProjectMilestoneRecord {
  const parsed = updateMilestoneSchema.parse(input);
  return {
    ...existing,
    title: parsed.title !== undefined ? parsed.title.toUpperCase() : existing.title,
    dueDate: parsed.dueDate !== undefined ? parsed.dueDate : existing.dueDate,
    isCompleted: parsed.isCompleted !== undefined ? parsed.isCompleted : existing.isCompleted,
    sortOrder: parsed.sortOrder !== undefined ? parsed.sortOrder : existing.sortOrder,
  };
}

export function mapProjectView(
  project: AcademicProjectRecord,
  links: ProjectLinkRecord[],
  milestones: ProjectMilestoneRecord[],
): AcademicProjectView {
  let groupMembersList: string[] = [];
  try {
    groupMembersList = JSON.parse(project.groupMembers);
  } catch {
    groupMembersList = [];
  }

  return {
    ...project,
    groupMembersList,
    links,
    milestones,
    totalMilestones: milestones.length,
    completedMilestones: milestones.filter((m) => m.isCompleted).length,
  };
}
