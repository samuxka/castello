import React, { useMemo } from 'react';
import { EmployeeProfile, TimeEntry } from '../types';
import { UserCheck } from 'lucide-react';

interface AttendanceChartProps {
  employees: EmployeeProfile[];
  entries: TimeEntry[];
}

function AttendanceChartBase({ employees, entries }: AttendanceChartProps) {
  const daysOfWeek = [
    { label: 'Seg', dayIdx: 1 },
    { label: 'Ter', dayIdx: 2 },
    { label: 'Qua', dayIdx: 3 },
    { label: 'Qui', dayIdx: 4 },
    { label: 'Sex', dayIdx: 5 },
    { label: 'Sáb', dayIdx: 6 },
  ];

  const totalEmployees = Math.max(1, employees.length);

  // Calcula a assiduidade REAL por dia da semana nos últimos 30 dias
  const weeklyAttendance = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgoIso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todayIso = now.toISOString().slice(0, 10);

    // Filtrar entradas dos últimos 30 dias
    const recentEntries = entries.filter((e) => {
      const wDate = e.work_date || (e.recorded_at ? e.recorded_at.slice(0, 10) : '');
      return wDate >= thirtyDaysAgoIso && wDate <= todayIso;
    });

    return daysOfWeek.map(({ label, dayIdx }) => {
      // Entradas que caíram neste dia da semana
      const matchingEntries = recentEntries.filter((e) => {
        const wDate = e.work_date || (e.recorded_at ? e.recorded_at.slice(0, 10) : '');
        if (!wDate) return false;
        const d = new Date(wDate + 'T12:00:00');
        return d.getDay() === dayIdx;
      });

      // Contar ocorrências distintas de datas (ex: quantas segundas-feiras houve no período)
      const uniqueDates = new Set<string>();
      matchingEntries.forEach((e) => {
        const wDate = e.work_date || (e.recorded_at ? e.recorded_at.slice(0, 10) : '');
        if (wDate) uniqueDates.add(wDate);
      });
      const daysCount = Math.max(1, uniqueDates.size);

      // Quantos colaboradores distintos registraram ponto em média por dia
      const uniqueEmployeesInDay = new Set<string>();
      matchingEntries.forEach((e) => {
        if (e.employee_id) uniqueEmployeesInDay.add(e.employee_id);
      });

      // Taxa real: se houve presenças, calcula a proporção em relação ao quadro da empresa
      let rate = 0;
      if (matchingEntries.length > 0) {
        const avgPresentPerDay = uniqueEmployeesInDay.size / daysCount;
        rate = Math.min(100, Math.round((avgPresentPerDay / totalEmployees) * 100));
      }

      return {
        day: label,
        rate,
        entriesCount: matchingEntries.length,
      };
    });
  }, [entries, totalEmployees]);

  // Ranking individual dos funcionários com cálculo de horas e taxa de assiduidade real
  const employeeAttendance = useMemo(() => {
    const currentMonthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM

    return employees.slice(0, 5).map((emp) => {
      // Pontos do colaborador neste mês
      const empEntries = entries.filter((e) => {
        const wDate = e.work_date || (e.recorded_at ? e.recorded_at.slice(0, 10) : '');
        return e.employee_id === emp.id && wDate.startsWith(currentMonthPrefix);
      });

      // Dias distintos em que o colaborador trabalhou no mês
      const distinctWorkDays = new Set<string>();
      empEntries.forEach((e) => {
        const wDate = e.work_date || (e.recorded_at ? e.recorded_at.slice(0, 10) : '');
        if (wDate) distinctWorkDays.add(wDate);
      });

      // Cada dia trabalhado equivale a 8h de jornada
      const totalHours = distinctWorkDays.size * 8;
      const targetHours = emp.monthly_target_hours || 176;
      const rate = Math.min(100, Math.round((totalHours / targetHours) * 100));

      return {
        id: emp.id,
        name: emp.full_name,
        jobTitle: emp.job_title || 'Colaborador',
        rate,
        hours: totalHours,
        daysCount: distinctWorkDays.size,
      };
    });
  }, [employees, entries]);

  // Média de assiduidade da firma
  const averageRate = useMemo(() => {
    if (employeeAttendance.length === 0) return 0;
    const sum = employeeAttendance.reduce((acc, curr) => acc + curr.rate, 0);
    return Math.round(sum / employeeAttendance.length);
  }, [employeeAttendance]);

  return (
    <div
      className="content-panel"
      style={{
        margin: 0,
        height: 275,
        maxHeight: 275,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        backgroundColor: 'var(--bg-card)',
      }}
    >
      {/* Topo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <UserCheck size={16} color="var(--primary)" />
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Assiduidade da Equipa
            </h3>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '1px 0 0' }}>
            Frequência nos canteiros de obras e horas do mês
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 6,
            backgroundColor: 'var(--primary-subtle)',
            border: '1px solid var(--border-color)',
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)' }}>
            Média: {averageRate}%
          </span>
        </div>
      </div>

      {/* Grid com barras por dia da semana e ranking individual */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 14, alignItems: 'flex-start', flex: 1, minHeight: 0, marginTop: 8 }}>
        {/* Barras semanais Seg - Sab */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Presença por Dia da Semana
          </span>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 110, padding: '0 2px', borderBottom: '1px solid var(--border-color)' }}>
            {weeklyAttendance.map((item) => (
              <div key={item.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: item.rate > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {item.rate}%
                </span>
                <div
                  style={{
                    width: 14,
                    height: `${Math.max(4, (item.rate / 100) * 70)}px`,
                    borderRadius: '2px 2px 0 0',
                    backgroundColor: item.rate > 0 ? 'var(--primary)' : 'var(--border-color)',
                    opacity: item.rate > 0 ? 0.9 : 0.4,
                    transition: 'height 0.2s ease',
                  }}
                  title={`${item.day}: ${item.rate}% de presença (${item.entriesCount} picagens)`}
                />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {item.day}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Lista dos Colaboradores com barra de progresso */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', overflowY: 'auto' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Desempenho no Mês
          </span>
          {employeeAttendance.length === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sem colaboradores</span>
          ) : (
            employeeAttendance.map((emp) => (
              <div key={emp.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                  <span
                    style={{
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 100,
                    }}
                    title={emp.name}
                  >
                    {emp.name}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 10, color: emp.rate >= 75 ? 'var(--success)' : 'var(--warning)' }}>
                    {emp.rate}% ({emp.hours}h)
                  </span>
                </div>
                <div style={{ height: 4, width: '100%', borderRadius: 2, backgroundColor: 'var(--bg-card-subtle)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${emp.rate}%`,
                      backgroundColor: emp.rate >= 75 ? 'var(--primary)' : 'var(--warning)',
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export const AttendanceChart = React.memo(AttendanceChartBase);
