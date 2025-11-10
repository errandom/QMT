import { z } from 'zod';

const TeamSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Team name is required'),
  sportType: z.enum(['tackle', 'flag', 'all sports']),
  isActive: z.boolean(),
  headCoachName: z.string().optional(),
  headCoachEmail: z.string().email().optional().or(z.literal('')),
  headCoachPhone: z.string().optional(),
  teamManagerName: z.string().optional(),
  teamManagerEmail: z.string().email().optional().or(z.literal('')),
  teamManagerPhone: z.string().optional(),
});

const SiteSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Site name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(1, 'Zip code is required'),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  isActive: z.boolean(),
  hasToilets: z.boolean(),
  hasLockerRooms: z.boolean(),
  hasEquipmentStash: z.boolean(),
  hasRestaurant: z.boolean(),
  hasParking: z.boolean(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
});

const FieldSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Field name is required'),
  siteId: z.string().min(1, 'Site is required'),
  turfType: z.enum(['artificial', 'natural', 'indoor-gym']),
  hasLights: z.boolean(),
  isFullField: z.boolean(),
  capacity: z.number().optional(),
});

const ScheduleEventSchema = z.object({
  id: z.string(),
  fieldId: z.string().min(1, 'Field is required'),
  siteId: z.string().optional(),
  teamIds: z.array(z.string()),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  eventType: z.enum(['practice', 'game', 'meeting', 'other']),
  status: z.enum(['planned', 'confirmed', 'cancelled']),
  estimatedAttendance: z.number().optional(),
  opponent: z.string().optional(),
  notes: z.string().optional(),
  isRecurring: z.boolean(),
  recurringDays: z.array(z.number()).optional(),
  recurringStartDate: z.string().optional(),
  recurringEndDate: z.string().optional(),
});

const RequestSchema = z.object({
  id: z.string(),
  type: z.enum(['facility', 'equipment', 'cancellation']),
  teamId: z.string().optional(),
  requestedBy: z.string().min(1, 'Requestor name is required'),
  requestedDate: z.string().min(1, 'Requested date is required'),
  description: z.string().min(1, 'Description is required'),
  status: z.enum(['pending', 'approved', 'rejected']),
  createdAt: z.string(),
  fieldId: z.string().optional(),
  siteId: z.string().optional(),
  eventId: z.string().optional(),
  reason: z.string().optional(),
});

const UserSchema = z.object({
  id: z.string(),
  username: z.string().min(1, 'Username is required'),
  role: z.enum(['QMTadmin', 'QMTmgmt']),
  email: z.string().email().optional().or(z.literal('')),
  createdAt: z.string(),
});

export type TableName = 'teams' | 'sites' | 'fields' | 'schedule' | 'requests' | 'users';

export const schemas = {
  teams: TeamSchema,
  sites: SiteSchema,
  fields: FieldSchema,
  schedule: ScheduleEventSchema,
  requests: RequestSchema,
  users: UserSchema,
};

export type WhereClause<T> = {
  [K in keyof T]?: T[K] | ((value: T[K]) => boolean);
};

export class Database {
  private static ensureSparkRuntime(): void {
    if (typeof window === 'undefined' || !window.spark || !window.spark.kv) {
      throw new Error('Spark runtime is not available. Please ensure the application is running in a Spark environment.');
    }
  }

  private static async getTable<T>(tableName: TableName): Promise<T[]> {
    this.ensureSparkRuntime();
    try {
      const data = await window.spark.kv.get<T[]>(tableName);
      return data || [];
    } catch (error) {
      console.error(`Error reading table ${tableName}:`, error);
      return [];
    }
  }

  private static async setTable<T>(tableName: TableName, data: T[]): Promise<void> {
    this.ensureSparkRuntime();
    try {
      await window.spark.kv.set(tableName, data);
    } catch (error) {
      console.error(`Error writing to table ${tableName}:`, error);
      throw error;
    }
  }

  static async select<T>(
    tableName: TableName,
    where?: WhereClause<T>
  ): Promise<T[]> {
    const data = await this.getTable<T>(tableName);
    
    if (!where) return data;

    return data.filter(record => {
      return Object.entries(where).every(([key, value]) => {
        const recordValue = (record as any)[key];
        
        if (typeof value === 'function') {
          return value(recordValue);
        }
        
        return recordValue === value;
      });
    });
  }

  static async selectById<T extends { id: string }>(
    tableName: TableName,
    id: string
  ): Promise<T | null> {
    const data = await this.getTable<T>(tableName);
    return data.find(record => record.id === id) || null;
  }

