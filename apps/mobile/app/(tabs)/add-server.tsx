import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View as RNView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { ServerConfig, useMcp } from '@/components/McpContext';

export default function AddServerScreen() {
  const { servers, addServer, removeServer, updateServer, activeServerId, setActiveServerId, getOrCreateClient } = useMcp();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [endpoint, setEndpoint] = useState('/mcp');
  const [token, setToken] = useState('');
  const [defaultTool, setDefaultTool] = useState('chat');
  const [status, setStatus] = useState('');

  const canSave = Boolean(name && serverUrl);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setServerUrl('');
    setEndpoint('/mcp');
    setToken('');
    setDefaultTool('chat');
    setStatus('');
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
    if (!canSave) {
      setStatus('Please fill in server name and URL');
      setTimeout(() => setStatus(''), 3000);
      return;
    }
    if (editingId) {
      updateServer(editingId, {
        name,
        serverUrl,
        endpoint,
        token,
        defaultTool,
      });
      setStatus(`✓ Server "${name}" updated successfully`);
      resetForm();
    } else {
      addServer({
        name,
        serverUrl,
        endpoint,
        token,
        defaultTool,
      });
      setStatus(`✓ Server "${name}" added successfully`);
      resetForm();
    }
    setTimeout(() => setStatus(''), 4000);
  };

  const handleCheck = async (server: ServerConfig) => {
    setStatus('Checking server...');
    try {
      const testClient = await getOrCreateClient(server);
      await testClient.listTools();
      updateServer(server.id, { ready: true });
      setStatus('Server ready.');
    } catch (error) {
      updateServer(server.id, { ready: false });
      setStatus(`Check failed: ${String(error)}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>MCP Servers</Text>

      {/* Configured Servers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configured Servers</Text>
        {servers.length === 0 ? (
          <Text style={styles.emptyText}>No servers configured</Text>
        ) : (
          servers.map((server) => (
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
          ))
        )}
      </View>

      {/* Add/Edit Server Form */}
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
        {status ? (
          <View style={status.includes('✓') ? styles.successBox : styles.errorBox}>
            <Text style={status.includes('✓') ? styles.successText : styles.errorText}>
              {status}
            </Text>
          </View>
        ) : null}
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
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
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
  successBox: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  successText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
  },
});
