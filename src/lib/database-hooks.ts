import { useState, useEffect, useCallback } from 'react';
import { Database, TableName } from './database';

export function useDatabaseQuery<T extends { id: string }>(
  tableName: TableName,
  where?: any
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await Database.select<T>(tableName, where);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [tableName, where]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useDatabaseMutations<T extends { id: string }>(
  tableName: TableName,
  onSuccess?: () => void
) {
  const [loading, setLoading] = useState(false);

  const insert = useCallback(async (record: T) => {
    setLoading(true);
    try {
      const result = await Database.insert(tableName, record);
      onSuccess?.();
      return result;
    } finally {
      setLoading(false);
    }
  }, [tableName, onSuccess]);

  const update = useCallback(async (id: string, updates: Partial<T>) => {
    setLoading(true);
    try {
      const result = await Database.update<T>(tableName, id, updates);
      onSuccess?.();
      return result;
    } finally {
      setLoading(false);
    }
  }, [tableName, onSuccess]);

  const remove = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const result = await Database.delete(tableName, id);
      onSuccess?.();
      return result;
    } finally {
      setLoading(false);
    }
  }, [tableName, onSuccess]);

  return { insert, update, remove, loading };
}

export function useDatabaseTable<T extends { id: string }>(
  tableName: TableName,
  where?: any
) {
  const query = useDatabaseQuery<T>(tableName, where);
  const mutations = useDatabaseMutations<T>(tableName, query.refetch);

  return {
    ...query,
    ...mutations
  };
}
