import { Button, Select, Space } from 'antd';

interface PaginationBarProps {
  current: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function PaginationBar({
  current,
  pageSize,
  total,
  onChange,
  onPageSizeChange,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mt-6 flex justify-center">
      <Space>
        <Button disabled={current === 1} onClick={() => onChange(current - 1)}>
          Précédent
        </Button>
        <span className="px-4 text-muted-foreground">
          Page {current} sur {totalPages}
        </span>
        <Button disabled={current >= totalPages} onClick={() => onChange(current + 1)}>
          Suivant
        </Button>
        <Select value={pageSize} onChange={onPageSizeChange} style={{ width: 120 }}>
          <Select.Option value={12}>12 / page</Select.Option>
          <Select.Option value={24}>24 / page</Select.Option>
          <Select.Option value={48}>48 / page</Select.Option>
        </Select>
      </Space>
    </div>
  );
}
