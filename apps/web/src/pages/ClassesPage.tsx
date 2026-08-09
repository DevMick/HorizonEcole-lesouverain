import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { classesApi } from '../lib/api';

export default function ClassesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesApi.getAll(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const classes = data?.data.data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="text-gray-600">Gestion des classes</p>
        </div>
        <button className="btn-primary btn-md">
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle classe
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((classItem: any) => (
          <div key={classItem.id} className="card">
            <div className="card-content">
              <h3 className="text-lg font-semibold text-gray-900">{classItem.name}</h3>
              <p className="text-sm text-gray-600">Niveau: {classItem.level}</p>
              <p className="text-sm text-gray-600">Année: {classItem.academicYear}</p>
              {classItem.teacher && (
                <p className="text-sm text-gray-600">
                  Professeur: {classItem.teacher.firstName} {classItem.teacher.lastName}
                </p>
              )}
              <p className="text-sm text-gray-600">
                Élèves: {classItem._count.students}/{classItem.capacity}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
