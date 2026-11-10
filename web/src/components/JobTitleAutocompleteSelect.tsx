import React, { useEffect, useState, useRef } from 'react';
import { Plus } from 'lucide-react';

interface JobTitleSelectProps {
  value: string;
  onChange: (jobTitle: string) => void;
  existingJobs?: string[];
  placeholder?: string;
}

const DEFAULT_JOBS = [
  'Mestre de Obra',
  'Encarregado Geral',
  'Pedreiro',
  'Pedreiro de Primeira',
  'Servente de Obra',
  'Ajudante de Obra',
  'Carpinteiro de Cofragem',
  'Carpinteiro de Limpos',
  'Ferreiro Armador',
  'Eletricista de Obras',
  'Canalizador / Picheleiro',
  'Pintor de Construção Civil',
  'Ladrilhador / Azulejista',
  'Estucador / Gesseiro',
  'Técnico de Instalações',
  'Operador de Máquinas',
  'Soldador',
  'Serralheiro Civil',
  'Engenheiro de Obra',
  'Arquiteto',
  'Técnico de Segurança no Trabalho',
];

export const JobTitleAutocompleteSelect: React.FC<JobTitleSelectProps> = ({
  value,
  onChange,
  existingJobs = [],
  placeholder = 'Digite o cargo (ex: Pedreiro, Eletricista...)',
}) => {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [customJobsList, setCustomJobsList] = useState<string[]>(() => {
    const saved = localStorage.getItem('castello_custom_job_titles');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

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

  // Une os cargos padrão, cargos já usados por outros colaboradores e cargos customizados
  const allJobOptions = Array.from(
    new Set([...DEFAULT_JOBS, ...existingJobs, ...customJobsList])
  );

  const filtered = allJobOptions.filter((job) =>
    job.toLowerCase().includes(query.toLowerCase())
  );

  const exactMatchExists = allJobOptions.some(
    (j) => j.toLowerCase() === query.trim().toLowerCase()
  );

  const handleAddNewJob = () => {
    const newTitle = query.trim();
    if (!newTitle) return;

    const nextList = Array.from(new Set([newTitle, ...customJobsList]));
    setCustomJobsList(nextList);
    localStorage.setItem('castello_custom_job_titles', JSON.stringify(nextList));

    onChange(newTitle);
    setIsOpen(false);
  };

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
            maxHeight: 220,
            overflowY: 'auto',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            zIndex: 160,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Botão para Adicionar Novo Cargo caso não exista combinação exata */}
          {query.trim().length > 0 && !exactMatchExists && (
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--primary-subtle)',
                borderBottom: '1px solid var(--primary-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                Cargo não encontrado: "{query.trim()}"
              </span>
              <button
                type="button"
                className="btn-flat-primary"
                style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAddNewJob();
                }}
              >
                <Plus size={12} />
                Adicionar Cargo
              </button>
            </div>
          )}

          {filtered.length === 0 && exactMatchExists ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
              Nenhum outro cargo disponível.
            </div>
          ) : (
            filtered.map((job) => (
              <div
                key={job}
                style={{
                  padding: '9px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border-color)',
                  fontSize: 13,
                  color: 'var(--text-main)',
                }}
                onMouseDown={() => {
                  setQuery(job);
                  onChange(job);
                  setIsOpen(false);
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-card-subtle)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                {job}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

