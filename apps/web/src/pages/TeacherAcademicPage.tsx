import { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Select,
  Typography,
  Empty,
  Tag,
  Row,
  Col,
  Form,
  Tabs,
} from 'antd';
import {
  TeamOutlined,
  BookOutlined,
  CalendarOutlined,
  ScheduleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

const { Title, Text } = Typography;

const dayNames: { [key: string]: string } = {
  MONDAY: 'Lundi',
  TUESDAY: 'Mardi',
  WEDNESDAY: 'Mercredi',
  THURSDAY: 'Jeudi',
  FRIDAY: 'Vendredi',
  SATURDAY: 'Samedi',
};

const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export default function TeacherAcademicPage() {
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('classes');

  // Fetch academic years
  const { data: academicYearsData } = useQuery({
    queryKey: ['academic-years-all'],
    queryFn: async () => {
      const response = await api.get('/academic-years');
      return response.data.data || [];
    },
  });

  // Get current academic year as default
  useEffect(() => {
    if (academicYearsData && academicYearsData.length > 0 && !selectedAcademicYear) {
      const currentYear = academicYearsData.find((year: any) => year.isCurrent);
      if (currentYear) {
        setSelectedAcademicYear(currentYear);
      }
    }
  }, [academicYearsData, selectedAcademicYear]);

  // Fetch teacher's class assignments
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['teacher-assignments', selectedAcademicYear?.id],
    queryFn: async () => {
      if (!selectedAcademicYear) return [];
      
      try {
        const response = await api.get(`/teachers/me/assignments?academicYearId=${selectedAcademicYear.id}`);
        return response.data.data || [];
      } catch (error: any) {
        console.error('Error fetching assignments:', error);
        return [];
      }
    },
    enabled: !!selectedAcademicYear,
  });

  // Fetch teacher's timetable
  const { data: timetableData, isLoading: timetableLoading } = useQuery({
    queryKey: ['teacher-timetable', selectedAcademicYear?.id],
    queryFn: async () => {
      if (!selectedAcademicYear) return [];
      
      try {
        const response = await api.get(`/teachers/me/timetable?academicYearId=${selectedAcademicYear.id}`);
        return response.data.data || [];
      } catch (error: any) {
        console.error('Error fetching timetable:', error);
        return [];
      }
    },
    enabled: !!selectedAcademicYear,
  });

  // Filter timetable to show only days with courses
  const filteredTimetableData = timetableData?.filter((item: any) => item.day_of_week) || [];
  
  // Group timetable by day
  const timetableByDay = filteredTimetableData.reduce((acc: any, item: any) => {
    const day = item.day_of_week;
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(item);
    return acc;
  }, {});

  // Sort timetable entries by start time within each day
  Object.keys(timetableByDay).forEach((day) => {
    timetableByDay[day].sort((a: any, b: any) => {
      const timeA = a.start_time || '';
      const timeB = b.start_time || '';
      return timeA.localeCompare(timeB);
    });
  });

  // Get days that have courses, sorted by day order
  const daysWithCourses = dayOrder.filter(day => timetableByDay[day] && timetableByDay[day].length > 0);

  // Classes Table columns
  const classesColumns = [
    {
      title: 'Classe',
      key: 'class',
      width: 200,
      render: (_: any, record: any) => (
        <div>
          <Text strong style={{ fontSize: '15px', color: 'rgb(var(--role-primary))' }}>
            {record.class?.name || 'N/A'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Matières',
      key: 'subjects',
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {record.subjects && record.subjects.length > 0 ? (
            record.subjects.map((subject: any, index: number) => (
              <Tag
                key={index}
                style={{
                  background: 'linear-gradient(135deg, rgba(36, 174, 106, 0.1) 0%, rgba(36, 174, 106, 0.05) 100%)',
                  border: '1px solid rgba(36, 174, 106, 0.3)',
                  color: 'rgb(var(--role-primary))',
                  borderRadius: '6px',
                  fontSize: '13px',
                  padding: '4px 12px',
                  margin: 0,
                }}
              >
                {subject.name}
              </Tag>
            ))
          ) : (
            <Text type="secondary">Aucune matière</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Année Scolaire',
      key: 'academicYear',
      width: 150,
      render: (_: any, record: any) => (
        <div>
          <Text style={{ fontSize: '14px' }}>
            {record.academicYear?.name || 'N/A'}
          </Text>
          {record.academicYear?.isCurrent && (
            <Tag color="green" style={{ marginTop: '4px', display: 'block', width: 'fit-content' }}>
              En cours
            </Tag>
          )}
        </div>
      ),
    },
  ];

  // Timetable Table columns
  const timetableColumns = [
    {
      title: 'Heure',
      key: 'time',
      width: 180,
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClockCircleOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
          <Text strong style={{ fontSize: '14px' }}>
            {record.start_time} - {record.end_time}
          </Text>
        </div>
      ),
      sorter: (a: any, b: any) => {
        const timeA = a.start_time || '';
        const timeB = b.start_time || '';
        return timeA.localeCompare(timeB);
      },
    },
    {
      title: 'Classe',
      key: 'class',
      width: 150,
      render: (_: any, record: any) => (
        <Text strong style={{ fontSize: '14px', color: 'rgb(var(--role-primary))' }}>
          {record.class?.name || 'N/A'}
        </Text>
      ),
    },
    {
      title: 'Matière',
      key: 'subject',
      width: 200,
      render: (_: any, record: any) => (
        <div>
          <Text strong style={{ fontSize: '14px' }}>
            {record.subject?.name || 'N/A'}
          </Text>
          {record.subject?.code && (
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Code: {record.subject.code}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Salle',
      key: 'classroom',
      width: 120,
      render: (_: any, record: any) => (
        <Tag
          style={{
            background: 'linear-gradient(135deg, rgba(36, 174, 106, 0.1) 0%, rgba(36, 174, 106, 0.05) 100%)',
            border: '1px solid rgba(36, 174, 106, 0.3)',
            color: 'rgb(var(--role-primary))',
            borderRadius: '6px',
            fontSize: '13px',
            padding: '4px 12px',
          }}
        >
          {record.classroom?.name || 'N/A'}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: '0' }} className="fade-in">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0, color: 'rgb(var(--role-primary))' }}>
          <CalendarOutlined style={{ marginRight: '12px' }} />
          Année Académique
        </Title>
        <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '16px' }}>
          Consultez vos classes et votre emploi du temps
        </p>
      </div>

      {/* Filters */}
      <Card className="modern-card" style={{ marginBottom: '24px' }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Form.Item label="Année Scolaire" style={{ marginBottom: 0 }}>
              <Select
                placeholder="Sélectionnez une année scolaire"
                value={selectedAcademicYear?.id}
                onChange={(value) => {
                  const year = academicYearsData?.find((y: any) => y.id === value);
                  setSelectedAcademicYear(year);
                }}
                className="modern-select"
                showSearch
                optionFilterProp="children"
                style={{ cursor: 'pointer' }}
              >
                {academicYearsData?.map((year: any) => (
                  <Select.Option key={year.id} value={year.id}>
                    {year.name} {year.isCurrent && '(En cours)'}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* Main Content with Tabs */}
      {selectedAcademicYear ? (
        <Card className="modern-card">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type="card"
            size="large"
            style={{
              marginBottom: '24px',
            }}
            items={[
              {
                key: 'classes',
                label: (
                  <span>
                    <TeamOutlined style={{ marginRight: '8px' }} />
                    Mes Classes
                  </span>
                ),
                children: (
                  <div>
                    <div style={{ marginBottom: '16px' }}>
                      <Title level={4} style={{ margin: 0, color: 'rgb(var(--role-primary))' }}>
                        <BookOutlined style={{ marginRight: '8px' }} />
                        Mes Affectations - {selectedAcademicYear.name}
                      </Title>
                    </div>

                    {assignmentsLoading ? (
                      <div style={{ textAlign: 'center', padding: '40px' }}>
                        <Text>Chargement des affectations...</Text>
                      </div>
                    ) : !assignmentsData || assignmentsData.length === 0 ? (
                      <Empty
                        description="Aucune affectation trouvée pour cette année scolaire"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    ) : (
                      <Table
                        dataSource={assignmentsData}
                        loading={assignmentsLoading}
                        rowKey={(record: any) => `${record.academicYear?.id}-${record.class?.id}`}
                        columns={classesColumns}
                        scroll={{ x: 'max-content' }}
                        pagination={false}
                        style={{
                          marginTop: '16px',
                        }}
                      />
                    )}
                  </div>
                ),
              },
              {
                key: 'timetable',
                label: (
                  <span>
                    <ScheduleOutlined style={{ marginRight: '8px' }} />
                    Mon Emploi du Temps
                  </span>
                ),
                children: (
                  <div>
                    <div style={{ marginBottom: '16px' }}>
                      <Title level={4} style={{ margin: 0, color: 'rgb(var(--role-primary))' }}>
                        <CalendarOutlined style={{ marginRight: '8px' }} />
                        Emploi du Temps - {selectedAcademicYear.name}
                      </Title>
                    </div>

                    {timetableLoading ? (
                      <div style={{ textAlign: 'center', padding: '40px' }}>
                        <Text>Chargement de l'emploi du temps...</Text>
                      </div>
                    ) : daysWithCourses.length === 0 ? (
                      <Empty
                        description="Aucun cours programmé pour cette année scolaire"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    ) : (
                      <div>
                        {daysWithCourses.map((day) => (
                          <Card
                            key={day}
                            title={
                              <Text strong style={{ fontSize: '16px', color: 'rgb(var(--role-primary))' }}>
                                {dayNames[day]}
                              </Text>
                            }
                            style={{
                              marginBottom: '16px',
                              borderRadius: '8px',
                            }}
                          >
                            <Table
                              dataSource={timetableByDay[day]}
                              columns={timetableColumns}
                              rowKey="id"
                              pagination={false}
                              size="middle"
                              style={{
                                marginTop: '8px',
                              }}
                            />
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      ) : (
        <Card className="modern-card">
          <Empty
            description="Veuillez sélectionner une année scolaire pour voir vos informations"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}
    </div>
  );
}

