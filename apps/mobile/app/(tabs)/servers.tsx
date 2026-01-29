import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View as RNView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { ServerConfig, useMcp } from '@/components/McpContext';

type ServerDetails = {
  tools: unknown[];
  prompts: unknown[];
  resources: unknown[];
  loading: boolean;
  error: string | null;
};

export default function ServersScreen() {
  const { servers, activeServerId, setActiveServerId, getOrCreateClient } = useMcp();
  const [serverDetails, setServerDetails] = useState<Record<string, ServerDetails>>({});

  const fetchServerDetails = async (server: ServerConfig) => {
    const serverId = server.id;
    setServerDetails((prev) => ({
      ...prev,
      [serverId]: { ...prev[serverId], loading: true, error: null },
    }));

    try {
      const client = await getOrCreateClient(server);

      const [toolsResult, promptsResult, resourcesResult] = await Promise.all([
        client.listTools().catch(() => ({ tools: [] })),
        client.request('prompts/list').catch(() => ({ prompts: [] })),
        client.request('resources/list').catch(() => ({ resources: [] })),
      ]);

      const tools = Array.isArray(toolsResult) ? toolsResult : (toolsResult as { tools?: unknown[] })?.tools ?? [];
      const prompts = Array.isArray(promptsResult) ? promptsResult : (promptsResult as { prompts?: unknown[] })?.prompts ?? [];
      const resources = Array.isArray(resourcesResult) ? resourcesResult : (resourcesResult as { resources?: unknown[] })?.resources ?? [];

      setServerDetails((prev) => ({
        ...prev,
        [serverId]: {
          tools: Array.isArray(tools) ? tools : [],
          prompts: Array.isArray(prompts) ? prompts : [],
          resources: Array.isArray(resources) ? resources : [],
          loading: false,
          error: null,
        },
      }));
    } catch (error) {
      setServerDetails((prev) => ({
        ...prev,
        [serverId]: {
          tools: [],
          prompts: [],
          resources: [],
          loading: false,
          error: String(error),
        },
      }));
    }
  };

  useEffect(() => {
    servers.forEach((server) => {
      if (!serverDetails[server.id]) {
        fetchServerDetails(server);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servers.length]);

  const renderItem = (title: string, items: unknown[]) => {
    if (items.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title} ({items.length})</Text>
        {items.map((item: any, idx: number) => {
          const name = item.name || item.title || `Item ${idx + 1}`;
          const description = item.description || '';
          return (
            <View key={idx} style={styles.itemCard}>
              <Text style={styles.itemName}>{name}</Text>
              {description ? <Text style={styles.itemDescription}>{description}</Text> : null}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>MCP Servers</Text>
      <Text style={styles.subtitle}>View tools, prompts, and resources for each server</Text>

      {servers.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No MCP servers configured</Text>
          <Text style={styles.emptySubtext}>Add servers in Settings</Text>
        </View>
      ) : (
        servers.map((server) => {
          const details = serverDetails[server.id];
          const isActive = server.id === activeServerId;

          return (
            <View key={server.id} style={[styles.serverCard, isActive && styles.serverCardActive]}>
              <RNView style={styles.serverHeader}>
                <RNView style={styles.serverHeaderLeft}>
                  <Text style={styles.serverName}>{server.name}</Text>
                  <Text style={styles.serverUrl}>
                    {server.serverUrl}
                    {server.endpoint}
                  </Text>
                </RNView>
                <RNView style={styles.serverHeaderRight}>
                  {isActive ? (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.useButton}
                      onPress={() => setActiveServerId(server.id)}>
                      <Text style={styles.useButtonText}>Use</Text>
                    </Pressable>
                  )}
                </RNView>
              </RNView>

              {details?.loading ? (
                <RNView style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#111827" />
                  <Text style={styles.loadingText}>Loading server details...</Text>
                </RNView>
              ) : details?.error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>Error: {details.error}</Text>
                  <Pressable style={styles.retryButton} onPress={() => fetchServerDetails(server)}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </Pressable>
                </View>
              ) : details ? (
                <RNView style={styles.detailsContainer}>
                  {renderItem('Tools', details.tools)}
                  {renderItem('Prompts', details.prompts)}
                  {renderItem('Resources', details.resources)}
                  {details.tools.length === 0 && details.prompts.length === 0 && details.resources.length === 0 && (
                    <Text style={styles.noDataText}>No tools, prompts, or resources available</Text>
                  )}
                </RNView>
              ) : (
                <Pressable style={styles.loadButton} onPress={() => fetchServerDetails(server)}>
                  <Text style={styles.loadButtonText}>Load Details</Text>
                </Pressable>
              )}
            </View>
          );
        })
      )}
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
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: -10,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
  serverCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    gap: 16,
    backgroundColor: '#fff',
  },
  serverCardActive: {
    borderColor: '#111827',
    borderWidth: 2,
  },
  serverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  serverHeaderLeft: {
    flex: 1,
    gap: 4,
  },
  serverHeaderRight: {
    marginLeft: 12,
  },
  serverName: {
    fontSize: 18,
    fontWeight: '700',
  },
  serverUrl: {
    fontSize: 12,
    color: '#6b7280',
  },
  activeBadge: {
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  useButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  useButtonText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  errorContainer: {
    padding: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsContainer: {
    gap: 16,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  noDataText: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 12,
  },
  loadButton: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  loadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
