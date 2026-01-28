# MCP Mobile Client

A cross-platform mobile client for the Model Context Protocol (MCP), built with React Native and Expo.

## Features

- 🤖 **MCP Server Integration** - Connect to MCP servers and use their tools
- 💬 **AI Chat Interface** - Chat with OpenAI or Anthropic models
- 🛠️ **Tool Calling** - Execute MCP tools directly from chat
- ⚙️ **Server Management** - Configure and manage multiple MCP servers
- 📱 **Cross-Platform** - Works on iOS and Android

## Architecture

This is a monorepo containing:

- `packages/mcp-core` - Shared TypeScript MCP client library (transport, auth, queue, types)
- `apps/mobile` - Expo React Native mobile app with chat and settings screens

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Expo CLI (installed globally or via npx)
- For iOS: Xcode and CocoaPods
- For Android: Android Studio and Android SDK

### Installation

```bash
# Install dependencies
npm install

# Start the mobile app
npm run dev:mobile

# Or start with cleared cache
npm run dev:mobile:clear
```

### Running on Device/Emulator

```bash
# Android
npm run android

# iOS
npm run ios

# Web
npm run web
```

## Configuration

### MCP Servers

1. Open the app and go to Settings
2. Add your MCP server configuration:
   - Server URL
   - Endpoint (default: `/mcp`)
   - Authentication token (if required)
   - Default tool preference

### API Keys

Add your API keys in Settings:
- **OpenAI API Key** - For GPT models
- **Anthropic API Key** - For Claude models

## Project Structure

```
.
├── apps/
│   └── mobile/          # Expo React Native app
│       ├── app/         # Expo Router routes
│       ├── components/  # React components
│       └── packages/    # Local packages
├── packages/
│   └── mcp-core/       # Shared MCP client library
└── package.json        # Root workspace config
```

## Development

### Workspace Scripts

- `npm run dev:mobile` - Start Metro bundler
- `npm run dev:mobile:clear` - Start with cleared cache
- `npm run android` - Open on Android
- `npm run ios` - Open on iOS simulator
- `npm run web` - Open in web browser

## Tech Stack

- **React Native** - Mobile framework
- **Expo** - Development platform and tooling
- **Expo Router** - File-based routing
- **React Navigation** - Navigation library
- **TypeScript** - Type safety

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
