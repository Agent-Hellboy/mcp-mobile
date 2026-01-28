# MCP Mobile Client Plan

## Goals
- Build a cross-platform MCP client focused on mobile (iOS/Android) with a shared core.
- Provide auth, JSON-RPC requests, streaming, tool calls, file uploads, and offline queuing.
- Keep the code modular, testable, and easy to extend.

## Architecture
- `packages/mcp-core`: Shared TypeScript MCP client (transport, auth, queue, types).
- `apps/mobile`: Expo React Native app with screens and UI for MCP usage.

## Milestones
1. Scaffold Expo app and shared MCP core.
2. Implement MCP client features (auth, request/stream, tools, uploads).
3. Add offline persistence via AsyncStorage and auto-flush on reconnect.
4. Add basic tests for core transport and queue.

## Current Status
- Milestones 1–2 completed.
- Offline persistence pending.

## Next Steps
- Add AsyncStorage queue adapter and wire it into the mobile app.
- Add connectivity monitoring to trigger queue flush.
- Add minimal integration tests for request + queue paths.
