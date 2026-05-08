
import { z } from 'zod/v4';
import { insertUserSchema, insertTransactionSchema, users, transactions } from '@workspace/db';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    registerAdmin: {
      method: 'POST' as const,
      path: '/api/register-admin',
      input: z.object({
        username: z.string().min(3),
        password: z.string().min(6),
        fullName: z.string().min(2),
      }),
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
        409: errorSchemas.validation,
      },
    },
    registerEmployee: {
      method: 'POST' as const,
      path: '/api/register-employee',
      input: z.object({
        username: z.string().min(3),
        password: z.string().min(6),
        fullName: z.string().min(2),
      }),
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
        409: errorSchemas.validation,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.void(),
      },
    },
    check: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/users',
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/users/:id',
      responses: {
        200: z.custom<typeof users.$inferSelect & { transactions: (typeof transactions.$inferSelect & { performedByName: string | null })[]; customItems: { id: number; name: string; balance: number }[] }>(),
        404: errorSchemas.notFound,
      },
    },
    updateBalance: {
      method: 'POST' as const,
      path: '/api/users/:id/balance',
      input: z.object({
        amount: z.number().int(),
        reason: z.string().min(1),
        categoryId: z.number().int().optional(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    bulkCredit: {
      method: 'POST' as const,
      path: '/api/users/bulk-credit',
      input: z.object({
        userIds: z.array(z.number().int()).min(1),
        amount: z.number().int().positive(),
        reason: z.string().min(1),
        categoryId: z.number().int().optional(),
      }),
      responses: {
        200: z.object({ credited: z.number() }),
      },
    },
    bulkDebit: {
      method: 'POST' as const,
      path: '/api/users/bulk-debit',
      input: z.object({
        userIds: z.array(z.number().int()).min(1),
        amount: z.number().int().positive(),
        reason: z.string().min(1),
      }),
      responses: {
        200: z.object({ debited: z.number() }),
      },
    },
    updateRole: {
      method: 'POST' as const,
      path: '/api/users/:id/role',
      input: z.object({
        role: z.enum(['admin', 'employee', 'prime_admin']),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    updateProfile: {
      method: 'PATCH' as const,
      path: '/api/users/:id/profile',
      input: z.object({
        fullName: z.string().min(1).max(100).optional(),
        username: z.string().min(3).optional(),
        currentPassword: z.string().optional(),
        password: z.string().min(6).optional(),
        verificationCode: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")).transform(v => v || null),
        departmentId: z.number().int().nullable().optional(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    deleteUser: {
      method: 'DELETE' as const,
      path: '/api/users/:id',
      responses: {
        200: z.void(),
        403: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    getPending: {
      method: 'GET' as const,
      path: '/api/users/pending-admins',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    },
    approvePending: {
      method: 'POST' as const,
      path: '/api/users/:id/approve',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  transactions: {
    list: {
      method: 'GET' as const,
      path: '/api/transactions',
      responses: {
        200: z.array(z.custom<typeof transactions.$inferSelect>()),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
