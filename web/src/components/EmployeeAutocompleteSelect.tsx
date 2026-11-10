import React, { useEffect, useState, useRef } from 'react';

interface EmployeeSelectProps {
  employees: Array<{ id: string; full_name: string; job_title: string }>;
  value: string;
  onChange: (fullName: string, employeeId?: string) => void;
  placeholder?: string;
}

export const EmployeeAutocompleteSelect: React.FC<EmployeeSelectProps> = ({
  employees,
  value,
  onChange,
  placeholder = 'Digite para pesquisar o funcionário encarregado...',
}) => {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = employees.filter((emp) =>
    emp.full_name.toLowerCase().includes(query.toLowerCase()) ||
    emp.job_title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setIsOpen(true);
        }}
        style={{ width: '100%' }}
      />

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            maxHeight: 200,
            overflowY: 'auto',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            zIndex: 150,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
              Nenhum colaborador encontrado com "{query}"
            </div>
          ) : (
            filtered.map((emp) => (
              <div
                key={emp.id}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border-color)',
                  fontSize: 13,
                }}
                onMouseDown={() => {
                  setQuery(emp.full_name);
                  onChange(emp.full_name, emp.id);
                  setIsOpen(false);
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-card-subtle)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{emp.full_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.job_title}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

