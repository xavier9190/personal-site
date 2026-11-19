import { z } from 'zod';
import { assertPureDate } from '@/lib/dates';
import type * as schema from './schema';

export type AcademicProjectRecord = typeof schema.academicProjects.$inferSelect;
export type ProjectMilestoneRecord = typeof schema.projectMilestones.$inferSelect;
export type ProjectLinkRecord = typeof schema.projectLinks.$inferSelect;

export const academicProjectStatusSchema = z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED']);
export type AcademicProjectStatus = z.infer<typeof academicProjectStatusSchema>;

const pureDateSchema = z.string().refine((val) => {
  try {
    assertPureDate(val);
    return true;
  } catch {
    return false;
  }
}, 'DATA INVÁLIDA (USE AAAA-MM-DD)');

export const projectLinkInputSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1, 'RÓTULO DO LINK OBRIGATÓRIO'),
  url: z.string().trim().url('URL INVÁLIDA'),
});

export const createProjectSchema = z.object({
  title: z.string().trim().min(1, 'TÍTULO DO PROJETO OBRIGATÓRIO'),
  description: z.string().trim().min(1, 'DESCRIÇÃO DO PROJETO OBRIGATÓRIA'),
  finalDeliveryDate: pureDateSchema.nullable().optional(),
  groupMembers: z.array(z.string().trim().min(1)).default([]),
  links: z.array(projectLinkInputSchema).default([]),
  status: academicProjectStatusSchema.default('IN_PROGRESS'),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: academicProjectStatusSchema.optional(),
});

export const createMilestoneSchema = z.object({
  projectId: z.string().min(1, 'ID DO PROJETO OBRIGATÓRIO'),
  title: z.string().trim().min(1, 'TÍTULO DO MARCO OBRIGATÓRIO'),
  dueDate: pureDateSchema,
  sortOrder: z.number().int().default(0),
});

export const updateMilestoneSchema = z.object({
  title: z.string().trim().min(1).optional(),
  dueDate: pureDateSchema.optional(),
  isCompleted: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type ProjectLinkInput = z.input<typeof projectLinkInputSchema>;
export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
export type CreateMilestoneInput = z.input<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.input<typeof updateMilestoneSchema>;

export interface ProjectMilestoneView extends ProjectMilestoneRecord {}

export interface AcademicProjectView extends AcademicProjectRecord {
  groupMembersList: string[];
  links: ProjectLinkRecord[];
  milestones: ProjectMilestoneView[];
  totalMilestones: number;
  completedMilestones: number;
}
