import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View as RNView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useMcp } from '@/components/McpContext';
import { HttpTransport, McpClient, TokenAuthProvider } from '@mcp/core';

type DropdownProps = {
  value: string;
  options: { label: string; value: string }[];
  onValueChange: (value: string) => void;
};

function Dropdown({ value, options, onValueChange }: DropdownProps) {
  const [visible, setVisible] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <RNView>
      <Pressable style={styles.dropdown} onPress={() => setVisible(true)}>
        <Text style={styles.dropdownText}>{selectedOption.label}</Text>
        <Text style={styles.dropdownArrow}>▼</Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setVisible(false)}>
          <View style={styles.modalContent}>
            {options.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.dropdownOption, value === option.value && styles.dropdownOptionActive]}
                onPress={() => {
                  onValueChange(option.value);
                  setVisible(false);
                }}>
                <Text style={[styles.dropdownOptionText, value === option.value && styles.dropdownOptionTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </RNView>
  );
}

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

const randomId = () => `m_${Math.random().toString(36).slice(2)}`;

type OpenAiToolCall = {
  id: string;
  function?: { name?: string; arguments?: string };
};

type OpenAiMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content?: string; tool_calls?: OpenAiToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

type OpenAiTool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

const ensureJsonObject = (value: unknown) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
};

const buildMcpClient = (server: {
  serverUrl: string;
  endpoint: string;
  token?: string;
}) => {
  const authProvider = new TokenAuthProvider(server.token ?? '');
  return new McpClient({
    transport: new HttpTransport({
      serverUrl: server.serverUrl,
      endpoint: server.endpoint,
      authProvider,
    }),
  });
};

const normalizeMcpTools = (payload: unknown) => {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { tools?: unknown }).tools)) {
    return (payload as { tools: Record<string, unknown>[] }).tools;
  }
  return [];
};

const buildOpenAiTools = (tools: Record<string, unknown>[]): OpenAiTool[] =>
  tools
    .map((tool) => {
      const name = String(tool.name ?? '');
      if (!name) return null;
      const description = typeof tool.description === 'string' ? tool.description : undefined;
      const parametersCandidate =
        (tool.inputSchema as Record<string, unknown> | undefined) ??
        (tool.parameters as Record<string, unknown> | undefined) ??
        (tool.schema as Record<string, unknown> | undefined) ??
        { type: 'object', properties: {} };
      const parameters = ensureJsonObject(parametersCandidate);
      if (!('type' in parameters)) {
        parameters.type = 'object';
      }
      return {
        type: 'function',
        function: {
          name,
          description,
          parameters,
        },
      };
    })
    .filter(Boolean) as OpenAiTool[];

const callOpenAIWithTools = async (options: {
  apiKey: string;
  model: string;
  messages: OpenAiMessage[];
  tools: OpenAiTool[];
}) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      tools: options.tools.length ? options.tools : undefined,
      tool_choice: options.tools.length ? 'auto' : undefined,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${text}`);
  }

  const json = (await response.json()) as {
    choices?: {
      message?: {
        content?: string;
        tool_calls?: OpenAiToolCall[];
      };
    }[];
  };

  const message = json.choices?.[0]?.message;
  return {
    content: message?.content ?? '',
    toolCalls: message?.tool_calls ?? [],
  };
};

const callAnthropic = async (apiKey: string, model: string, input: string) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: input }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${text}`);
  }

  const json = (await response.json()) as {
    content?: { text?: string }[];
  };
  return json.content?.map((item) => item.text).filter(Boolean).join('\n') ?? 'No response.';
};

