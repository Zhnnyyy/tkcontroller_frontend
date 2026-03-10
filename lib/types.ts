export interface Device {
  device_id: string;
  device_name: string;
  connection_status: 'connected' | 'disconnected' | 'connecting';
  health_metrics?: Record<string, any>;
  last_seen?: string;
}

export interface CommandResponse {
  success: boolean;
  message: string;
  data?: any;
  timestamp?: string;
}

export interface CommandExecutionState {
  command: string;
  commandId?: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  response?: CommandResponse;
  error?: string;
  timestamp?: string;
}

export const DEVICE_COMMANDS = {
  APP: [
    { id: 'check_app_status', label: 'Check App Status' },
    { id: 'pin_app', label: 'Pin App' },
    { id: 'unpin_app', label: 'Unpin App' },
    { id: 'launch_app', label: 'Launch App' },
    { id: 'destroy_app', label: 'Destroy App' },
    { id: 'update_timekeeping', label: 'Update Timekeeping' },
  ],
  DEVICE: [
    { id: 'reboot_device', label: 'Reboot Device' },
    { id: 'magisk_fix_env', label: 'Magisk Fix Env' },
    { id: 'set_device_owner', label: 'Set Device Owner' },
    { id: 'remove_device_owner', label: 'Remove Device Owner' },
    { id: 'grant_keep_alive_policies', label: 'Grant Keep-Alive Policies' },
    { id: 'install_usb_autogrant_module', label: 'Install USB Autogrant Module' },
  ],
  NETWORK: [
    { id: 'wifi_state', label: 'WiFi State' },
    { id: 'update_service', label: 'Update Service' },
    { id: 'install_lbrdc_service', label: 'Install LBRDC Service' },
  ],
  TAILSCALE: [
    { id: 'setup_tailscale', label: 'Setup Tailscale' },
    { id: 'update_tailscale', label: 'Update Tailscale' },
    { id: 'tailscale_up', label: 'Tailscale Up' },
    { id: 'tailscale_adb', label: 'Tailscale ADB' },
    { id: 'tailscale_down', label: 'Tailscale Down' },
    { id: 'uninstall_tailscale', label: 'Uninstall Tailscale' },
  ],
  HEALTH: [
    { id: 'check_device_health', label: 'Check Device Health' },
  ],
};
