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
  install_usb_autogrant_module: [
    {
      key: 'download_url',
      label: 'Magisk module ZIP URL',
      placeholder:
        'https://www.dropbox.com/scl/fi/zupwanunp47lfzeabent5/zkteco-autogrant.zip?rlkey=9sv0rpni1c1wk88q3adx9iuip&st=s4sq3nqb&dl=1',
      type: 'url',
      required: false,
      helper: 'Defaults to the Dropbox USB autogrant module link',
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
