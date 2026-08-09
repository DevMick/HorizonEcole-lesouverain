import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export interface Student {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  placeOfBirth?: string;
  gender: string;
  nationality?: string;
  phone?: string;
  email?: string;
  address?: string;
  avatarUrl?: string;
  bloodType?: string;
  allergies?: string;
  medicalNotes?: string;
  classId?: string;
  enrollmentDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED' | 'EXPELLED';
  birthCertificateUrl?: string;
  vaccinationCardUrl?: string;
  previousSchoolReportUrl?: string;
  createdAt: string;
  updatedAt: string;
  class?: {
    id: string;
    name: string;
    level: string;
  };
  studentParents?: Array<{
    id: string;
    relation: 'PERE' | 'MERE' | 'TUTEUR' | 'AUTRE';
    parent: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
      relation: 'PERE' | 'MERE' | 'TUTEUR' | 'AUTRE';
      avatarUrl?: string;
      isPrimaryContact: boolean;
      isFinancialResponsible: boolean;
    };
  }>;
}

export interface CreateStudentData {
  studentNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  placeOfBirth?: string;
  gender: string;
  nationality?: string;
  phone?: string;
  email?: string;
  address?: string;
  bloodType?: string;
  allergies?: string;
  medicalNotes?: string;
  classId?: string;
  enrollmentDate: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED' | 'EXPELLED';
  birthCertificateUrl?: string;
  vaccinationCardUrl?: string;
  previousSchoolReportUrl?: string;
}

export interface UpdateStudentData extends Partial<CreateStudentData> {}

export interface StudentSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED' | 'EXPELLED';
  classId?: string;
  gender?: string;
}

export interface StudentStats {
  totalStudents: number;
  activeStudents: number;
  studentsByGender: Array<{ gender: string; _count: { gender: number } }>;
  studentsByClass: Array<{ classId: string; _count: { classId: number } }>;
}

// Query keys
export const studentKeys = {
  all: ['students'] as const,
  lists: () => [...studentKeys.all, 'list'] as const,
  list: (params: StudentSearchParams) => [...studentKeys.lists(), params] as const,
  details: () => [...studentKeys.all, 'detail'] as const,
  detail: (id: string) => [...studentKeys.details(), id] as const,
  stats: () => [...studentKeys.all, 'stats'] as const,
};

// Hooks
export const useStudents = (params: StudentSearchParams = {}) => {
  return useQuery({
    queryKey: studentKeys.list(params),
    queryFn: async () => {
      const response = await api.get('/students', { params });
      return response.data;
    },
  });
};

export const useStudent = (id: string) => {
  return useQuery({
    queryKey: studentKeys.detail(id),
    queryFn: async () => {
      const response = await api.get(`/students/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useStudentStats = () => {
  return useQuery({
    queryKey: studentKeys.stats(),
    queryFn: async () => {
      const response = await api.get('/students/stats/overview');
      return response.data;
    },
  });
};

export const useCreateStudent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateStudentData) => {
      const response = await api.post('/students', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: studentKeys.stats() });
    },
  });
};

export const useUpdateStudent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateStudentData }) => {
      const response = await api.put(`/students/${id}`, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: studentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: studentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: studentKeys.stats() });
    },
  });
};

export const useDeleteStudent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/students/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: studentKeys.stats() });
    },
  });
};

export const useUploadStudentAvatar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append('avatar', file);
      
      const response = await api.post(`/students/${id}/avatar`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: studentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: studentKeys.lists() });
    },
  });
};

export const useUploadStudentDocuments = () => {
  return useMutation({
    mutationFn: async ({ id, files }: { id: string; files: File[] }) => {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('documents', file);
      });
      
      const response = await api.post(`/students/${id}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
  });
};

export const useLinkParentToStudent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ studentId, parentId, relation }: { studentId: string; parentId: string; relation: 'PERE' | 'MERE' | 'TUTEUR' | 'AUTRE' }) => {
      const response = await api.post(`/students/${studentId}/parents`, {
        parentId,
        relation,
      });
      return response.data;
    },
    onSuccess: (_, { studentId }) => {
      queryClient.invalidateQueries({ queryKey: studentKeys.detail(studentId) });
      queryClient.invalidateQueries({ queryKey: studentKeys.lists() });
    },
  });
};

export const useUnlinkParentFromStudent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ studentId, parentId }: { studentId: string; parentId: string }) => {
      const response = await api.delete(`/students/${studentId}/parents/${parentId}`);
      return response.data;
    },
    onSuccess: (_, { studentId }) => {
      queryClient.invalidateQueries({ queryKey: studentKeys.detail(studentId) });
      queryClient.invalidateQueries({ queryKey: studentKeys.lists() });
    },
  });
};
