import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { subjectsApi } from '../lib/api';

export default function SubjectsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectsApi.getAll(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const subjects = data?.data.data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Matières</h1>
          <p className="text-gray-600">Gestion des matières</p>
        </div>
        <button className="btn-primary btn-md">
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle matière
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((subject: any) => (
          <div key={subject.id} className="card">
            <div className="card-content">
              <h3 className="text-lg font-semibold text-gray-900">{subject.name}</h3>
              <p className="text-sm text-gray-600">Code: {subject.code}</p>
              <p className="text-sm text-gray-600">Crédits: {subject.credits}</p>
              {subject.description && (
                <p className="text-sm text-gray-600 mt-2">{subject.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
