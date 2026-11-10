export async function fetchSiteTasks(siteId: string): Promise<SiteTask[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('site_tasks')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });
      if (!error && data) return data as SiteTask[];
    } catch (e) {
      console.warn('Erro ao carregar tarefas da obra:', e);
    }
  }
  return [];
}

export async function completeTaskByWorker(
  taskId: string,
  workerName: string
): Promise<void> {
  if (supabase) {
    try {
      await supabase
        .from('site_tasks')
        .update({
          status: 'concluida_funcionario',
          completed_by_name: workerName,
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskId);
    } catch (e) {
      console.warn('Erro ao concluir tarefa:', e);
    }
  }
}

