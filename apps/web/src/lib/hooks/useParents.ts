import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export interface Parent {
  id: string;
  firstName: string;
  lastName: string;
  relation: 'PERE' | 'MERE' | 'TUTEUR' | 'AUTRE';
  phone: string;
  email?: string;
  address?: string;
  profession?: string;
  workplace?: string;
  avatarUrl?: string;
  isPrimaryContact: boolean;
  isFinancialResponsible: boolean;
  createdAt: string;
  updatedAt: string;
  studentParents?: Array<{
    id: string;
    relation: 'PERE' | 'MERE' | 'TUTEUR' | 'AUTRE';
    student: {
      id: string;
      studentNumber: string;
      firstName: string;
      lastName: string;
      class?: {
        id: string;
        name: string;
        level: string;
      };
    };
  }>;
}

export interface CreateParentData {
  firstName: string;
  lastName: string;
  relation: 'PERE' | 'MERE' | 'TUTEUR' | 'AUTRE';
  phone: string;
  email?: string;
  address?: string;
  profession?: string;
  workplace?: string;
  isPrimaryContact?: boolean;
  isFinancialResponsible?: boolean;
}

export interface UpdateParentData extends Partial<CreateParentData> {}

export interface ParentSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  relation?: 'PERE' | 'MERE' | 'TUTEUR' | 'AUTRE';
  isPrimaryContact?: boolean;
  isFinancialResponsible?: boolean;
}

export interface ParentStats {
  totalParents: number;
  parentsByRelation: Array<{ relation: 'PERE' | 'MERE' | 'TUTEUR' | 'AUTRE'; _count: { relation: number } }>;
  primaryContacts: number;
  financialResponsibles: number;
}

// Query keys
export const parentKeys = {
  all: ['parents'] as const,
  lists: () => [...parentKeys.all, 'list'] as const,
  list: (params: ParentSearchParams) => [...parentKeys.lists(), params] as const,
  details: () => [...parentKeys.all, 'detail'] as const,
  detail: (id: string) => [...parentKeys.details(), id] as const,
  stats: () => [...parentKeys.all, 'stats'] as const,
  search: (query: string) => [...parentKeys.all, 'search', query] as const,
};

// Hooks
export const useParents = (params: ParentSearchParams = {}) => {
  return useQuery({
    queryKey: parentKeys.list(params),
    queryFn: async () => {
      const response = await api.get('/parents', { params });
      return response.data;
    },
  });
};

export const useParent = (id: string) => {
  return useQuery({
    queryKey: parentKeys.detail(id),
    queryFn: async () => {
      const response = await api.get(`/parents/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useParentStats = () => {
  return useQuery({
    queryKey: parentKeys.stats(),
    queryFn: async () => {
      const response = await api.get('/parents/stats/overview');
      return response.data;
    },
  });
};

export const useSearchParents = (query: string) => {
  return useQuery({
    queryKey: parentKeys.search(query),
    queryFn: async () => {
      const response = await api.get(`/parents/search/${encodeURIComponent(query)}`);
      return response.data;
    },
    enabled: query.length >= 2,
  });
};

export const useCreateParent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateParentData) => {
      const response = await api.post('/parents', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: parentKeys.stats() });
    },
  });
};

export const useUpdateParent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateParentData }) => {
      const response = await api.put(`/parents/${id}`, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: parentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: parentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: parentKeys.stats() });
    },
  });
};

export const useDeleteParent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/parents/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: parentKeys.stats() });
    },
  });
};

export const useUploadParentAvatar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append('avatar', file);
      
      const response = await api.post(`/parents/${id}/avatar`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: parentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: parentKeys.lists() });
    },
  });
};