export default function ChatScreen() {
  const {
    servers,
    activeServerId,
    provider,
    setProvider,
    openaiModel,
    anthropicModel,
    openaiKey,
    anthropicKey,
  } = useMcp();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const pushMessage = (role: Message['role'], content: string) => {
    setMessages((prev) => [...prev, { id: randomId(), role, content }]);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userText = input.trim();
    setInput('');
    pushMessage('user', userText);

    try {
      if (provider === 'openai') {
        if (!openaiKey) {
          pushMessage('assistant', 'Missing OpenAI key. Add it in Settings.');
          return;
        }
        const active = servers.find((server) => server.id === activeServerId);
        const baseMessages: OpenAiMessage[] = [
          {
            role: 'system',
            content:
              'You are a helpful assistant. Use available tools when needed to fulfill the user request.',
          },
          ...messages
            .filter((msg) => msg.role !== 'system')
            .map((msg) => ({
              role: msg.role === 'assistant' ? 'assistant' : 'user',
              content: msg.content,
            })),
          { role: 'user', content: userText },
        ];

        let tools: OpenAiTool[] = [];
        let mcpClient: McpClient | null = null;
        let defaultToolHint = '';

        if (active?.serverUrl) {
          try {
            mcpClient = buildMcpClient(active);
            await mcpClient.initialize({
              name: 'mcp-mobile',
              version: '0.1.0',
              platform: 'react-native',
            });
            const toolPayload = await mcpClient.listTools();
            const mcpTools = normalizeMcpTools(toolPayload);
            tools = buildOpenAiTools(mcpTools);
            if (active.defaultTool) {
              defaultToolHint = `If a tool is required, prefer using "${active.defaultTool}".`;
              baseMessages.unshift({ role: 'system', content: defaultToolHint });
            }
          } catch (error) {
            pushMessage('assistant', `MCP tools unavailable: ${String(error)}`);
          }
        }

        const firstPass = await callOpenAIWithTools({
          apiKey: openaiKey,
          model: openaiModel,
          messages: baseMessages,
          tools,
        });

        if (firstPass.content) {
          pushMessage('assistant', firstPass.content);
        }

        if (!firstPass.toolCalls.length) {
          if (!firstPass.content) {
            pushMessage('assistant', 'No response.');
          }
          return;
        }

        if (!mcpClient) {
          pushMessage('assistant', 'Model requested tools but no MCP server is configured.');
          return;
        }

        const toolMessages: OpenAiMessage[] = [];
        for (const call of firstPass.toolCalls) {
          const toolName = call.function?.name ?? 'unknown';
          let args: Record<string, unknown> = {};
          if (call.function?.arguments) {
            try {
              args = JSON.parse(call.function.arguments) as Record<string, unknown>;
            } catch (error) {
              args = { raw: call.function.arguments, error: String(error) };
            }
          }

          pushMessage('assistant', `Calling tool: ${toolName}`);
          try {
            const result = await mcpClient.callTool({ name: toolName, arguments: args });
            const content = JSON.stringify(result, null, 2);
            toolMessages.push({ role: 'tool', tool_call_id: call.id, content });
            pushMessage('assistant', `Tool result: ${content}`);
          } catch (error) {
            const content = JSON.stringify({ error: String(error) });
            toolMessages.push({ role: 'tool', tool_call_id: call.id, content });
            pushMessage('assistant', `Tool error: ${String(error)}`);
          }
        }

        const secondPass = await callOpenAIWithTools({
          apiKey: openaiKey,
          model: openaiModel,
          messages: [
            ...baseMessages,
            { role: 'assistant', tool_calls: firstPass.toolCalls },
            ...toolMessages,
          ],
          tools,
        });

        pushMessage('assistant', secondPass.content || 'Done.');
        return;
      }

      if (!anthropicKey) {
        pushMessage('assistant', 'Missing Anthropic key. Add it in Settings.');
        return;
      }
      const reply = await callAnthropic(anthropicKey, anthropicModel, userText);
      pushMessage('assistant', reply);
    } catch (error) {
      pushMessage('assistant', `Error: ${String(error)}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Chat</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Model Provider</Text>
        <Dropdown
          value={provider}
          options={[
            { label: `OpenAI (${openaiModel})`, value: 'openai' },
            { label: `Anthropic (${anthropicModel})`, value: 'anthropic' },
          ]}
          onValueChange={(value) => setProvider(value as 'openai' | 'anthropic')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Chat</Text>
        <View style={styles.chatBox}>
          {messages.length === 0 ? (
            <Text style={styles.emptyChatText}>Start a conversation...</Text>
          ) : (
            messages.map((message) => (
              <View key={message.id} style={styles.message}>
                <Text style={styles.messageRole}>{message.role.toUpperCase()}</Text>
                <Text style={styles.messageText}>{message.content}</Text>
              </View>
            ))
          )}
        </View>

        <RNView style={styles.row}>
          <TextInput
            style={[styles.input, styles.rowInput]}
            value={input}
            onChangeText={setInput}
            placeholder="Ask in plain English..."
            autoCapitalize="sentences"
          />
          <Pressable style={styles.buttonInline} onPress={handleSend}>
            <Text style={styles.buttonText}>Send</Text>
          </Pressable>
        </RNView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 14,
    color: '#111827',
  },
  dropdownArrow: {
    fontSize: 10,
    color: '#6b7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
    maxWidth: '80%',
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dropdownOptionActive: {
    backgroundColor: '#f3f4f6',
  },
  dropdownOptionText: {
    fontSize: 14,
    color: '#111827',
  },
  dropdownOptionTextActive: {
    fontWeight: '600',
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowInput: {
    flex: 1,
  },
  buttonInline: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  chatBox: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    backgroundColor: '#f8fafc',
    minHeight: 200,
  },
  emptyChatText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
  },
  message: {
    gap: 4,
  },
  messageRole: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
  },
  messageText: {
    fontSize: 14,
  },
});
