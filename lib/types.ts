export interface Device {
  device_id: string;
  device_name: string;
  connection_status: 'connected' | 'disconnected' | 'connecting';
  health_metrics?: Record<string, any>;
  last_seen?: string;
  rustdesk_id?: string;
  zhentinel_id?: string;
  zhentinel_status?: string;
  zhentinel_server?: string;
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
    { id: 'install_magisk_module', label: 'Install Magisk Module' },
    { id: 'remove_magisk_module', label: 'Remove Magisk Module' },
    { id: 'set_device_owner', label: 'Set Device Owner' },
    { id: 'remove_device_owner', label: 'Remove Device Owner' },
    { id: 'grant_keep_alive_policies', label: 'Grant Keep-Alive Policies' },
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
  SECURITY: [
    { id: 'disable_status_bar', label: 'Disable Status Bar' },
    { id: 'enable_status_bar', label: 'Enable Status Bar' },
    { id: 'disable_keyguard', label: 'Disable Keyguard' },
    { id: 'enable_keyguard', label: 'Enable Keyguard' },
    { id: 'lock_hardware_buttons', label: 'Lock Hardware Buttons' },
    { id: 'unlock_hardware_buttons', label: 'Unlock Hardware Buttons' },
    { id: 'lock_usb_adb', label: 'Lock USB/ADB' },
    { id: 'unlock_usb_adb', label: 'Unlock USB/ADB' },
  ],
  HEALTH: [
    { id: 'check_device_health', label: 'Check Device Health' },
  ],
  ZHENTINEL: [
    { id: 'check_zhentinel_status', label: 'Check Remote Status' },
    { id: 'restart_zhentinel', label: 'Restart Zhentinel Host' },
  ],
  DIAGNOSTICS: [
    { id: 'capture_screenshot', label: 'Capture Screenshot' },
    { id: 'run_shell', label: 'Run Shell Command' },
    { id: 'list_files', label: 'List Files' },
    { id: 'download_file', label: 'Download File' },
    { id: 'upload_file', label: 'Upload File' },
  ],
};
