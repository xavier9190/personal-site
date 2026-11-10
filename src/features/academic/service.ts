import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import * as schema from './schema';

export class AcademicService {
  constructor(private readonly db: AppDatabase = getDb()) {}

  listProjectsByStatus() {
    const all = this.db.select().from(schema.academicProjects).all();
    return {
      inProgress: all.filter((p) => p.status === 'IN_PROGRESS'),
      completed: all.filter((p) => p.status === 'COMPLETED'),
    };
  }
}
