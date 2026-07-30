import { vi } from 'vitest';

export interface MockDbOptions {
  users?: any[];
  documents?: any[];
  customers?: any[];
  userSettings?: any[];
  unlockCodes?: any[];
  intakes?: any[];
}

export function createMockDrizzleDb(initialData: MockDbOptions = {}) {
  const store = {
    users: initialData.users ?? [],
    documents: initialData.documents ?? [],
    customers: initialData.customers ?? [],
    userSettings: initialData.userSettings ?? [],
    unlockCodes: initialData.unlockCodes ?? [],
    intakes: initialData.intakes ?? [],
  };

  const createQueryChain = (tableName: keyof typeof store) => {
    let filterFn: ((item: any) => boolean) | null = null;

    const chain = {
      where: vi.fn((condition: any) => {
        return chain;
      }),
      set: vi.fn((values: any) => {
        return chain;
      }),
      values: vi.fn((values: any | any[]) => {
        const items = Array.isArray(values) ? values : [values];
        store[tableName].push(...items);
        return Promise.resolve(items);
      }),
      returning: vi.fn(() => {
        return Promise.resolve(store[tableName]);
      }),
      limit: vi.fn((limit: number) => {
        return Promise.resolve(store[tableName].slice(0, limit));
      }),
      then: (resolve: (val: any) => void) => {
        let result = store[tableName];
        if (filterFn) result = result.filter(filterFn);
        resolve(result);
      },
    };

    return chain;
  };

  return {
    store,
    select: vi.fn(() => createQueryChain('users')),
    insert: vi.fn((table: any) => createQueryChain('users')),
    update: vi.fn((table: any) => createQueryChain('users')),
    delete: vi.fn((table: any) => createQueryChain('users')),
  };
}
