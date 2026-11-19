import { z } from 'zod';

// ============================================================================
// ESQUEMAS DE VALIDAÇÃO ZOD PARA O CASTELLO
// ============================================================================

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'O e-mail é obrigatório')
    .email('Insira um e-mail válido (ex: gestor@empresa.com)'),
  password: z
    .string()
    .min(1, 'A senha é obrigatória')
    .min(6, 'A senha deve ter pelo menos 6 caracteres'),
  rememberMe: z.boolean().optional(),
});

export const registerSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, 'O nome da firma deve ter pelo menos 2 caracteres')
    .max(100, 'O nome da firma não pode exceder 100 caracteres'),
  email: z
    .string()
    .trim()
    .min(1, 'O e-mail é obrigatório')
    .email('Insira um e-mail válido para a firma'),
  password: z
    .string()
    .min(6, 'A senha deve ter pelo menos 6 caracteres'),
  phone: z.string().trim().optional().or(z.literal('')),
  taxId: z.string().trim().optional().or(z.literal('')),
});

export const employeeSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'O nome completo do colaborador deve ter pelo menos 2 caracteres'),
  email: z
    .string()
    .trim()
    .email('E-mail do colaborador inválido'),
  access_code: z
    .string()
    .trim()
    .optional()
    .nullable()
    .or(z.literal('')),
  role: z.enum(['funcionario', 'patrao']).default('funcionario').optional(),
  job_title: z
    .string()
    .trim()
    .optional()
    .nullable()
    .or(z.literal('')),
  phone: z.string().trim().optional().nullable().or(z.literal('')),
  hourly_rate: z.coerce
    .number()
    .min(0, 'O valor/hora não pode ser negativo')
    .default(0)
    .optional(),
  monthly_target_hours: z.coerce
    .number()
    .min(0, 'A meta de horas mensal não pode ser negativa')
    .default(0)
    .optional(),
  admission_date: z.string().optional().nullable().or(z.literal('')),
});

export const constructionSiteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome da obra deve ter pelo menos 2 caracteres'),
  address: z
    .string()
    .trim()
    .min(3, 'O endereço ou localização da obra é obrigatório'),
  status: z.enum(['ativa', 'concluida', 'pausada']).default('ativa'),
  budget: z.coerce
    .number()
    .min(0, 'O orçamento não pode ser negativo')
    .optional(),
  contracted_value: z.coerce
    .number()
    .min(0, 'O valor contratado não pode ser negativo')
    .optional(),
  cost_budget: z.coerce
    .number()
    .min(0, 'O teto de custo previsto não pode ser negativo')
    .optional(),
  client_name: z.string().trim().optional().nullable().or(z.literal('')),
  client_phone: z.string().trim().optional().nullable().or(z.literal('')),
  client_email: z.string().trim().email('E-mail do cliente inválido').optional().nullable().or(z.literal('')),
  start_date: z.string().optional().nullable().or(z.literal('')),
  expected_end_date: z.string().optional().nullable().or(z.literal('')),
  description: z.string().trim().optional().nullable().or(z.literal('')),
});

export const financialRecordSchema = z.object({
  description: z
    .string()
    .trim()
    .min(2, 'A descrição da movimentação financeira é obrigatória (mínimo 2 caracteres)'),
  amount: z.coerce
    .number()
    .refine((val) => val > 0, 'O montante financeiro deve ser maior que 0.00 €'),
  type: z.enum(['income', 'expense', 'receita', 'despesa']),
  category: z
    .string()
    .trim()
    .min(1, 'A categoria financeira é obrigatória'),
  due_date: z
    .string()
    .min(8, 'Informe uma data de vencimento válida (AAAA-MM-DD)'),
  paid: z.boolean().default(false),
  payment_date: z.string().optional().nullable().or(z.literal('')),
  site_id: z.string().optional().nullable().or(z.literal('')),
  subcategory: z.string().optional().nullable().or(z.literal('')),
});

export const teamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome da equipa deve ter pelo menos 2 caracteres'),
  leader_name: z.string().trim().optional().nullable().or(z.literal('')),
  leader_phone: z.string().trim().optional().nullable().or(z.literal('')),
});

export const siteTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'O título da tarefa deve ter pelo menos 2 caracteres'),
  site_id: z
    .string()
    .min(1, 'A obra associada à tarefa é obrigatória'),
  description: z.string().trim().optional().nullable().or(z.literal('')),
  due_date: z.string().optional().nullable().or(z.literal('')),
  priority: z.enum(['baixa', 'media', 'alta']).default('media'),
});

export const vehicleSchema = z.object({
  plate: z
    .string()
    .trim()
    .min(3, 'A matrícula da carrinha é obrigatória'),
  model: z
    .string()
    .trim()
    .min(2, 'O modelo da viatura deve ter pelo menos 2 caracteres'),
  year: z.coerce.number().optional().nullable(),
});

export const inventoryItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome do material ou equipamento deve ter pelo menos 2 caracteres'),
  quantity: z.coerce
    .number()
    .min(0, 'A quantidade em stock deve ser igual ou superior a zero'),
  category: z
    .string()
    .trim()
    .min(1, 'A categoria do item é obrigatória'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type EmployeeFormData = z.infer<typeof employeeSchema>;
export type ConstructionSiteFormData = z.infer<typeof constructionSiteSchema>;
export type FinancialRecordFormData = z.infer<typeof financialRecordSchema>;
export type TeamFormData = z.infer<typeof teamSchema>;
export type SiteTaskFormData = z.infer<typeof siteTaskSchema>;
export type VehicleFormData = z.infer<typeof vehicleSchema>;
export type InventoryItemFormData = z.infer<typeof inventoryItemSchema>;

export function validateWithZod<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string; fieldErrors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const fieldErrors: Record<string, string> = {};
  const issues = (result.error as any).issues || (result.error as any).errors || [];
  issues.forEach((err: any) => {
    const path = Array.isArray(err.path) ? err.path.join('.') : '';
    if (path && !fieldErrors[path]) {
      fieldErrors[path] = err.message;
    }
  });
  return {
    success: false,
    error: issues[0]?.message || 'Dados inválidos.',
    fieldErrors,
  };
}
