import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  EmployeeProfile,
  InventoryItem,
  Vehicle,
  VehicleInventoryItem,
  VehicleReport,
  VehicleReportType,
} from '../types';
import {
  fetchAssignedVehicle,
  fetchAvailableStock,
  fetchVehicleInventory,
  fetchVehicleReports,
  loadItemToVehicleMobile,
  returnItemFromVehicleMobile,
  submitVehicleReport,
  supabase,
} from '../lib/supabase';
import { uploadImageToCloudinary } from '../services/cloudinary';

interface VehicleScreenProps {
  employee: EmployeeProfile;
  theme: 'light' | 'dark';
}

export function VehicleScreen({ employee, theme }: VehicleScreenProps) {
  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#0B132B' : '#F3F4F6',
    card: isDark ? '#1C2541' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#111827',
    textMuted: isDark ? '#94A3B8' : '#64748B',
    border: isDark ? '#2D3748' : '#E2E8F0',
    primary: '#2563EB',
    primarySubtle: isDark ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.08)',
    success: '#10B981',
    successSubtle: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)',
    warning: '#F59E0B',
    warningSubtle: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.08)',
    danger: '#EF4444',
    dangerSubtle: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)',
  };

  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [inventory, setInventory] = useState<VehicleInventoryItem[]>([]);
  const [reports, setReports] = useState<VehicleReport[]>([]);
  const [availableStock, setAvailableStock] = useState<InventoryItem[]>([]);
  const [activeSection, setActiveSection] = useState<'inventario' | 'reports'>('inventario');

  // Modais
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<InventoryItem | null>(null);
  const [loadQuantity, setLoadQuantity] = useState('1');
  const [loadingAction, setLoadingAction] = useState(false);

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedVehicleItem, setSelectedVehicleItem] = useState<VehicleInventoryItem | null>(null);
  const [returnQuantity, setReturnQuantity] = useState('1');

  // Modal Novo Report
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<VehicleReportType>('anomalia');
  const [reportDescription, setReportDescription] = useState('');
  const [reportKm, setReportKm] = useState('');
  const [reportPhotos, setReportPhotos] = useState<string[]>([]);
  const [uploadingReport, setUploadingReport] = useState(false);

  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Busca a carrinha do funcionário (por id ou nome)
      let veh = await fetchAssignedVehicle(employee.id, employee.full_name);

      // Se ainda não estiver explicitamente associado no Supabase, tenta buscar a primeira carrinha ativa
      if (!veh && supabase) {
        try {
          const { data } = await supabase.from('vehicles').select('*').limit(1);
          if (data && data.length > 0) veh = data[0] as Vehicle;
        } catch {}
      }

      setVehicle(veh);

      if (veh) {
        const [invData, repData, stockData] = await Promise.all([
          fetchVehicleInventory(veh.id),
          fetchVehicleReports(veh.id),
          fetchAvailableStock(employee.company_id || undefined),
        ]);
        setInventory(invData);
        setReports(repData);
        setAvailableStock(stockData);
        setReportKm(veh.current_km ? String(veh.current_km) : '');
      }
    } catch (err) {
      console.warn('Erro ao carregar dados da carrinha:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [employee.id]);

  // Carregar item do estoque central
  const handleConfirmLoadItem = async () => {
    if (!vehicle || !selectedStockItem) return;
    const qty = parseInt(loadQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Aviso', 'Informe uma quantidade válida.');
      return;
    }
    if (qty > selectedStockItem.available_quantity) {
      Alert.alert('Estoque Insuficiente', `Disponível no estoque central: ${selectedStockItem.available_quantity} un.`);
      return;
    }

    setLoadingAction(true);
    try {
      await loadItemToVehicleMobile(
        vehicle.id,
        vehicle.license_plate,
        selectedStockItem.id,
        qty,
        employee.full_name,
        employee.id,
        employee.company_id || undefined
      );

      setLoadModalOpen(false);
      setSelectedStockItem(null);
      setLoadQuantity('1');
      await loadData();
      Alert.alert('Sucesso', `${qty} un. de ${selectedStockItem.name} carregadas na carrinha!`);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao carregar item.');
    } finally {
      setLoadingAction(false);
    }
  };

  // Devolver item para o estoque central
  const handleConfirmReturnItem = async () => {
    if (!vehicle || !selectedVehicleItem) return;
    const qty = parseInt(returnQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Aviso', 'Informe uma quantidade válida.');
      return;
    }
    if (qty > selectedVehicleItem.quantity) {
      Alert.alert('Quantidade Inválida', `Na carrinha só existem ${selectedVehicleItem.quantity} un.`);
      return;
    }

    setLoadingAction(true);
    try {
      await returnItemFromVehicleMobile(
        vehicle.id,
        vehicle.license_plate,
        selectedVehicleItem.item_id,
        qty,
        employee.full_name,
        employee.id,
        employee.company_id || undefined
      );

      setReturnModalOpen(false);
      setSelectedVehicleItem(null);
      setReturnQuantity('1');
      await loadData();
      Alert.alert('Sucesso', `${qty} un. devolvidas ao estoque central!`);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao devolver item.');
    } finally {
      setLoadingAction(false);
    }
  };

  // Tirar foto para o report
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão', 'Permissão da câmara é necessária para fotografar.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setReportPhotos((prev) => [...prev, uri]);
      }
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao tirar foto.');
    }
  };

  // Escolher foto da galeria
  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão', 'Permissão da galeria necessária.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uris = result.assets.map((a) => (a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri));
        setReportPhotos((prev) => [...prev, ...uris]);
      }
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao selecionar fotos.');
    }
  };

  // Submeter report
  const handleSubmitReport = async () => {
    if (!vehicle) return;
    if (!reportDescription.trim()) {
      Alert.alert('Descrição Obrigatória', 'Por favor descreva o motivo ou situação do report.');
      return;
    }

    setUploadingReport(true);
    try {
      // Faz upload das fotos para o Cloudinary se houver conexão
      const uploadedUrls: string[] = [];
      for (const photo of reportPhotos) {
        try {
          const url = await uploadImageToCloudinary(photo, 'castello_vehicle_reports');
          uploadedUrls.push(url);
        } catch {
          uploadedUrls.push(photo);
        }
      }

      const kmNum = reportKm ? parseInt(reportKm, 10) : undefined;

      await submitVehicleReport({
        company_id: employee.company_id || null,
        vehicle_id: vehicle.id,
        vehicle_plate: vehicle.license_plate,
        employee_id: employee.id,
        employee_name: employee.full_name,
        report_type: reportType,
        description: reportDescription.trim(),
        current_km: kmNum || null,
        photos: uploadedUrls,
      });

      setReportModalOpen(false);
      setReportDescription('');
      setReportPhotos([]);
      await loadData();
      Alert.alert('Report Enviado', 'O seu relatório foi enviado para a gerência da firma com sucesso!');
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao submeter report.');
    } finally {
      setUploadingReport(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          A carregar dados da carrinha...
        </Text>
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg, padding: 24 }]}>
        <Ionicons name="car-outline" size={64} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Sem Carrinha Atribuída</Text>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          O seu perfil não possui uma carrinha atribuída no momento. Caso seja motorista ou responsável por um veículo, solicite a alocação à gerência.
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 20 }]}
          onPress={loadData}
        >
          <Ionicons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.primaryButtonText}>Verificar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Cabeçalho do Veículo */}
      <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {vehicle.photo_url ? (
          <Image
            source={{ uri: vehicle.photo_url }}
            style={{
              width: '100%',
              height: 140,
              borderRadius: 8,
              marginBottom: 12,
              backgroundColor: colors.border,
            }}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.headerTop}>
          <View style={styles.plateContainer}>
            <Text style={[styles.plateText, { color: colors.text }]}>{vehicle.license_plate}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  vehicle.status === 'em_servico'
                    ? colors.successSubtle
                    : vehicle.status === 'em_manutencao'
                    ? colors.warningSubtle
                    : colors.primarySubtle,
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    vehicle.status === 'em_servico'
                      ? colors.success
                      : vehicle.status === 'em_manutencao'
                      ? colors.warning
                      : colors.primary,
                },
              ]}
            >
              {vehicle.status === 'em_servico'
                ? 'EM SERVIÇO'
                : vehicle.status === 'em_manutencao'
                ? 'NA OFICINA'
                : 'PARADA'}
            </Text>
          </View>
        </View>

        <Text style={[styles.vehicleModel, { color: colors.text }]}>
          {vehicle.brand} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}
        </Text>

        <View style={styles.infoRow}>
          <View style={styles.infoCol}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>KM Atual</Text>
            <Text style={[styles.infoValue, { color: colors.primary }]}>
              {vehicle.current_km.toLocaleString('pt-PT')} km
            </Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Combustível</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {vehicle.fuel_type || 'Diesel'}
            </Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Itens a Bordo</Text>
            <Text style={[styles.infoValue, { color: colors.success }]}>
              {inventory.reduce((acc, curr) => acc + curr.quantity, 0)} un.
            </Text>
          </View>
        </View>
      </View>

      {/* Navegação entre Seções */}
      <View style={[styles.tabSelector, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeSection === 'inventario' && {
              backgroundColor: colors.primary,
            },
          ]}
          onPress={() => setActiveSection('inventario')}
        >
          <Ionicons
            name="cube"
            size={16}
            color={activeSection === 'inventario' ? '#FFFFFF' : colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabButtonText,
              { color: activeSection === 'inventario' ? '#FFFFFF' : colors.textMuted },
            ]}
          >
            Inventário ({inventory.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeSection === 'reports' && {
              backgroundColor: colors.primary,
            },
          ]}
          onPress={() => setActiveSection('reports')}
        >
          <Ionicons
            name="document-text"
            size={16}
            color={activeSection === 'reports' ? '#FFFFFF' : colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabButtonText,
              { color: activeSection === 'reports' ? '#FFFFFF' : colors.textMuted },
            ]}
          >
            Reports ({reports.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ================================================================== */}
      {/* SEÇÃO 1: INVENTÁRIO DA CARRINHA                                     */}
      {/* ================================================================== */}
      {activeSection === 'inventario' && (
        <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Materiais & Ferramentas a Bordo
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => setLoadModalOpen(true)}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.actionButtonText}>Adicionar do Estoque</Text>
            </TouchableOpacity>
          </View>

          {inventory.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="cube-outline" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyBoxText, { color: colors.textMuted }]}>
                Nenhum item carregado nesta carrinha. Toque em "Adicionar do Estoque" acima para carregar ferramentas ou materiais.
              </Text>
            </View>
          ) : (
            inventory.map((item) => (
              <View
                key={item.id}
                style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.itemName, { color: colors.text }]}>{item.item_name}</Text>
                  <Text style={[styles.itemCategory, { color: colors.textMuted }]}>
                    {item.category} {item.serial_number ? `• S/N: ${item.serial_number}` : ''}
                  </Text>
                  <View style={styles.qtyBadgeRow}>
                    <View style={[styles.qtyBadge, { backgroundColor: colors.primarySubtle }]}>
                      <Text style={[styles.qtyBadgeText, { color: colors.primary }]}>
                        {item.quantity} unidades
                      </Text>
                    </View>
                    <View style={[styles.conditionBadge, { backgroundColor: colors.successSubtle }]}>
                      <Text style={[styles.conditionText, { color: colors.success }]}>
                        {item.condition || 'Bom'}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.returnButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setSelectedVehicleItem(item);
                    setReturnQuantity(String(item.quantity));
                    setReturnModalOpen(true);
                  }}
                >
                  <Ionicons name="return-up-back" size={16} color={colors.warning} />
                  <Text style={[styles.returnButtonText, { color: colors.warning }]}>Devolver</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ================================================================== */}
      {/* SEÇÃO 2: REPORTS DA CARRINHA                                       */}
      {/* ================================================================== */}
      {activeSection === 'reports' && (
        <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Histórico de Relatórios</Text>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setReportDescription('');
                setReportPhotos([]);
                setReportKm(vehicle.current_km ? String(vehicle.current_km) : '');
                setReportModalOpen(true);
              }}
            >
              <Ionicons name="create-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.actionButtonText}>Novo Report</Text>
            </TouchableOpacity>
          </View>

          {reports.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="document-text-outline" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyBoxText, { color: colors.textMuted }]}>
                Nenhum relatório de anomalia, abastecimento ou limpeza enviado até o momento.
              </Text>
            </View>
          ) : (
            reports.map((rep) => (
              <View
                key={rep.id}
                style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.reportHeader}>
                  <View style={[styles.reportBadge, { backgroundColor: colors.primarySubtle }]}>
                    <Text style={[styles.reportBadgeText, { color: colors.primary }]}>
                      {rep.report_type.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.reportDate, { color: colors.textMuted }]}>
                    {new Date(rep.created_at).toLocaleDateString('pt-PT')}
                  </Text>
                </View>

                <Text style={[styles.reportDesc, { color: colors.text }]}>{rep.description}</Text>

                {rep.current_km ? (
                  <Text style={[styles.reportKmText, { color: colors.textMuted }]}>
                    Quilometragem informada: <Text style={{ color: colors.text, fontWeight: '700' }}>{rep.current_km.toLocaleString('pt-PT')} km</Text>
                  </Text>
                ) : null}

                {rep.photos && rep.photos.length > 0 && (
                  <View style={styles.photosGrid}>
                    {rep.photos.map((uri, idx) => (
                      <TouchableOpacity key={idx} onPress={() => setPreviewPhoto(uri)}>
                        <Image source={{ uri }} style={styles.reportThumb} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ================================================================== */}
      {/* MODAL 1: CARREGAR ITEM DO ESTOQUE CENTRAL                          */}
      {/* ================================================================== */}
      <Modal visible={loadModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Carregar do Estoque Central</Text>
              <TouchableOpacity onPress={() => setLoadModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: colors.textMuted }]}>
              Selecione um item disponível no armazém da firma para colocar na carrinha {vehicle.license_plate}:
            </Text>

            <ScrollView style={{ maxHeight: 220, marginBottom: 12 }}>
              {availableStock
                .filter((item) => item.available_quantity > 0)
                .map((item) => {
                  const isSelected = selectedStockItem?.id === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.stockSelectRow,
                        {
                          backgroundColor: isSelected ? colors.primarySubtle : colors.bg,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedStockItem(item)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.stockItemName, { color: colors.text }]}>{item.name}</Text>
                        <Text style={[styles.stockItemCat, { color: colors.textMuted }]}>{item.category}</Text>
                      </View>
                      <Text style={[styles.stockQty, { color: colors.primary }]}>
                        {item.available_quantity} disp.
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            {selectedStockItem && (
              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  Quantidade a Carregar (Max: {selectedStockItem.available_quantity})
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
                  keyboardType="numeric"
                  value={loadQuantity}
                  onChangeText={setLoadQuantity}
                />
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setLoadModalOpen(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={!selectedStockItem || loadingAction}
                style={[
                  styles.confirmBtn,
                  { backgroundColor: selectedStockItem ? colors.primary : colors.border },
                ]}
                onPress={handleConfirmLoadItem}
              >
                {loadingAction ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================== */}
      {/* MODAL 2: DEVOLVER ITEM AO ESTOQUE CENTRAL                          */}
      {/* ================================================================== */}
      <Modal visible={returnModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Devolver ao Estoque Central</Text>
              <TouchableOpacity onPress={() => setReturnModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedVehicleItem && (
              <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                Devolver <Text style={{ color: colors.text, fontWeight: '700' }}>{selectedVehicleItem.item_name}</Text> da carrinha para o estoque da empresa.
              </Text>
            )}

            {selectedVehicleItem && (
              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  Quantidade a Devolver (Presente: {selectedVehicleItem.quantity} un.)
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
                  keyboardType="numeric"
                  value={returnQuantity}
                  onChangeText={setReturnQuantity}
                />
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setReturnModalOpen(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={loadingAction}
                style={[styles.confirmBtn, { backgroundColor: colors.warning }]}
                onPress={handleConfirmReturnItem}
              >
                {loadingAction ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Devolver Item</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================== */}
      {/* MODAL 3: NOVO REPORT DA CARRINHA                                    */}
      {/* ================================================================== */}
      <Modal visible={reportModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Novo Report da Carrinha</Text>
              <TouchableOpacity onPress={() => setReportModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Tipo de Relatório</Text>
              <View style={styles.typeSelectorGrid}>
                {[
                  { key: 'anomalia', label: 'Avaria / Anomalia' },
                  { key: 'abastecimento', label: 'Abastecimento' },
                  { key: 'limpeza', label: 'Limpeza / Lavagem' },
                  { key: 'km', label: 'Atualizar KM' },
                  { key: 'geral', label: 'Geral' },
                ].map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[
                      styles.typePill,
                      {
                        backgroundColor: reportType === t.key ? colors.primary : colors.bg,
                        borderColor: reportType === t.key ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setReportType(t.key as VehicleReportType)}
                  >
                    <Text
                      style={[
                        styles.typePillText,
                        { color: reportType === t.key ? '#FFFFFF' : colors.textMuted },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>KM Atual no Odómetro</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
                  keyboardType="numeric"
                  placeholder="Ex: 142500"
                  placeholderTextColor={colors.textMuted}
                  value={reportKm}
                  onChangeText={setReportKm}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Descrição / Observações *</Text>
                <TextInput
                  style={[
                    styles.textArea,
                    { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border },
                  ]}
                  multiline
                  numberOfLines={4}
                  placeholder="Explique o que aconteceu, nível de óleo, barulho anormal, fatura de combustível..."
                  placeholderTextColor={colors.textMuted}
                  value={reportDescription}
                  onChangeText={setReportDescription}
                />
              </View>

              <Text style={[styles.inputLabel, { color: colors.text, marginTop: 8 }]}>Fotos / Comprovativos</Text>
              <View style={styles.photoActionsRow}>
                <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.primarySubtle }]} onPress={handleTakePhoto}>
                  <Ionicons name="camera" size={18} color={colors.primary} />
                  <Text style={[styles.photoBtnText, { color: colors.primary }]}>Tirar Foto</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 }]} onPress={handlePickPhoto}>
                  <Ionicons name="images" size={18} color={colors.text} />
                  <Text style={[styles.photoBtnText, { color: colors.text }]}>Galeria</Text>
                </TouchableOpacity>
              </View>

              {reportPhotos.length > 0 && (
                <View style={styles.photosGrid}>
                  {reportPhotos.map((uri, idx) => (
                    <View key={idx} style={styles.thumbWrapper}>
                      <Image source={{ uri }} style={styles.reportThumb} />
                      <TouchableOpacity
                        style={styles.deletePhotoBadge}
                        onPress={() => setReportPhotos(reportPhotos.filter((_, i) => i !== idx))}
                      >
                        <Ionicons name="close" size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setReportModalOpen(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={uploadingReport}
                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleSubmitReport}
              >
                {uploadingReport ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Enviar Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================== */}
      {/* MODAL 4: AMPLIAÇÃO DE FOTO                                         */}
      {/* ================================================================== */}
      {previewPhoto && (
        <Modal visible={Boolean(previewPhoto)} transparent animationType="fade">
          <View style={styles.previewBackdrop}>
            <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setPreviewPhoto(null)}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Image source={{ uri: previewPhoto }} style={styles.fullPreviewImage} resizeMode="contain" />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  headerCard: {
    margin: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  plateContainer: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  plateText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 16,
    color: '#F8FAFC',
    letterSpacing: 1.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  vehicleModel: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 10,
  },
  infoRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  tabSelector: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  emptyBoxText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemCategory: {
    fontSize: 11,
    marginBottom: 6,
  },
  qtyBadgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  qtyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  qtyBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  conditionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  conditionText: {
    fontSize: 10,
    fontWeight: '700',
  },
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  returnButtonText: {
    fontSize: 11,
    fontWeight: '700',
  },
  reportCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reportBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reportBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  reportDate: {
    fontSize: 11,
  },
  reportDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  reportKmText: {
    fontSize: 11,
    marginBottom: 6,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  reportThumb: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  thumbWrapper: {
    position: 'relative',
  },
  deletePhotoBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  stockSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  stockItemName: {
    fontSize: 13,
    fontWeight: '700',
  },
  stockItemCat: {
    fontSize: 11,
  },
  stockQty: {
    fontSize: 12,
    fontWeight: '800',
  },
  formGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  typeSelectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  fullPreviewImage: {
    width: '90%',
    height: '80%',
  },
});

