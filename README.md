# Device Controller Web UI

A modern, professional web interface for managing and controlling devices via Socket.io.

## Features

- **Real-time Device Discovery**: Automatically discovers connected devices
- **18 Device Commands**: Organized by category (App, Device, Network, Tailscale, Health)
- **Live Response Display**: Shows command execution results with copy and download functionality
- **Connection Status**: Visual indicators for socket connection and device status
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Error Handling**: Clear error messages and auto-reconnect logic

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn package manager
- Backend server running on `http://localhost:3000` (configurable)

### Installation

1. Navigate to the web-ui directory:
   ```bash
   cd web-ui
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and set the backend URL:
   ```
   NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
   ```

### Development

Start the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Production Build

Build the application for production:

```bash
npm run build
npm start
```

## Project Structure

```
web-ui/
├── app/
│   ├── layout.tsx          # Root layout with SocketProvider
│   ├── page.tsx            # Main dashboard page
│   └── globals.css         # Global styles and design tokens
├── components/
│   ├── SocketProvider.tsx  # Socket.io context and state
│   ├── DeviceSelector.tsx  # Device selection dropdown
│   ├── CommandGrid.tsx     # Grid of command buttons
│   ├── CommandButton.tsx   # Individual command button
│   ├── ResponseDisplay.tsx # Command response viewer
│   └── ConnectionStatus.tsx # Connection status indicator
├── lib/
│   ├── types.ts           # TypeScript types and command definitions
│   └── socket.ts          # Socket.io client setup
├── .env.example           # Environment variables template
└── package.json           # Project dependencies
```

## Usage

1. **Select a Device**: Use the dropdown on the left sidebar to select a target device
2. **Execute Command**: Click any command button to execute it on the selected device
3. **View Response**: The command response automatically appears in the "Execution Result" section
4. **Copy/Download**: Use the buttons in the response section to copy the output or download it as a file

## Command Categories

- **APP**: Check app status, pin/unpin apps, launch and destroy apps
- **DEVICE**: Reboot device, manage device owner
- **NETWORK**: WiFi state, update service, install LBRDC service
- **TAILSCALE**: Setup, update, and manage Tailscale VPN
- **HEALTH**: Check overall device health

## Architecture

The application uses:
- **Next.js 16**: React framework with App Router
- **Socket.io Client**: Real-time bidirectional communication
- **Tailwind CSS**: Utility-first styling
- **TypeScript**: Type safety
- **React Context**: State management for socket and devices

## Configuration

### Backend URL

By default, the application connects to `http://localhost:3000`. Change this by updating the `NEXT_PUBLIC_BACKEND_URL` environment variable:

```bash
NEXT_PUBLIC_BACKEND_URL=http://your-backend-url:port
```

## Troubleshooting

### Connection Issues

If the application can't connect to the backend:
1. Ensure the backend server is running
2. Check the `NEXT_PUBLIC_BACKEND_URL` in `.env.local`
3. Verify CORS is enabled on the backend
4. Check browser console for error messages

### No Devices Found

1. Ensure devices are connected to the backend
2. Click the refresh button (↻) in the header
3. Check if the socket connection is established (green indicator)

### Command Timeout

Commands have a 30-second timeout. If a command times out:
1. Check if the device is still connected
2. Try the command again
3. Check backend logs for errors

## License

ISC

## Support

For issues or questions, please check the main project repository or contact the development team.
