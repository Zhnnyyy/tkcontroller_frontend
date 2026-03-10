export type PayloadField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'url' | 'password';
  required?: boolean;
  helper?: string;
};

export const COMMAND_PAYLOAD_FIELDS: Record<string, PayloadField[]> = {
  setup_tailscale: [
    {
      key: 'download_url',
      label: 'Tailscale download URL',
      placeholder: 'https://',
      type: 'url',
      required: true,
    },
    {
      key: 'auth_key',
      label: 'Tailscale auth key',
      placeholder: 'tskey-...',
      type: 'text',
      required: true,
    },
  ],
  update_tailscale: [
    {
      key: 'download_url',
      label: 'Tailscale update URL',
      placeholder: 'https://',
      type: 'url',
      required: true,
    },
    {
      key: 'auth_key',
      label: 'Auth key (optional)',
      placeholder: 'tskey-...',
      type: 'text',
      required: false,
      helper: 'Leave blank to skip',
    },
  ],
  tailscale_up: [
    {
      key: 'auth_key',
      label: 'Tailscale auth key',
      placeholder: 'tskey-...',
      type: 'text',
      required: true,
    },
  ],
  update_service: [
    {
      key: 'download_url',
      label: 'Update APK URL',
      placeholder: 'https://',
      type: 'url',
      required: true,
    },
  ],
  install_lbrdc_service: [
    {
      key: 'download_url',
      label: 'LBRDC service APK URL',
      placeholder: 'https://',
      type: 'url',
      required: false,
      helper: 'Leave blank to use the device default',
    },
  ],
  install_magisk_module: [
    {
      key: 'download_url',
      label: 'Magisk module ZIP URL',
      placeholder: 'https://',
      type: 'url',
      required: true,
    },
  ],
  remove_magisk_module: [
    {
      key: 'module_id',
      label: 'Magisk module id',
      placeholder: 'zygisk_lsposed',
      type: 'text',
      required: true,
      helper: 'Use the module id from check_app_status > magisk_modules',
    },
  ],
  update_timekeeping: [
    {
      key: 'download_url',
      label: 'Timekeeping APK URL',
      placeholder:
        'https://www.dropbox.com/scl/fi/hv60dph84vg7aafzdx4uv/STimekeeping.apk?rlkey=fxkcn2tuaqlywvquavw5p182t&st=n0lhoky1&dl=1',
      type: 'url',
      required: true,
      helper: 'Defaults to the Dropbox release link',
    },
  ],
};
