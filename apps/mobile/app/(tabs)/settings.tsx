import React from 'react';
import { Pressable, ScrollView, StyleSheet, View as RNView } from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import { useMcp } from '@/components/McpContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { servers, openaiKey, anthropicKey, provider } = useMcp();

  const hasApiKey = provider === 'openai' ? Boolean(openaiKey) : Boolean(anthropicKey);
  const serverCount = servers.length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Configure your API keys and MCP servers</Text>

      <View style={styles.section}>
        <Pressable style={styles.actionCard} onPress={() => router.push('/(tabs)/api-keys')}>
          <RNView style={styles.actionCardContent}>
            <RNView style={styles.actionCardLeft}>
              <FontAwesome name="key" size={24} color="#111827" />
              <RNView style={styles.actionCardText}>
                <Text style={styles.actionCardTitle}>Add API Keys</Text>
                <Text style={styles.actionCardDescription}>
                  Configure OpenAI and Anthropic API keys for chat
                </Text>
                {hasApiKey && (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>
                      ✓ {provider === 'openai' ? 'OpenAI' : 'Anthropic'} key configured
                    </Text>
                  </View>
                )}
              </RNView>
            </RNView>
            <FontAwesome name="chevron-right" size={20} color="#6b7280" />
          </RNView>
        </Pressable>

        <Pressable style={styles.actionCard} onPress={() => router.push('/(tabs)/add-server')}>
          <RNView style={styles.actionCardContent}>
            <RNView style={styles.actionCardLeft}>
              <FontAwesome name="server" size={24} color="#111827" />
              <RNView style={styles.actionCardText}>
                <Text style={styles.actionCardTitle}>Add MCP Server</Text>
                <Text style={styles.actionCardDescription}>
                  Configure and manage MCP servers for tools
                </Text>
                {serverCount > 0 && (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>
                      ✓ {serverCount} server{serverCount !== 1 ? 's' : ''} configured
                    </Text>
                  </View>
                )}
              </RNView>
            </RNView>
            <FontAwesome name="chevron-right" size={20} color="#6b7280" />
          </RNView>
        </Pressable>
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
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: -10,
  },
  section: {
    gap: 16,
  },
  actionCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 16,
  },
  actionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  actionCardText: {
    flex: 1,
    gap: 4,
  },
  actionCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  actionCardDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusBadge: {
    backgroundColor: '#d1fae5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
});
