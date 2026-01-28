import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View as RNView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { ServerConfig, useMcp } from '@/components/McpContext';
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

export default function SettingsScreen() {
  const {
    servers,
    activeServerId,
    setActiveServerId,
    addServer,
    removeServer,
    updateServer,
    provider,
    setProvider,
    openaiModel,
    anthropicModel,
    setOpenaiModel,
    setAnthropicModel,
    openaiKey,
    anthropicKey,
    setOpenaiKey,
    setAnthropicKey,
  } = useMcp();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [endpoint, setEndpoint] = useState('/mcp');
  const [token, setToken] = useState('');
  const [defaultTool, setDefaultTool] = useState('chat');
  const [status, setStatus] = useState('');
  const [keyStatus, setKeyStatus] = useState('');

  const canSave = Boolean(name && serverUrl);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setServerUrl('');
    setEndpoint('/mcp');
    setToken('');
    setDefaultTool('chat');
  };

  const handleEdit = (server: ServerConfig) => {
    setEditingId(server.id);
    setName(server.name);
    setServerUrl(server.serverUrl);
    setEndpoint(server.endpoint);
    setToken(server.token ?? '');
    setDefaultTool(server.defaultTool || 'chat');
  };

  const handleSave = () => {
    if (!canSave) return;
    if (editingId) {
      updateServer(editingId, {
        name,
        serverUrl,
        endpoint,
        token,
        defaultTool,
      });
    } else {
      addServer({
        name,
        serverUrl,
        endpoint,
        token,
        defaultTool,
      });
    }
    resetForm();
    setStatus('Server saved.');
  };

  const handleCheck = async (server: ServerConfig) => {
    setStatus('Checking server...');
    const authProvider = new TokenAuthProvider(server.token ?? '');
    const testClient = new McpClient({
      transport: new HttpTransport({
        serverUrl: server.serverUrl,
        endpoint: server.endpoint,
        authProvider,
      }),
    });

    try {
      await testClient.initialize({
        name: 'mcp-mobile',
        version: '0.1.0',
        platform: 'react-native',
      });
      await testClient.listTools();
      updateServer(server.id, { ready: true });
      setStatus('Server ready.');
    } catch (error) {
      updateServer(server.id, { ready: false });
      setStatus(`Check failed: ${String(error)}`);
    }
  };

  const handleSaveKeys = () => {
    setKeyStatus('Keys updated for this session.');
    setTimeout(() => setKeyStatus(''), 3000);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>

      {/* API Keys Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API Keys for Model Provider</Text>
        <Text style={styles.helperText}>Keys are kept in memory only. Nothing is saved.</Text>

        <Text style={styles.label}>Provider</Text>
        <Dropdown
          value={provider}
          options={[
            { label: 'OpenAI', value: 'openai' },
            { label: 'Anthropic', value: 'anthropic' },
          ]}
          onValueChange={(value) => setProvider(value as 'openai' | 'anthropic')}
        />

        {provider === 'openai' ? (
          <>
            <Text style={styles.label}>OpenAI Model</Text>
            <TextInput
              style={styles.input}
              value={openaiModel}
              onChangeText={setOpenaiModel}
              placeholder="gpt-4.1-mini"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.label}>OpenAI API Key</Text>
            <TextInput
              style={styles.input}
              value={openaiKey}
              onChangeText={setOpenaiKey}
              placeholder="sk-..."
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>Anthropic Model</Text>
            <TextInput
              style={styles.input}
              value={anthropicModel}
              onChangeText={setAnthropicModel}
              placeholder="claude-3-5-sonnet-20241022"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.label}>Anthropic API Key</Text>
            <TextInput
              style={styles.input}
              value={anthropicKey}
              onChangeText={setAnthropicKey}
              placeholder="sk-ant-..."
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </>
        )}

        <RNView style={styles.row}>
          <Pressable style={styles.button} onPress={handleSaveKeys}>
            <Text style={styles.buttonText}>Save Keys</Text>
          </Pressable>
          {provider === 'openai' ? (
            <Pressable style={styles.buttonSecondary} onPress={() => setOpenaiKey('')}>
              <Text style={styles.buttonSecondaryText}>Clear</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.buttonSecondary} onPress={() => setAnthropicKey('')}>
              <Text style={styles.buttonSecondaryText}>Clear</Text>
            </Pressable>
          )}
        </RNView>
        {keyStatus ? <Text style={styles.status}>{keyStatus}</Text> : null}
      </View>

      {/* Configure MCP Servers Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configure MCP Servers</Text>
        {servers.map((server) => (
          <View key={server.id} style={styles.serverCard}>
            <RNView style={styles.serverHeader}>
              <RNView style={styles.serverHeaderLeft}>
                <Text style={styles.serverName}>{server.name}</Text>
                <Text style={styles.serverMeta}>
                  {server.serverUrl}
                  {server.endpoint}
                </Text>
              </RNView>
              <Text style={server.ready ? styles.ready : styles.notReady}>
                {server.ready ? 'Ready' : 'Not ready'}
              </Text>
            </RNView>
            <RNView style={styles.serverRow}>
              <Pressable style={styles.smallButton} onPress={() => setActiveServerId(server.id)}>
                <Text style={styles.smallButtonText}>Use</Text>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={() => handleEdit(server)}>
                <Text style={styles.smallButtonText}>Edit</Text>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={() => handleCheck(server)}>
                <Text style={styles.smallButtonText}>Check</Text>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={() => removeServer(server.id)}>
                <Text style={styles.smallButtonText}>Delete</Text>
              </Pressable>
            </RNView>
          </View>
        ))}
      </View>

      {/* Add MCP Server Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{editingId ? 'Edit Server' : 'Add MCP Server'}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Server name"
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="https://server.example"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <RNView style={styles.row}>
          <TextInput
            style={[styles.input, styles.rowInput]}
            value={endpoint}
            onChangeText={setEndpoint}
            placeholder="/mcp"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={[styles.input, styles.rowInput]}
            value={defaultTool}
            onChangeText={setDefaultTool}
            placeholder="tool name"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </RNView>
        <TextInput
          style={styles.input}
          value={token}
          onChangeText={setToken}
          placeholder="Bearer token (optional)"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <RNView style={styles.row}>
          <Pressable style={styles.button} onPress={handleSave}>
            <Text style={styles.buttonText}>{editingId ? 'Save Changes' : 'Add Server'}</Text>
          </Pressable>
          <Pressable style={styles.buttonSecondary} onPress={resetForm}>
            <Text style={styles.buttonSecondaryText}>Clear</Text>
          </Pressable>
        </RNView>
        {status ? <Text style={styles.status}>{status}</Text> : null}
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
    marginTop: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
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
  row: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  rowInput: {
    flex: 1,
  },
  button: {
    flex: 1,
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#111827',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#111827',
    fontWeight: '600',
  },
  serverCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    backgroundColor: '#fff',
  },
  serverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serverHeaderLeft: {
    flex: 1,
    gap: 4,
  },
  serverName: {
    fontWeight: '700',
  },
  serverMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  serverRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  smallButton: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  ready: {
    color: '#059669',
    fontWeight: '600',
    fontSize: 12,
  },
  notReady: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 12,
  },
  status: {
    fontSize: 12,
    color: '#111827',
    marginTop: 4,
  },
});
