import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { ArrowLeft, Send, Sparkles, Bot, User } from 'lucide-react-native';
import { logIntrusion, isUserAdmin } from '../db/database';
import { colors, fonts, radius, shadow } from '../theme';
import { useResponsive, GlassCard, TiltCard, GoldButton, PressableScale, Pill, FadeIn } from '../ui';

export default function HelpScreen({ navigation, route }: any) {
  const r = useResponsive();
  const user = route.params?.user;
  const userRole = user?.role || 'employe';

  const [messages, setMessages] = useState<{id: string, text: string, isBot: boolean}[]>([
    { id: '1', text: `Bonjour ${user?.name || ''} ! Je suis l'Assistant L'Oréal Capitol. Que puis-je faire pour vous aujourd'hui ?`, isBot: true }
  ]);
  const [inputText, setInputText] = useState('');
  const [violationCount, setViolationCount] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const getRoleQuestions = () => {
    if (isUserAdmin(user) || userRole === 'admin') {
      return ['Comment supprimer une vente ?', 'Gérer les vendeurs', 'Voir les alertes'];
    } else if (userRole === 'caissiere') {
      return ['Comment vendre ?', 'Gérer les arrivages', 'Faire une avance'];
    } else {
      return ['Comment vendre ?', 'Faire une avance'];
    }
  };

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    
    const newMsg = { id: Date.now().toString(), text, isBot: false };
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    const response = await generateResponse(text.toLowerCase());
    
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now().toString() + 'b', text: response, isBot: true }]);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, 500);
  };

  const generateResponse = async (input: string) => {
    const isBoss = isUserAdmin(user) || userRole === 'admin';
    const isCaissiere = userRole === 'caissiere';
    const text = input.toLowerCase();

    const asksDelete = text.includes('supprim') || text.includes('efface') || text.includes('annul');
    const asksUserManagement = text.includes('vendeur') || text.includes('profil') || text.includes('utilisateur') || text.includes('employ');
    const asksStock = text.includes('stock') || text.includes('arrivage') || text.includes('inventaire') || text.includes('quantit');
    const asksSale = text.includes('vend') || text.includes('vente') || text.includes('caisse') || text.includes('facture');
    const asksAdvance = text.includes('avance') || text.includes('acompte') || text.includes('tranche') || text.includes('reste');
    const asksTransfer = text.includes('transfer') || text.includes('deplac') || text.includes('envoy');
    const asksDashboard = text.includes('dashboard') || text.includes('tableau') || text.includes('stat') || text.includes('hier') || text.includes('filtre') || text.includes('recherch');
    
    const isOutOfContext = !asksDelete && !asksUserManagement && !asksStock && !asksSale && !asksAdvance && !asksTransfer && !asksDashboard && !text.includes('bonjour') && !text.includes('salut') && !text.includes('merci');

    if (text.includes('merci')) return "Je vous en prie ! N'hésitez pas si vous avez d'autres questions.";
    if (text.includes('bonjour') || text.includes('salut')) return "Bonjour ! Comment puis-je vous aider avec l'application L'Oréal Capitol ?";

    if (isOutOfContext) {
      if (!isBoss) {
        const newCount = violationCount + 1;
        setViolationCount(newCount);
        if (newCount > 1) {
          try {
            await logIntrusion(user.name, { city: 'Chat', country: 'Chat', lat: 0, lon: 0 }, 'chat_violation');
          } catch (e) {}
        }
      }
      return `Désolé, je suis uniquement configuré pour la gestion de l'application L'Oréal Capitol.\n\nVoici ce que vous pouvez me demander :\n- ${getRoleQuestions().join('\n- ')}`;
    }

    if (asksTransfer) {
      return "Pour effectuer un transfert de stock vers une autre boutique, vous avez deux options depuis la Caisse ou le Tableau de Bord :\n1. Transfert par Scan : Utilisez l'appareil photo pour scanner le code-barres.\n2. Transfert Manuel : Cherchez l'article par son nom pour voir sa couleur, taille et stock, puis sélectionnez la quantité à envoyer.";
    }

    if (asksDashboard) {
      if (!isBoss) return "Le Tableau de bord avec les statistiques est réservé à l'Administrateur.";
      return "Le Tableau de bord vous permet de :\n- Filtrer les ventes par 'Jour', 'Hier', 'Semaine', 'Mois', etc.\n- Rechercher une transaction spécifique grâce à la barre 'Rechercher par article...'\n- Suivre les alertes de stock et d'intrusion.";
    }

    if (asksDelete) {
      if (!isBoss) return "Seul l'Administrateur Général (Boss) peut supprimer une vente.";
      return "En tant qu'Admin, allez dans 'Historique & Suppression de Ventes' depuis le Tableau de Bord. Cherchez la transaction et confirmez la suppression.";
    }

    if (asksUserManagement) {
      if (!isBoss) return "La création ou suppression d'utilisateurs est réservée à l'Administrateur.";
      return "Sur la page d'accueil (Tableau de Bord), cliquez sur l'icône de profil en haut à droite. Vous pourrez y ajouter de nouvelles caissières ou modifier leurs accès.";
    }

    if (asksStock) {
      return "Pour gérer les arrivages, appuyez sur le bouton 'Arrivage'. Vous pourrez scanner ou chercher l'article et ajouter la nouvelle quantité. Vous pouvez aussi consulter l'état actuel de tous les articles depuis 'Gestion des Stocks'.";
    }

    if (asksAdvance) {
      return "Gestion des avances :\n1. Nouvelle Avance : En caisse, ajoutez les articles au panier, sélectionnez 'Avance', indiquez le nom du client et le montant du premier versement.\n2. Payer une tranche : Allez dans 'Avances', trouvez le client et cliquez sur 'Payer tranche'. L'historique des paiements précédents y est visible.";
    }

    if (asksSale) {
      return "Pour enregistrer une vente, allez dans la 'Caisse'. Vous pouvez scanner un article ou le chercher manuellement. Une fois dans le panier, validez en choisissant le mode de paiement (Espèces, OM, MoMo, Carte Bancaire).";
    }

    const asksMobile = text.includes('iphone') || text.includes('android') || text.includes('install') || text.includes('application') || text.includes('donnee') || text.includes('connexion');

    if (asksMobile) {
      return "Accès et installation Mobile (iPhone & Android) :\n\n• Sur iPhone (iOS) : Ouvrez le lien dans Safari, appuyez sur Partager puis sélectionnez 'Sur l'écran d'accueil'.\n• Sur Android : Ouvrez le lien dans Google Chrome, appuyez sur les 3 points et choisissez 'Ajouter à l'écran d'accueil'.\n\nL'application intègre un cache local intelligent pour fonctionner à haute vitesse même avec un réseau faible.";
    }

    return "Je n'ai pas bien compris. Pouvez-vous reformuler votre question concernant la caisse, les transferts, les stocks, l'installation mobile ou les avances ?";
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color={colors.textPrimary} size={20} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <View style={styles.sparkleRow}>
            <Sparkles color={colors.gold} size={14} style={{ marginRight: 5 }} />
            <Text style={styles.screenEyebrow}>ASSISTANCE CAPITOL</Text>
          </View>
          <Text style={styles.title}>Assistant Intelligent</Text>
        </View>

        <View style={styles.roleTag}>
          <Text style={styles.roleTagText}>
            {isUserAdmin(user) || userRole === 'admin' ? 'Boss' : userRole === 'caissiere' ? 'Caisse' : 'Vendeur'}
          </Text>
        </View>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={[styles.chatContent, r.isWide && styles.chatContentWide]}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((msg, index) => (
          <FadeIn key={msg.id} delay={index * 10}>
            <View style={[styles.bubbleWrapper, msg.isBot ? styles.bubbleWrapperBot : styles.bubbleWrapperUser]}>
              {msg.isBot && (
                <View style={styles.botAvatar}>
                  <Sparkles color={colors.gold} size={14} />
                </View>
              )}

              <View style={[styles.messageBubble, msg.isBot ? styles.botBubble : styles.userBubble]}>
                <Text style={[styles.messageText, msg.isBot ? styles.botText : styles.userText]}>
                  {msg.text}
                </Text>
              </View>
            </View>
          </FadeIn>
        ))}
      </ScrollView>

      {/* Input Area */}
      <View style={styles.inputArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsContainer}>
          {getRoleQuestions().map((q, i) => (
            <TouchableOpacity key={i} style={styles.suggestionBtn} onPress={() => handleSend(q)}>
              <Text style={styles.suggestionText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput 
            style={styles.input}
            placeholder="Posez votre question à l'assistant..."
            placeholderTextColor={colors.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSend(inputText)}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={() => handleSend(inputText)}>
            <Send color="#07070A" size={16} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.obsidian,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 20 : 48,
    paddingBottom: 14,
    backgroundColor: 'rgba(7, 7, 10, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  backBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  headerCenter: {
    alignItems: 'center',
  },
  sparkleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  screenEyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    color: colors.gold,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: fonts.serif,
  },
  roleTag: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  roleTagText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 30,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  chatContentWide: {
    paddingHorizontal: 28,
  },
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 14,
    gap: 8,
  },
  bubbleWrapperBot: {
    justifyContent: 'flex-start',
  },
  bubbleWrapperUser: {
    justifyContent: 'flex-end',
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  botBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  userBubble: {
    backgroundColor: colors.gold,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.sans,
  },
  botText: {
    color: colors.textPrimary,
  },
  userText: {
    color: '#07070A',
    fontWeight: '600',
  },
  inputArea: {
    backgroundColor: 'rgba(7, 7, 10, 0.95)',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'web' ? 16 : 28,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  suggestionsContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  suggestionBtn: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  suggestionText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: colors.textPrimary,
    borderRadius: radius.full,
    paddingHorizontal: 18,
    height: 44,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontFamily: fonts.sans,
  },
  sendBtn: {
    backgroundColor: colors.gold,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.glowGold,
  },
});
