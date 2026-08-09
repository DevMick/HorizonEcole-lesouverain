import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// Types
export interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  address?: string;
  function: 'ENSEIGNANT' | 'DIRECTEUR' | 'SURVEILLANT' | 'SECRETAIRE' | 'COMPTABLE' | 'MAINTENANCE';
  specialization?: string;
  contractType: 'CDI' | 'CDD' | 'VACATAIRE' | 'BENEVOLAT';
  hireDate: string;
  endDate?: string;
  baseSalary: number;
  cvUrl?: string;
  diplomaUrl?: string;
  contractUrl?: string;
  idCardUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
  salaries?: StaffSalary[];
}

export interface StaffSalary {
  id: string;
  staffId: string;
  month: number;
  year: number;
  baseSalary: number;
  allowances: number;
  overtimeHours: number;
  overtimeRate: number;
  bonuses: number;
  deductions: number;
  cnpsEmployee: number;
  incomeTax: number;
  grossSalary: number;
  netSalary: number;
  paymentDate?: string;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  notes?: string;
  pdfUrl?: string;
  createdBy?: string;
  createdAt: string;
  staff?: {
    id: string;
    firstName: string;
    lastName: string;
    function: string;
  };
  creator?: {
    id: string;
    username: string;
  };
}

export interface CreateStaffData {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  address?: string;
  function: string;
  specialization?: string;
  contractType: string;
  hireDate: string;
  endDate?: string;
  baseSalary: number;
  cvUrl?: string;
  diplomaUrl?: string;
  contractUrl?: string;
  idCardUrl?: string;
}

export interface UpdateStaffData extends Partial<CreateStaffData> {}

export interface GenerateSalaryData {
  month: number;
  year: number;
  allowances?: Array<{ label: string; amount: number }>;
  deductions?: Array<{ label: string; amount: number }>;
  overtimeHours?: number;
  overtimeRate?: number;
  bonuses?: number;
  notes?: string;
}

// Query keys
const staffKeys = {
  all: ['staff'] as const,
  lists: () => [...staffKeys.all, 'list'] as const,
  list: (filters: any) => [...staffKeys.lists(), filters] as const,
  details: () => [...staffKeys.all, 'detail'] as const,
  detail: (id: string) => [...staffKeys.details(), id] as const,
  salaries: (id: string) => [...staffKeys.detail(id), 'salaries'] as const,
  stats: () => [...staffKeys.all, 'stats'] as const,
};

const salaryKeys = {
  all: ['salaries'] as const,
  lists: () => [...salaryKeys.all, 'list'] as const,
  list: (filters: any) => [...salaryKeys.lists(), filters] as const,
  details: () => [...salaryKeys.all, 'detail'] as const,
  detail: (id: string) => [...salaryKeys.details(), id] as const,
  overview: () => [...salaryKeys.all, 'overview'] as const,
};

// Staff queries
export const useStaff = (filters: {
  function?: string;
  contractType?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
} = {}) => {
  return useQuery({
    queryKey: staffKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      });

      const response = await api.get(`/staff?${params.toString()}`);
      return response.data;
    },
  });
};

export const useStaffById = (id: string) => {
  return useQuery({
    queryKey: staffKeys.detail(id),
    queryFn: async () => {
      const response = await api.get(`/staff/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });
};

export const useStaffStats = () => {
  return useQuery({
    queryKey: staffKeys.stats(),
    queryFn: async () => {
      const response = await api.get('/staff/stats');
      return response.data.data;
    },
  });
};

export const useStaffSalaries = (staffId: string, filters: {
  month?: number;
  year?: number;
  status?: string;
  page?: number;
  limit?: number;
} = {}) => {
  return useQuery({
    queryKey: [...staffKeys.salaries(staffId), filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      });

      const response = await api.get(`/staff/${staffId}/salaries?${params.toString()}`);
      return response.data;
    },
    enabled: !!staffId,
  });
};

// Staff mutations
export const useCreateStaff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateStaffData) => {
      const response = await api.post('/staff', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.lists() });
      queryClient.invalidateQueries({ queryKey: staffKeys.stats() });
    },
  });
};

export const useUpdateStaff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateStaffData }) => {
      const response = await api.put(`/staff/${id}`, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: staffKeys.lists() });
      queryClient.invalidateQueries({ queryKey: staffKeys.detail(id) });
    },
  });
};

export const useDeleteStaff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/staff/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.lists() });
      queryClient.invalidateQueries({ queryKey: staffKeys.stats() });
    },
  });
};

export const useGenerateSalary = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ staffId, data }: { staffId: string; data: GenerateSalaryData }) => {
      const response = await api.post(`/staff/${staffId}/salaries`, data);
      return response.data;
    },
    onSuccess: (_, { staffId }) => {
      queryClient.invalidateQueries({ queryKey: staffKeys.salaries(staffId) });
      queryClient.invalidateQueries({ queryKey: salaryKeys.lists() });
    },
  });
};

// Salary queries
export const useSalaries = (filters: {
  staffId?: string;
  month?: number;
  year?: number;
  status?: string;
  page?: number;
  limit?: number;
} = {}) => {
  return useQuery({
    queryKey: salaryKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      });

      const response = await api.get(`/staff-salaries?${params.toString()}`);
      return response.data;
    },
  });
};

export const useSalaryById = (id: string) => {
  return useQuery({
    queryKey: salaryKeys.detail(id),
    queryFn: async () => {
      const response = await api.get(`/staff-salaries/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });
};

export const usePayrollOverview = (year?: number, month?: number) => {
  return useQuery({
    queryKey: [...salaryKeys.overview(), { year, month }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (year) params.append('year', String(year));
      if (month) params.append('month', String(month));

      const response = await api.get(`/staff-salaries/overview?${params.toString()}`);
      return response.data.data;
    },
  });
};

// Salary mutations
export const useUpdateSalaryStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'DRAFT' | 'APPROVED' | 'PAID' }) => {
      const response = await api.put(`/staff-salaries/${id}/status`, { status });
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: salaryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: salaryKeys.lists() });
    },
  });
};

export const useGenerateSalaryPDF = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/staff-salaries/${id}/generate-pdf`);
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: salaryKeys.detail(id) });
    },
  });
};

export const useDeleteSalary = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/staff-salaries/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salaryKeys.lists() });
    },
  });
};

// Bulk operations
export const useBulkGenerateSalaries = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      staffIds: string[];
      month: number;
      year: number;
      allowances?: Array<{ label: string; amount: number }>;
      deductions?: Array<{ label: string; amount: number }>;
      notes?: string;
    }) => {
      const response = await api.post('/staff-salaries/bulk-generate', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salaryKeys.lists() });
    },
  });
};

export const useBulkApproveSalaries = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (salaryIds: string[]) => {
      const response = await api.post('/staff-salaries/bulk-approve', { salaryIds });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salaryKeys.lists() });
    },
  });
};
