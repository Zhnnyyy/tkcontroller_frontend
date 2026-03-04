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
      required: true,
    },
  ],
};
