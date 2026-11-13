import { supabase } from './supabase';
import { SiteTask } from '../types';

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
  workerName: string,
  completionPhotos?: string[]
): Promise<void> {
  if (supabase) {
    try {
      const patch: any = {
        status: 'concluida_funcionario',
        completed_by_name: workerName,
        completed_at: new Date().toISOString(),
      };
      if (completionPhotos && completionPhotos.length > 0) {
        patch.completion_photos = completionPhotos;
      }
      await supabase
        .from('site_tasks')
        .update(patch)
        .eq('id', taskId);
    } catch (e) {
      console.warn('Erro ao concluir tarefa:', e);
    }
  }
}

