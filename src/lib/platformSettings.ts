import { supabase } from './supabase';

export interface PlatformSettings {
  maintenanceMode: boolean;
  allowSignups: boolean;
}

const DEFAULT_SETTINGS: PlatformSettings = { maintenanceMode: false, allowSignups: true };

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('maintenance_mode, allow_signups')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('fetchPlatformSettings error:', error);
    return DEFAULT_SETTINGS;
  }
  return { maintenanceMode: data.maintenance_mode, allowSignups: data.allow_signups };
}

export async function updatePlatformSettings(
  patch: Partial<PlatformSettings>,
  updatedBy: string
): Promise<{ success: boolean; message?: string }> {
  const { error } = await supabase
    .from('platform_settings')
    .update({
      ...(patch.maintenanceMode !== undefined ? { maintenance_mode: patch.maintenanceMode } : {}),
      ...(patch.allowSignups !== undefined ? { allow_signups: patch.allowSignups } : {}),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    })
    .eq('id', 1);

  if (error) return { success: false, message: error.message };
  return { success: true };
}
