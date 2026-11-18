import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, StyleSheet } from 'react-native';
import { Trash2, Edit3, Eye, EyeOff } from 'lucide-react-native';
import { isUserAdmin } from '../../db/database';
import { sharedStyles } from './dashboardStyles';

export interface UserManagementModalProps {
  editingUser: any;
  showUserPasswords: boolean;
  setShowUserPasswords: React.Dispatch<React.SetStateAction<boolean>>;
  systemUsers: any[];
  handleDeleteUser: (id: string, name: string) => Promise<void>;
  userModalVisible: boolean;
  setUserModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  newUserName: string;
  setNewUserName: React.Dispatch<React.SetStateAction<string>>;
  newUserRole: string;
  setNewUserRole: React.Dispatch<React.SetStateAction<string>>;
  newUserStore: string;
  setNewUserStore: React.Dispatch<React.SetStateAction<string>>;
  newUserPin: string;
  setNewUserPin: React.Dispatch<React.SetStateAction<string>>;
  startEditUser: (u: any) => void;
  cancelEditUser: () => void;
  handleSaveUser: () => Promise<void>;
}

/** Modale de gestion des profils et mots de passe. */
export default function UserManagementModal({
  editingUser,
  showUserPasswords,
  setShowUserPasswords,
  systemUsers,
  handleDeleteUser,
  userModalVisible,
  setUserModalVisible,
  newUserName,
  setNewUserName,
  newUserRole,
  setNewUserRole,
  newUserStore,
  setNewUserStore,
  newUserPin,
  setNewUserPin,
  startEditUser,
  cancelEditUser,
  handleSaveUser,
}: UserManagementModalProps) {
  return (
    <Modal visible={userModalVisible} animationType="slide" transparent={true}>
      <View style={sharedStyles.modalOverlay}>
        <View style={[sharedStyles.modalContent, { maxHeight: '90%' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <Text style={sharedStyles.modalTitle}>Gestion des Profils & Accès</Text>
            <TouchableOpacity onPress={() => { cancelEditUser(); setUserModalVisible(false); }}>
              <Text style={{ color: '#fff', fontSize: 18, padding: 5 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Toggle Afficher / Masquer mots de passe */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: '#aaa', fontSize: 13 }}>Équipe enregistrée ({systemUsers.length})</Text>
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2a2a2a', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
              onPress={() => setShowUserPasswords(!showUserPasswords)}
            >
              {showUserPasswords ? <EyeOff color="#d4af37" size={16} /> : <Eye color="#d4af37" size={16} />}
              <Text style={{ color: '#d4af37', fontSize: 12, fontWeight: '600' }}>
                {showUserPasswords ? 'Masquer codes' : 'Voir codes/PIN'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 220, marginBottom: 15 }}>
            {systemUsers.map(u => (
              <View key={u.id} style={[styles.userItem, editingUser?.id === u.id && { borderColor: '#d4af37', borderWidth: 1 }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{u.name}</Text>
                    <View style={[styles.roleBadge, isUserAdmin(u) ? styles.roleBadgeAdmin : styles.roleBadgeStaff]}>
                      <Text style={styles.roleBadgeText}>
                        {isUserAdmin(u) ? '👑 Admin' : u.role === 'employe' ? 'Employé' : 'Caissière'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: '#aaa', fontSize: 12, marginTop: 3 }}>
                    Magasin: <Text style={{ color: '#d4af37' }}>{u.store === 'all' ? 'Tous les magasins' : u.store === 'tougou' ? 'Tougou' : 'La Falaise'}</Text>
                    {'  '}| Code/PIN: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{showUserPasswords ? (u.pin || 'Non défini') : '••••••••'}</Text>
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => startEditUser(u)} style={{ padding: 6, backgroundColor: '#333', borderRadius: 6 }}>
                    <Edit3 color="#d4af37" size={16} />
                  </TouchableOpacity>
                  {u.id !== 'boss' && u.name?.toLowerCase() !== 'boss' && (
                    <TouchableOpacity onPress={() => handleDeleteUser(u.id, u.name)} style={{ padding: 6, backgroundColor: '#3a1a1a', borderRadius: 6 }}>
                      <Trash2 color="#ff4444" size={16} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={{ height: 1, backgroundColor: '#333', marginBottom: 15 }} />

          <ScrollView style={{ maxHeight: 320 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: '#d4af37', fontWeight: 'bold', fontSize: 15 }}>
                {editingUser ? `✏️ Modifier : ${editingUser.name}` : '➕ Créer un nouveau profil'}
              </Text>
              {editingUser && (
                <TouchableOpacity onPress={cancelEditUser}>
                  <Text style={{ color: '#ff4444', fontSize: 12 }}>Annuler modif</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={sharedStyles.fieldLabel}>Nom complet</Text>
            <TextInput 
              style={sharedStyles.input} 
              placeholder="Ex: Jean Dupont" 
              placeholderTextColor="#666" 
              value={newUserName} 
              onChangeText={setNewUserName} 
            />

            <Text style={sharedStyles.fieldLabel}>Mot de passe / Code PIN (8 caractères)</Text>
            <TextInput 
              style={sharedStyles.input} 
              placeholder="Ex: B000000. (Majuscule, chiffres, point)" 
              placeholderTextColor="#666" 
              value={newUserPin} 
              onChangeText={setNewUserPin} 
              secureTextEntry={!showUserPasswords}
              autoCapitalize="none"
            />

            <Text style={sharedStyles.fieldLabel}>Magasin Assigné</Text>
            <View style={styles.pickerContainer}>
              {[
                { id: 'falaise', label: 'La Falaise' },
                { id: 'tougou', label: 'Tougou' },
                { id: 'all', label: 'Tous les magasins' }
              ].map(s => (
                <TouchableOpacity key={s.id} style={[styles.pickerItem, newUserStore === s.id && styles.pickerItemActive]} onPress={() => setNewUserStore(s.id)}>
                  <Text style={[styles.pickerItemText, newUserStore === s.id && styles.pickerItemTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={sharedStyles.fieldLabel}>Rôle de l'utilisateur</Text>
            <View style={styles.pickerContainer}>
              {[
                { id: 'caissiere', label: 'Caissière (+Stock)' },
                { id: 'employe', label: 'Employé (Caisse info)' },
                { id: 'admin', label: 'Administrateur / Boss' }
              ].map(r => (
                <TouchableOpacity key={r.id} style={[styles.pickerItem, newUserRole === r.id && styles.pickerItemActive]} onPress={() => setNewUserRole(r.id)}>
                  <Text style={[styles.pickerItemText, newUserRole === r.id && styles.pickerItemTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={sharedStyles.cancelBtn} 
              onPress={() => { cancelEditUser(); setUserModalVisible(false); }}
            >
              <Text style={sharedStyles.cancelBtnText}>Fermer</Text>
            </TouchableOpacity>

            <TouchableOpacity style={sharedStyles.saveBtn} onPress={handleSaveUser}>
              <Text style={sharedStyles.saveBtnText}>
                {editingUser ? 'Enregistrer' : 'Créer profil'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  userItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#2a2a2a', borderRadius: 8, marginBottom: 8 },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  pickerItem: { backgroundColor: '#333', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#444' },
  pickerItemActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
  pickerItemText: { color: '#ccc', fontSize: 13 },
  pickerItemTextActive: { color: '#121212', fontWeight: 'bold' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  // Role Badges
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeAdmin: {
    backgroundColor: '#4a3b10',
    borderWidth: 1,
    borderColor: '#d4af37',
  },
  roleBadgeStaff: {
    backgroundColor: '#2a3a4a',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
