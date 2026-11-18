import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Sparkles, X, Send } from 'lucide-react-native';
import { colors, fonts, radius, shadow } from '../theme';
import { GlassCard, PressableScale, FadeIn } from '../ui';

const GROQ_API_KEY = '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';

interface AIAssistantModalProps {
  visible: boolean;
  onClose: () => void;
  user: any;
}

export default function AIAssistantModal({ visible, onClose, user }: AIAssistantModalProps) {
  const [messages, setMessages] = useState<{role: 'user'|'assistant', content: string}[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible && messages.length === 0) {
      setMessages([
        { role: 'assistant', content: `Bonjour ${user?.name || ''} ! Je suis l'assistant intelligent de L'Oréal Capitol. Comment puis-je vous aider avec l'application aujourd'hui ?` }
      ]);
    }
  }, [visible]);

  const getSystemPrompt = () => {
    return `Tu es l'assistant virtuel officiel de l'application de gestion de stock et caisse "L'Oréal Capitol".
L'utilisateur actuel est : ${user?.name} (Rôle: ${user?.role}, Magasin: ${user?.store}).
Ton rôle est d'aider cet utilisateur à comprendre et utiliser l'application.

RÈGLES STRICTES DE SÉCURITÉ ET DE COMPORTEMENT :
1. Tu ne dois répondre QU'AUX questions concernant l'application L'Oréal Capitol. Si l'utilisateur pose une question hors sujet (météo, code, blagues, etc.), refuse poliment de répondre en précisant ton rôle.
2. Si l'utilisateur a le rôle "caissiere" ou "employe", tu ne dois donner AUCUNE information concernant le rôle du Boss ou des Administrateurs (ex: comment supprimer une vente, comment voir le chiffre d'affaires global, ajouter des utilisateurs). Dis-lui que c'est confidentiel ou réservé à l'administration.
3. Si l'utilisateur a le rôle "admin", il gère un magasin spécifique. Il ne peut pas voir les données des autres magasins.
4. Reste professionnel, concis et très utile. Parle en français. Ne propose pas de code de programmation.`;
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    const newMsg = { role: 'user' as const, content: inputText.trim() };
    const currentMessages = [...messages, newMsg];
    setMessages(currentMessages);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'groq/compound-mini',
          messages: [
            { role: 'system', content: getSystemPrompt() },
            ...currentMessages
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      });

      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        setMessages([...currentMessages, { role: 'assistant', content: data.choices[0].message.content }]);
      } else {
        setMessages([...currentMessages, { role: 'assistant', content: "Désolé, je n'ai pas pu générer une réponse." }]);
      }
    } catch (error) {
      console.error('Erreur API Groq:', error);
      setMessages([...currentMessages, { role: 'assistant', content: "Erreur de connexion avec le serveur IA. Veuillez réessayer plus tard." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <GlassCard style={styles.modalCard} glow="gold">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.sparkleIconBadge}>
                <Sparkles color={colors.gold} size={16} />
              </View>
              <View>
                <Text style={styles.eyebrow}>ASSISTANCE VIRTUELLE</Text>
                <Text style={styles.title}>Assistant Capitol IA</Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color={colors.textSecondary} size={18} />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView 
            ref={scrollViewRef}
            style={styles.chatArea} 
            contentContainerStyle={styles.chatContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg, idx) => (
              <FadeIn key={idx}>
                <View style={[styles.bubbleWrapper, msg.role === 'user' ? styles.bubbleWrapperUser : styles.bubbleWrapperBot]}>
                  {msg.role === 'assistant' && (
                    <View style={styles.botMiniAvatar}>
                      <Sparkles color={colors.gold} size={12} />
                    </View>
                  )}
                  <View style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.botBubble]}>
                    <Text style={[styles.messageText, msg.role === 'user' ? styles.userText : styles.botText]}>
                      {msg.content}
                    </Text>
                  </View>
                </View>
              </FadeIn>
            ))}

            {isLoading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.gold} />
                <Text style={styles.loadingText}>L'assistant réfléchit...</Text>
              </View>
            )}
          </ScrollView>

          {/* Input Area */}
          <View style={styles.inputArea}>
            <TextInput
              style={styles.input}
              placeholder="Posez une question sur l'application..."
              placeholderTextColor={colors.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity 
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]} 
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
            >
              <Send color="#07070A" size={16} />
            </TouchableOpacity>
          </View>
        </GlassCard>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    height: 580,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sparkleIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.gold,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.serif,
  },
  closeBtn: {
    padding: 6,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    gap: 12,
  },
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  bubbleWrapperUser: {
    justifyContent: 'flex-end',
  },
  bubbleWrapperBot: {
    justifyContent: 'flex-start',
  },
  botMiniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  botBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  userBubble: {
    backgroundColor: colors.gold,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.sans,
  },
  botText: {
    color: colors.textPrimary,
  },
  userText: {
    color: '#07070A',
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  loadingText: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: fonts.sans,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: colors.textPrimary,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    height: 42,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontFamily: fonts.sans,
  },
  sendBtn: {
    backgroundColor: colors.gold,
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.glowGold,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
