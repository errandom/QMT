import { z } from 'zod';
import sql from 'mssql';

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

const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;

async function getPool() {
  if (!connectionString) throw new Error('Missing SQL connection string');
  // Use a global pool to avoid multiple connections
  if (!(global as any).mssqlPool) {
    (global as any).mssqlPool = await sql.connect(connectionString);
  }
  return (global as any).mssqlPool as sql.ConnectionPool;
}

export class Database {
  static async select<T>(
    tableName: TableName,
    where?: WhereClause<T>
  ): Promise<T[]> {
    const pool = await getPool();
    let query = `SELECT * FROM ${tableName}`;
    if (where && Object.keys(where).length > 0) {
      const conditions = Object.entries(where)
        .filter(([_, value]) => typeof value !== 'function')
        .map(([key, value]) => `${key} = @${key}`);
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
    }
    const request = pool.request();
    if (where) {
      Object.entries(where).forEach(([key, value]) => {
        if (typeof value !== 'function') {
          request.input(key, value);
        }
      });
    }
    const result = await request.query(query);
    return result.recordset as T[];
  }

  static async selectById<T extends { id: string }>(
    tableName: TableName,
    id: string
  ): Promise<T | null> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', id)
      .query(`SELECT * FROM ${tableName} WHERE id = @id`);
    return result.recordset[0] || null;
  }

  static async insert<T extends { id: string }>(
    tableName: TableName,
    record: T
  ): Promise<T> {
    const schema = schemas[tableName];
    const validated = schema.parse(record);
    const pool = await getPool();
    const keys = Object.keys(validated);
    const values = keys.map(k => `@${k}`);
    const request = pool.request();
    keys.forEach(k => request.input(k, (validated as any)[k]));
    await request.query(
      `INSERT INTO ${tableName} (${keys.join(',')}) VALUES (${values.join(',')})`
    );
    return validated as T;
  }

  static async insertMany<T extends { id: string }>(
    tableName: TableName,
    records: T[]
  ): Promise<T[]> {
    const schema = schemas[tableName];
    const pool = await getPool();
    for (const record of records) {
      const validated = schema.parse(record);
      const keys = Object.keys(validated);
      const values = keys.map(k => `@${k}`);
      const request = pool.request();
      keys.forEach(k => request.input(k, (validated as any)[k]));
      await request.query(
        `INSERT INTO ${tableName} (${keys.join(',')}) VALUES (${values.join(',')})`
      );
    }
    return records;
  }

  static async update<T extends { id: string }>(
    tableName: TableName,
    id: string,
    updates: Partial<T>
  ): Promise<T | null> {
    const pool = await getPool();
    const keys = Object.keys(updates);
    if (keys.length === 0) return null;
    const setClause = keys.map(k => `${k} = @${k}`).join(', ');
    const request = pool.request();
    keys.forEach(k => request.input(k, (updates as any)[k]));
    request.input('id', id);
    await request.query(
      `UPDATE ${tableName} SET ${setClause} WHERE id = @id`
    );
    return this.selectById<T>(tableName, id);
  }

  static async updateWhere<T extends { id: string }>(
    tableName: TableName,
    where: WhereClause<T>,
    updates: Partial<T>
  ): Promise<number> {
    const pool = await getPool();
    const updateKeys = Object.keys(updates);
    if (updateKeys.length === 0) return 0;
    const setClause = updateKeys.map(k => `${k} = @${k}`).join(', ');
    const whereKeys = Object.entries(where)
      .filter(([_, value]) => typeof value !== 'function')
      .map(([key, value]) => `${key} = @where_${key}`);
    const request = pool.request();
    updateKeys.forEach(k => request.input(k, (updates as any)[k]));
    Object.entries(where).forEach(([key, value]) => {
      if (typeof value !== 'function') {
        request.input(`where_${key}`, value);
      }
    });
    const query = `UPDATE ${tableName} SET ${setClause}` +
      (whereKeys.length > 0 ? ` WHERE ${whereKeys.join(' AND ')}` : '');
    const result = await request.query(query);
    return result.rowsAffected[0] || 0;
  }

  static async delete<T extends { id: string }>(
    tableName: TableName,
    id: string
  ): Promise<boolean> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', id)
      .query(`DELETE FROM ${tableName} WHERE id = @id`);
    return result.rowsAffected[0] > 0;
  }

  static async deleteWhere<T>(
    tableName: TableName,
    where: WhereClause<T>
  ): Promise<number> {
    const pool = await getPool();
    const whereKeys = Object.entries(where)
      .filter(([_, value]) => typeof value !== 'function')
      .map(([key, value]) => `${key} = @${key}`);
    const request = pool.request();
    Object.entries(where).forEach(([key, value]) => {
      if (typeof value !== 'function') {
        request.input(key, value);
      }
    });
    const query = `DELETE FROM ${tableName}` +
      (whereKeys.length > 0 ? ` WHERE ${whereKeys.join(' AND ')}` : '');
    const result = await request.query(query);
    return result.rowsAffected[0] || 0;
  }

  static async count<T>(
    tableName: TableName,
    where?: WhereClause<T>
  ): Promise<number> {
    const pool = await getPool();
    let query = `SELECT COUNT(*) as count FROM ${tableName}`;
    if (where && Object.keys(where).length > 0) {
      const conditions = Object.entries(where)
        .filter(([_, value]) => typeof value !== 'function')
        .map(([key, value]) => `${key} = @${key}`);
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
    }
    const request = pool.request();
    if (where) {
      Object.entries(where).forEach(([key, value]) => {
        if (typeof value !== 'function') {
          request.input(key, value);
        }
      });
    }
    const result = await request.query(query);
    return result.recordset[0].count;
  }

  static async exists<T>(
    tableName: TableName,
    where: WhereClause<T>
  ): Promise<boolean> {
    const count = await this.count(tableName, where);
    return count > 0;
  }

  static async clear(tableName: TableName): Promise<void> {
    const pool = await getPool();
    await pool.request().query(`DELETE FROM ${tableName}`);
  }

  static async backup(): Promise<Record<TableName, any[]>> {
    const tables: TableName[] = ['teams', 'sites', 'fields', 'schedule', 'requests', 'users'];
    const backup: any = {};
    for (const table of tables) {
      backup[table] = await this.select(table);
    }
    return backup;
  }

  static async restore(backup: Record<TableName, any[]>): Promise<void> {
    for (const [table, data] of Object.entries(backup)) {
      await this.clear(table as TableName);
      for (const record of data) {
        await this.insert(table as TableName, record);
      }
    }
  }
}
