import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View as RNView } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import { useMcp } from '@/components/McpContext';

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

export default function ApiKeysScreen() {
  const {
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

  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState('');

  const handleSaveKeys = () => {
    const hasKey = provider === 'openai' ? openaiKey : anthropicKey;
    if (hasKey) {
      setKeyStatus(`✓ ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key saved successfully`);
    } else {
      setKeyStatus('Please enter an API key first');
    }
    setTimeout(() => setKeyStatus(''), 4000);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>API Keys</Text>
      <Text style={styles.helperText}>Keys are kept in memory only. Nothing is saved.</Text>

      <View style={styles.section}>
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
            <RNView style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={openaiKey}
                onChangeText={setOpenaiKey}
                placeholder="sk-..."
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showOpenaiKey}
                textContentType="none"
                autoComplete="off"
                editable={true}
                selectTextOnFocus={false}
                keyboardType="default"
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowOpenaiKey(!showOpenaiKey)}>
                <FontAwesome name={showOpenaiKey ? 'eye' : 'eye-slash'} size={18} color="#6b7280" />
              </Pressable>
            </RNView>
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
            <RNView style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={anthropicKey}
                onChangeText={setAnthropicKey}
                placeholder="sk-ant-..."
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showAnthropicKey}
                textContentType="none"
                autoComplete="off"
                editable={true}
                selectTextOnFocus={false}
                keyboardType="default"
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowAnthropicKey(!showAnthropicKey)}>
                <FontAwesome name={showAnthropicKey ? 'eye' : 'eye-slash'} size={18} color="#6b7280" />
              </Pressable>
            </RNView>
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
        {keyStatus ? (
          <View style={keyStatus.includes('✓') ? styles.successBox : styles.errorBox}>
            <Text style={keyStatus.includes('✓') ? styles.successText : styles.errorText}>
              {keyStatus}
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
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: -10,
  },
  section: {
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 40,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
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