  static async insert<T extends { id: string }>(
    tableName: TableName,
    record: T
  ): Promise<T> {
    const schema = schemas[tableName];
    const validated = schema.parse(record);
    
    const data = await this.getTable<T>(tableName);
    
    const exists = data.some(r => r.id === record.id);
    if (exists) {
      throw new Error(`Record with id ${record.id} already exists`);
    }
    
    data.push(validated as unknown as T);
    await this.setTable(tableName, data);
    
    return validated as unknown as T;
  }

  static async insertMany<T extends { id: string }>(
    tableName: TableName,
    records: T[]
  ): Promise<T[]> {
    const schema = schemas[tableName];
    const validated = records.map(r => schema.parse(r) as unknown as T);
    
    const data = await this.getTable<T>(tableName);
    
    for (const record of validated) {
      const exists = data.some(r => r.id === record.id);
      if (exists) {
        throw new Error(`Record with id ${record.id} already exists`);
      }
    }
    
    data.push(...validated);
    await this.setTable(tableName, data);
    
    return validated;
  }

  static async update<T extends { id: string }>(
    tableName: TableName,
    id: string,
    updates: Partial<T>
  ): Promise<T | null> {
    const data = await this.getTable<T>(tableName);
    const index = data.findIndex(record => record.id === id);
    
    if (index === -1) return null;
    
    const updatedRecord = { ...data[index], ...updates };
    
    const schema = schemas[tableName];
    const validated = schema.parse(updatedRecord);
    
    data[index] = validated as unknown as T;
    await this.setTable(tableName, data);
    
    return validated as unknown as T;
  }

  static async updateWhere<T extends { id: string }>(
    tableName: TableName,
    where: WhereClause<T>,
    updates: Partial<T>
  ): Promise<number> {
    const data = await this.getTable<T>(tableName);
    let updateCount = 0;
    
    const schema = schemas[tableName];
    
    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      const matches = Object.entries(where).every(([key, value]) => {
        const recordValue = (record as any)[key];
        
        if (typeof value === 'function') {
          return value(recordValue);
        }
        
        return recordValue === value;
      });
      
      if (matches) {
        const updatedRecord = { ...record, ...updates };
        data[i] = schema.parse(updatedRecord) as unknown as T;
        updateCount++;
      }
    }
    
    if (updateCount > 0) {
      await this.setTable(tableName, data);
    }
    
    return updateCount;
  }

  static async delete<T extends { id: string }>(
    tableName: TableName,
    id: string
  ): Promise<boolean> {
    const data = await this.getTable<T>(tableName);
    const initialLength = data.length;
    const filtered = data.filter(record => record.id !== id);
    
    if (filtered.length === initialLength) return false;
    
    await this.setTable(tableName, filtered);
    return true;
  }

  static async deleteWhere<T>(
    tableName: TableName,
    where: WhereClause<T>
  ): Promise<number> {
    const data = await this.getTable<T>(tableName);
    const initialLength = data.length;
    
    const filtered = data.filter(record => {
      return !Object.entries(where).every(([key, value]) => {
        const recordValue = (record as any)[key];
        
        if (typeof value === 'function') {
          return value(recordValue);
        }
        
        return recordValue === value;
      });
    });
    
    const deleteCount = initialLength - filtered.length;
    
    if (deleteCount > 0) {
      await this.setTable(tableName, filtered);
    }
    
    return deleteCount;
  }

  static async count<T>(
    tableName: TableName,
    where?: WhereClause<T>
  ): Promise<number> {
    const data = await this.select<T>(tableName, where);
    return data.length;
  }

  static async exists<T>(
    tableName: TableName,
    where: WhereClause<T>
  ): Promise<boolean> {
    const count = await this.count(tableName, where);
    return count > 0;
  }

  static async clear(tableName: TableName): Promise<void> {
    await this.setTable(tableName, []);
  }

  static async backup(): Promise<Record<TableName, any[]>> {
    const tables: TableName[] = ['teams', 'sites', 'fields', 'schedule', 'requests', 'users'];
    const backup: any = {};
    
    for (const table of tables) {
      backup[table] = await this.getTable(table);
    }
    
    return backup;
  }

  static async restore(backup: Record<TableName, any[]>): Promise<void> {
    for (const [table, data] of Object.entries(backup)) {
      await this.setTable(table as TableName, data);
    }
  }
}
