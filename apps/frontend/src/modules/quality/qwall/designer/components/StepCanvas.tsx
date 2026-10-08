// @ts-nocheck
// Adaptación inicial desde qwall-designer. La integración con Q-Wall API se valida por separado.
import { useState, useEffect, useRef, useCallback } from 'react';
import client from '../designerApi';
import StepModal from './StepModal';

// Tamaño real de pbStepImage en mainForm.vb (SizeMode = Zoom)
const PB_WIDTH = 1080;
const PB_HEIGHT = 540;
const DEFAULT_BTN_WIDTH = 130;
const DEFAULT_BTN_HEIGHT = 28;

const DATA_BINDING_LABELS = {
  ssi_serial: 'SSI Serial',
  volvo_serial: 'Volvo Serial',
  volvo_pn: 'N° Parte Cliente',
  ssi_pn: 'N° Parte SSI',
  work_order: 'Orden de Trabajo',
  part_number: 'Part Number',
  operator_name: 'Operador',
  current_date: 'Fecha Actual',
  julian_code: 'Código Juliano',
  serial_digits: 'Dígitos del escaneo',
};

function StepCanvas() {
  const [businessUnits, setBusinessUnits] = useState([]);
  const [buId, setBuId] = useState(null);

  const [partNumbers, setPartNumbers] = useState([]); // from ssi_PartNumbers for the selected BU
  const [partNumber, setPartNumber] = useState('');

  const [modelSteps, setModelSteps] = useState([]); // designer steps (ssi_StepDesigner) for buId+partNumber
  const [currentStepId, setCurrentStepId] = useState(null);
  const [positions, setPositions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [inspectionPoints, setInspectionPoints] = useState([]);
  const [zoom, setZoom] = useState(100);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const imageRef = useRef(null);
  const dragState = useRef(null);
  const resizeState = useRef(null);
  const nextTempId = useRef(-1);
  const dragIndexRef = useRef(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [modalInitialData, setModalInitialData] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);

  // Crear modelo nuevo (ssi_PartNumbers)
  const [addingModel, setAddingModel] = useState(false);
  const [newModelSsiPN, setNewModelSsiPN] = useState('');
  const [newModelVolvoPN, setNewModelVolvoPN] = useState('');
  const [savingModel, setSavingModel] = useState(false);

  // Crear punto de inspección nuevo (ssi_InspectionPoints)
  const [addingPoint, setAddingPoint] = useState(false);
  const [newPointName, setNewPointName] = useState('');
  const [newPointStep, setNewPointStep] = useState(1);
  const [newPointCamera, setNewPointCamera] = useState(false);
  const [savingPoint, setSavingPoint] = useState(false);

  // Replicar step a otros modelos
  const [cloningOpen, setCloningOpen] = useState(false);
  const [cloneTargets, setCloneTargets] = useState([]);
  const [cloning, setCloning] = useState(false);

  // Load business units (clients) from ssi_BusinessUnits
  useEffect(() => {
    client.get('/business-units/').then(res => {
      setBusinessUnits(res.data);
      if (res.data.length > 0) setBuId(res.data[0].bu_id);
    });
  }, []);

  // Load part numbers (models) from ssi_PartNumbers for the selected client
  useEffect(() => {
    if (!buId) return;
    client.get('/part-numbers/', { params: { bu_id: buId } }).then(res => {
      setPartNumbers(res.data);
      setPartNumber(res.data.length > 0 ? res.data[0].ssiPN : '');
    });
  }, [buId]);

  // Load designer steps for the selected model (may be empty if nothing designed yet)
  useEffect(() => {
    if (!partNumber || !buId) {
      setModelSteps([]);
      setCurrentStepId(null);
      setPositions([]);
      return;
    }
    client.get('/steps/', { params: { bu_id: buId, part_number: partNumber } }).then(res => {
      const sorted = [...res.data].sort((a, b) => a.flow_order - b.flow_order);
      setModelSteps(sorted);
      setCurrentStepId(sorted.length > 0 ? sorted[0].step_id : null);
    });
  }, [partNumber, buId]);

  // Sync canvas positions with whichever step is currently selected
  useEffect(() => {
    const current = modelSteps.find(s => s.step_id === currentStepId);
    if (current) {
      setPositions(current.positions.map(p => ({ ...p, _localId: p.position_id })));
      setSelectedId(null);
      setDirty(false);
    } else {
      setPositions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepId]);

  // Load inspection points catalog (ssi_InspectionPoints) for the dropdown
  useEffect(() => {
    if (buId) {
      client.get('/inspection-points/', { params: { bu_id: buId } }).then(res => setInspectionPoints(res.data));
    }
  }, [buId]);

  const handleCreateModel = async () => {
    if (!newModelSsiPN.trim()) return;
    setSavingModel(true);
    try {
      const res = await client.post('/part-numbers/', {
        ssiPN: newModelSsiPN.trim(),
        volvoProductNumber: newModelVolvoPN.trim() || null,
        bu_id: buId,
      });
      setPartNumbers(prev => [...prev, res.data].sort((a, b) => a.ssiPN.localeCompare(b.ssiPN)));
      setPartNumber(res.data.ssiPN);
      setAddingModel(false);
      setNewModelSsiPN('');
      setNewModelVolvoPN('');
    } catch (err) {
      alert('No se pudo crear el modelo: ' + JSON.stringify(err.response?.data || err.message));
    } finally {
      setSavingModel(false);
    }
  };

  const handleCreatePoint = async () => {
    if (!newPointName.trim()) return;
    setSavingPoint(true);
    try {
      const res = await client.post('/inspection-points/', {
        point_name: newPointName.trim(),
        step_image: newPointStep,
        has_camera_verification: newPointCamera,
        is_active: true,
        bu_id: buId,
      });
      setInspectionPoints(prev => [...prev, res.data]);
      if (selected) {
        updateSelected({ point_name: res.data.point_name });
      }
      setAddingPoint(false);
      setNewPointName('');
      setNewPointStep(1);
      setNewPointCamera(false);
    } catch (err) {
      alert('No se pudo crear el punto: ' + JSON.stringify(err.response?.data || err.message));
    } finally {
      setSavingPoint(false);
    }
  };

  const currentStep = modelSteps.find(s => s.step_id === currentStepId);

  // ---- Add / edit a step via modal ----
  const openAddModal = () => {
    const nextStepNumber = modelSteps.length > 0 ? Math.max(...modelSteps.map(s => s.step_number)) + 1 : 1;
    setModalMode('add');
    setModalInitialData({ step_number: nextStepNumber });
    setModalOpen(true);
  };

  const openEditModal = (step) => {
    setModalMode('edit');
    setModalInitialData(step);
    setModalOpen(true);
  };

  const handleDeleteStep = async (step) => {
    const label = step.image_name || ('Step ' + step.step_number);
    if (!window.confirm('Borrar "' + label + '"? Se eliminan tambien todos sus botones/labels. Esto no se puede deshacer.')) {
      return;
    }
    try {
      await client.delete('/steps/' + step.step_id + '/');
      setModelSteps(prev => prev.filter(s => s.step_id !== step.step_id));
      if (currentStepId === step.step_id) {
        const remaining = modelSteps.filter(s => s.step_id !== step.step_id);
        setCurrentStepId(remaining.length > 0 ? remaining[0].step_id : null);
      }
    } catch (err) {
      alert('No se pudo borrar: ' + JSON.stringify(err.response?.data || err.message));
    }
  };

  // Redibuja la imagen en un <canvas> antes de guardarla: esto "hornea" la
  // orientación EXIF en los pixeles reales y elimina el metadato de rotación,
  // para que .NET/GDI+ (que no respeta EXIF) la muestre idéntica al navegador.
  const readImageFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve({
          base64: dataUrl.split(',')[1],
          width: canvas.width,
          height: canvas.height,
        });
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleModalSave = async ({ stepNumber, imageName, imageFile }) => {
    setModalSaving(true);
    try {
      // (todo el bloque de abajo queda igual, solo agregamos catch)
      if (modalMode === 'add') {
        const { base64, width, height } = await readImageFile(imageFile);
        const nextOrder = modelSteps.length > 0 ? Math.max(...modelSteps.map(s => s.flow_order)) + 1 : 1;
        const res = await client.post('/steps/', {
          bu_id: buId,
          part_number: partNumber,
          step_number: stepNumber,
          flow_order: nextOrder,
          step_image_base64: base64,
          image_width: width,
          image_height: height,
          image_name: imageName,
        });
        setModelSteps(prev => [...prev, res.data].sort((a, b) => a.flow_order - b.flow_order));
        setCurrentStepId(res.data.step_id);
      } else if (imageFile) {
        const { base64, width, height } = await readImageFile(imageFile);
        const res = await client.post(`/steps/${modalInitialData.step_id}/update_image/`, {
          step_image_base64: base64, image_width: width, image_height: height,
          step_number: stepNumber, image_name: imageName,
        });
        setModelSteps(prev => prev.map(s => (s.step_id === res.data.step_id ? res.data : s)));
      } else {
        const res = await client.patch(`/steps/${modalInitialData.step_id}/`, {
          step_number: stepNumber, image_name: imageName,
        });
        setModelSteps(prev => prev.map(s => (s.step_id === res.data.step_id ? res.data : s)));
      }
      setModalOpen(false);
    } catch (err) {
      console.error('Error guardando step:', err.response?.data || err.message);
      alert('No se pudo guardar: ' + JSON.stringify(err.response?.data || err.message));
    } finally {
      setModalSaving(false);
    }
  };

  // ---- Drag to reorder thumbnails (sets flow_order) ----
  const handleThumbDragStart = (idx) => { dragIndexRef.current = idx; };
  const handleThumbDragOver = (e) => e.preventDefault();
  const handleThumbDrop = async (idx) => {
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from === null || from === idx) return;

    const reordered = [...modelSteps];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(idx, 0, moved);
    const withNewOrder = reordered.map((s, i) => ({ ...s, flow_order: i + 1 }));
    setModelSteps(withNewOrder);

    await Promise.all(
      withNewOrder.map(s => client.patch(`/steps/${s.step_id}/`, { flow_order: s.flow_order }))
    );
  };

  // ---- Canvas element editing ----
  const addElement = (elementType) => {
    if (!currentStep) return;
    const newEl = {
      _localId: nextTempId.current--,
      position_id: null,
      element_type: elementType,
      point_name: elementType === 'inspection_point' ? '' : null,
      display_label: '',
      pos_x: Math.round(currentStep.image_width / 2),
      pos_y: Math.round(currentStep.image_height / 2),
    };
    setPositions(prev => [...prev, newEl]);
    setSelectedId(newEl._localId);
    setDirty(true);
  };

  const updateSelected = (fields) => {
    setPositions(prev => prev.map(p => (p._localId === selectedId ? { ...p, ...fields } : p)));
    setDirty(true);
  };

  const deleteSelected = () => {
    setPositions(prev => prev.filter(p => p._localId !== selectedId));
    setSelectedId(null);
    setDirty(true);
  };

  // Replica exactamente PictureBoxSizeMode.Zoom: mantiene el aspect ratio de la
  // imagen y la centra dentro del cuadro de PB_WIDTH x PB_HEIGHT, con "letterbox"
  // si la proporción no calza exacto (igual que en VB).
  const getImageBox = () => {
    const imgAspect = currentStep.image_width / currentStep.image_height;
    const boxAspect = PB_WIDTH / PB_HEIGHT;
    let renderedWPct, renderedHPct, offsetXPct, offsetYPct;
    if (imgAspect > boxAspect) {
      // la imagen es más ancha proporcionalmente -> limitada por el ancho
      renderedWPct = 100;
      renderedHPct = (boxAspect / imgAspect) * 100;
    } else {
      // la imagen es más alta proporcionalmente -> limitada por el alto
      renderedHPct = 100;
      renderedWPct = (imgAspect / boxAspect) * 100;
    }
    offsetXPct = (100 - renderedWPct) / 2;
    offsetYPct = (100 - renderedHPct) / 2;
    return { renderedWPct, renderedHPct, offsetXPct, offsetYPct };
  };

  const toPercent = (pos_x, pos_y) => {
    const { renderedWPct, renderedHPct, offsetXPct, offsetYPct } = getImageBox();
    return {
      xPct: offsetXPct + (pos_x / currentStep.image_width) * renderedWPct,
      yPct: offsetYPct + (pos_y / currentStep.image_height) * renderedHPct,
    };
  };

  const handlePinMouseDown = (e, localId) => {
    e.stopPropagation();
    setSelectedId(localId);
    const rect = imageRef.current.getBoundingClientRect();
    dragState.current = { localId, rect };
    window.addEventListener('mousemove', handlePinMouseMove);
    window.addEventListener('mouseup', handlePinMouseUp);
  };

  const handlePinMouseMove = useCallback((e) => {
    if (!dragState.current || !currentStep) return;
    const { localId, rect } = dragState.current;
    let xPct = ((e.clientX - rect.left) / rect.width) * 100;
    let yPct = ((e.clientY - rect.top) / rect.height) * 100;
    xPct = Math.max(0, Math.min(100, xPct));
    yPct = Math.max(0, Math.min(100, yPct));
    setPositions(prev => prev.map(p =>
      p._localId === localId
        ? { ...p, pos_x: Math.round((xPct / 100) * currentStep.image_width), pos_y: Math.round((yPct / 100) * currentStep.image_height) }
        : p
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const handlePinMouseUp = useCallback(() => {
    dragState.current = null;
    setDirty(true);
    window.removeEventListener('mousemove', handlePinMouseMove);
    window.removeEventListener('mouseup', handlePinMouseUp);
  }, [handlePinMouseMove]);

  // ── Resize handle: arrastrar la esquina para cambiar width/height ──
  const handleResizeMouseDown = (e, localId) => {
    e.stopPropagation();
    e.preventDefault();
    const current = positions.find(p => p._localId === localId);
    resizeState.current = {
      localId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: current.width || DEFAULT_BTN_WIDTH,
      startHeight: current.height || DEFAULT_BTN_HEIGHT,
      containerWidth: imageRef.current.getBoundingClientRect().width,
      containerHeight: imageRef.current.getBoundingClientRect().height,
    };
    window.addEventListener('mousemove', handleResizeMouseMove);
    window.addEventListener('mouseup', handleResizeMouseUp);
  };

  const handleResizeMouseMove = useCallback((e) => {
    if (!resizeState.current) return;
    const { localId, startX, startY, startWidth, startHeight, containerWidth, containerHeight } = resizeState.current;

    const deltaXPx = e.clientX - startX;
    const deltaYPx = e.clientY - startY;

    // Convierte el arrastre en pantalla a "pixeles VB" (espacio fijo 1080x540)
    const deltaW = (deltaXPx / containerWidth) * PB_WIDTH;
    const deltaH = (deltaYPx / containerHeight) * PB_HEIGHT;

    const newWidth = Math.max(24, Math.round(startWidth + deltaW));
    const newHeight = Math.max(16, Math.round(startHeight + deltaH));

    setPositions(prev => prev.map(p =>
      p._localId === localId ? { ...p, width: newWidth, height: newHeight } : p
    ));
  }, []);

  const handleResizeMouseUp = useCallback(() => {
    resizeState.current = null;
    setDirty(true);
    window.removeEventListener('mousemove', handleResizeMouseMove);
    window.removeEventListener('mouseup', handleResizeMouseUp);
  }, [handleResizeMouseMove]);

  const handleSaveDraft = async () => {
    if (!currentStep) return;
    setSaving(true);
    try {
      const res = await client.post(`/steps/${currentStep.step_id}/save_positions/`, {
        positions: positions.map(({ element_type, point_name, display_label, pos_x, pos_y, data_binding, width, height }) => ({
          element_type, point_name: point_name || null, display_label, pos_x, pos_y,
          data_binding: data_binding || null,
          width: width || null, height: height || null,
        })),
      });
      setModelSteps(prev => prev.map(s => (s.step_id === res.data.step_id ? res.data : s)));
      setPositions(res.data.positions.map(p => ({ ...p, _localId: p.position_id })));
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleCloneTarget = (pn) => {
    setCloneTargets(prev => prev.includes(pn) ? prev.filter(x => x !== pn) : [...prev, pn]);
  };

  const handleCloneToModels = async () => {
    if (!currentStep || cloneTargets.length === 0) return;
    setCloning(true);
    try {
      if (dirty) await handleSaveDraft();
      const res = await client.post(`/steps/${currentStep.step_id}/clone_to_models/`, {
        part_numbers: cloneTargets,
      });
      alert('Replicado a: ' + res.data.cloned_to.join(', '));
      setCloningOpen(false);
      setCloneTargets([]);
    } catch (err) {
      alert('No se pudo replicar: ' + JSON.stringify(err.response?.data || err.message));
    } finally {
      setCloning(false);
    }
  };

  const handlePublish = async () => {
    if (!currentStep) return;
    if (dirty) await handleSaveDraft();
    setSaving(true);
    try {
      const res = await client.post(`/steps/${currentStep.step_id}/publish/`);
      setModelSteps(prev => prev.map(s => (s.step_id === res.data.step_id ? res.data : s)));
    } finally {
      setSaving(false);
    }
  };

  const selected = positions.find(p => p._localId === selectedId);
  const pointCount = positions.filter(p => p.element_type === 'inspection_point').length;
  const labelCount = positions.filter(p => p.element_type === 'label').length;
  const selPct = selected && currentStep ? toPercent(selected.pos_x, selected.pos_y) : { xPct: 0, yPct: 0 };

  return (
    <div style={{ fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)' }}>
      {/* TOP BAR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', borderBottom: '1px solid #e2e8f0', background: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <strong>QWall Designer</strong>

          <select value={buId || ''} onChange={(e) => setBuId(Number(e.target.value))} style={selectStyle}>
            {businessUnits.map(bu => <option key={bu.bu_id} value={bu.bu_id}>{bu.bu_name}</option>)}
          </select>

          {!addingModel ? (
            <select
              value={partNumber || '__new__'}
              onChange={(e) => e.target.value === '__new__' ? setAddingModel(true) : setPartNumber(e.target.value)}
              style={selectStyle}
            >
              {partNumbers.length === 0 && <option value="__new__">-- sin part numbers --</option>}
              {partNumbers.map(pn => <option key={pn.pn_id} value={pn.ssiPN}>{pn.ssiPN}</option>)}
              <option value="__new__">+ Nuevo modelo...</option>
            </select>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                autoFocus placeholder="ssiPN (ej. 25806.3)"
                value={newModelSsiPN} onChange={(e) => setNewModelSsiPN(e.target.value)}
                style={{ ...selectStyle, width: 130 }}
              />
              <input
                placeholder="volvoProductNumber (opcional)"
                value={newModelVolvoPN} onChange={(e) => setNewModelVolvoPN(e.target.value)}
                style={{ ...selectStyle, width: 170 }}
              />
              <button onClick={handleCreateModel} disabled={savingModel || !newModelSsiPN.trim()} style={secondaryBtnStyle}>
                {savingModel ? '...' : 'OK'}
              </button>
              <button onClick={() => { setAddingModel(false); setNewModelSsiPN(''); setNewModelVolvoPN(''); }} style={secondaryBtnStyle}>x</button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{'Usuario de platformSSI'}</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LEFT SIDEBAR: Toolbox + Properties */}
        <div style={{ width: 240, borderRight: '1px solid #e2e8f0', padding: 16, overflowY: 'auto', background: '#fafafa' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>TOOLBOX</div>
          <button onClick={() => addElement('inspection_point')} disabled={!currentStep} style={toolboxBtnStyle}>+ Inspection Point</button>
          <button onClick={() => addElement('label')} disabled={!currentStep} style={toolboxBtnStyle}>+ Label</button>

          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', margin: '20px 0 8px' }}>PROPERTIES</div>

          {!selected && <p style={{ color: '#94a3b8', fontSize: 13 }}>Selecciona un elemento en el canvas.</p>}

          {selected && (
            <>
              {selected.element_type === 'inspection_point' && (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Point Name</label>
                    {!addingPoint ? (
                      <select
                        value={selected.point_name || ''}
                        onChange={e => e.target.value === '__new__' ? setAddingPoint(true) : updateSelected({ point_name: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="">-- seleccionar --</option>
                        {inspectionPoints.map(ip => (
                          <option key={ip.inspection_point_id} value={ip.point_name}>{ip.point_name}</option>
                        ))}
                        <option value="__new__">+ Nuevo punto de inspección...</option>
                      </select>
                    ) : (
                      <div style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: 10, background: '#fff' }}>
                        <input
                          autoFocus placeholder="Nombre del punto"
                          value={newPointName} onChange={(e) => setNewPointName(e.target.value)}
                          style={{ ...inputStyle, marginBottom: 8 }}
                        />
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <label style={{ fontSize: 12, color: '#64748b' }}>Step #</label>
                          <input
                            type="number" min={1} value={newPointStep}
                            onChange={(e) => setNewPointStep(Number(e.target.value))}
                            style={{ ...inputStyle, width: 60 }}
                          />
                          <label style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input type="checkbox" checked={newPointCamera} onChange={(e) => setNewPointCamera(e.target.checked)} />
                            Cámara
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={handleCreatePoint} disabled={savingPoint || !newPointName.trim()} style={{ ...secondaryBtnStyle, flex: 1 }}>
                            {savingPoint ? 'Guardando...' : 'Crear y asignar'}
                          </button>
                          <button onClick={() => setAddingPoint(false)} style={secondaryBtnStyle}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Número</label>
                    <input
                      type="number"
                      min={1}
                      max={positions.length}
                      value={positions.findIndex(p => p._localId === selectedId) + 1}
                      onChange={(e) => {
                        const fromIdx = positions.findIndex(p => p._localId === selectedId);
                        let toIdx = Number(e.target.value) - 1;
                        toIdx = Math.max(0, Math.min(positions.length - 1, toIdx));
                        if (toIdx === fromIdx) return;
                        setPositions(prev => {
                          const arr = [...prev];
                          const [moved] = arr.splice(fromIdx, 1);
                          arr.splice(toIdx, 0, moved);
                          return arr;
                        });
                        setDirty(true);
                      }}
                      style={inputStyle}
                    />
                  </div>
                </>
              )}

              {selected.element_type === 'inspection_point' && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Ancho (px)</label>
                    <input
                      type="number" placeholder="130"
                      value={selected.width || ''}
                      onChange={e => updateSelected({ width: e.target.value ? Number(e.target.value) : null })}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Alto (px)</label>
                    <input
                      type="number" placeholder="28"
                      value={selected.height || ''}
                      onChange={e => updateSelected({ height: e.target.value ? Number(e.target.value) : null })}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Display Label {selected.element_type === 'label' ? '(nombre del control en VB)' : ''}</label>
                <input value={selected.display_label || ''} onChange={e => updateSelected({ display_label: e.target.value })} style={inputStyle} />
              </div>

              {selected.element_type === 'label' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Dato dinámico (opcional)</label>
                  <select
                    value={selected.data_binding || ''}
                    onChange={e => updateSelected({ data_binding: e.target.value || null })}
                    style={inputStyle}
                  >
                    <option value="">-- ninguno (texto lo controla el código) --</option>
                    <option value="ssi_serial">SSI Serial</option>
                    <option value="volvo_serial">Volvo Serial</option>
                    <option value="volvo_pn">Número de parte cliente (volvoPN)</option>
                    <option value="ssi_pn">Número de parte SSI</option>
                    <option value="work_order">Orden de trabajo</option>
                    <option value="part_number">Part Number</option>
                    <option value="operator_name">Nombre del operador</option>
                    <option value="current_date">Fecha actual</option>
                    <option value="julian_code">Código juliano (Eaton)</option>
                    <option value="serial_digits">Solo dígitos del escaneo (sin prefijo)</option>
                  </select>
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    Si eliges uno, QWM le pone ese valor automáticamente al sincronizar.
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>X (%)</label>
                  <input type="number" step="0.1" value={selPct.xPct.toFixed(1)}
                    onChange={e => updateSelected({ pos_x: Math.round((Number(e.target.value) / 100) * currentStep.image_width) })}
                    style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Y (%)</label>
                  <input type="number" step="0.1" value={selPct.yPct.toFixed(1)}
                    onChange={e => updateSelected({ pos_y: Math.round((Number(e.target.value) / 100) * currentStep.image_height) })}
                    style={inputStyle} />
                </div>
              </div>

              <button onClick={deleteSelected} style={deleteBtnStyle}>🗑 Delete Element</button>
            </>
          )}
        </div>

        {/* CENTER CANVAS */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {currentStep ? (
            <>
              <div style={{ padding: '10px 20px', borderBottom: '1px solid #e2e8f0', fontSize: 13, color: '#64748b' }}>
                {partNumber} · Step {currentStep.step_number} &nbsp;|&nbsp; {currentStep.image_width} × {currentStep.image_height} &nbsp;|&nbsp; {pointCount} points · {labelCount} labels
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: `${zoom}%`, maxWidth: PB_WIDTH }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 4, fontSize: 11, color: '#64748b',
                  }}>
                    <span>pbStepImage</span>
                    <span>{PB_WIDTH} × {PB_HEIGHT} px · fijo</span>
                  </div>
                  <div
                    style={{
                      position: 'relative', width: '100%',
                      aspectRatio: `${PB_WIDTH} / ${PB_HEIGHT}`,
                      background: '#fff', border: '2px dashed #2563eb', borderRadius: 4, overflow: 'hidden',
                      boxShadow: '0 0 0 1px #fff, 0 1px 4px rgba(0,0,0,0.08)',
                    }}
                  >
                  <div ref={imageRef} onClick={() => setSelectedId(null)} style={{ position: 'absolute', inset: 0 }}>
                    {(() => {
                      const { renderedWPct, renderedHPct, offsetXPct, offsetYPct } = getImageBox();
                      return (
                        <img
                          src={`data:image/jpeg;base64,${currentStep.step_image_base64}`}
                          alt="step"
                          style={{
                            position: 'absolute',
                            left: `${offsetXPct}%`, top: `${offsetYPct}%`,
                            width: `${renderedWPct}%`, height: `${renderedHPct}%`,
                          }}
                          draggable={false}
                        />
                      );
                    })()}

                    {positions.map((p, idx) => {
                    const { xPct, yPct } = toPercent(p.pos_x, p.pos_y);
                    const isSelected = p._localId === selectedId;

                    if (p.element_type === 'label') {
                      const previewText = p.data_binding
                        ? `{${DATA_BINDING_LABELS[p.data_binding] || p.data_binding}}`
                        : (p.display_label || 'LABEL');
                      return (
                        <div key={p._localId}
                          onMouseDown={(e) => handlePinMouseDown(e, p._localId)}
                          onClick={(e) => e.stopPropagation()}
                          title={p.display_label ? `Control: ${p.display_label}` : ''}
                          style={{
                            position: 'absolute', left: `${xPct}%`, top: `${yPct}%`,
                            transform: 'translate(-50%, -50%)', cursor: 'grab',
                            background: p.data_binding ? '#ecfdf5' : '#fff',
                            border: isSelected ? '2px solid #2563eb' : (p.data_binding ? '1px solid #6ee7b7' : '1px solid #cbd5e1'),
                            padding: '3px 8px', borderRadius: 3, fontSize: 11, fontWeight: 700,
                            letterSpacing: 0.5, whiteSpace: 'nowrap',
                            color: p.data_binding ? '#047857' : '#000',
                          }}>
                          {previewText}
                        </div>
                      );
                    }

                    const isUnassigned = !p.point_name;
                    const btnWidthPct = ((p.width || DEFAULT_BTN_WIDTH) / PB_WIDTH) * 100;
                    const btnHeightPct = ((p.height || DEFAULT_BTN_HEIGHT) / PB_HEIGHT) * 100;
                    return (
                      <div key={p._localId}
                        onMouseDown={(e) => handlePinMouseDown(e, p._localId)}
                        onClick={(e) => e.stopPropagation()}
                        title={p.point_name || 'Sin asignar'}
                        style={{
                          position: 'absolute', left: `${xPct}%`, top: `${yPct}%`,
                          width: `${btnWidthPct}%`, height: `${btnHeightPct}%`,
                          transform: 'translate(-50%, -50%)', cursor: 'grab',
                          padding: '0 8px 0 22px',
                          background: isUnassigned ? '#f59e0b' : '#2563eb', color: '#fff',
                          borderRadius: 4, border: isSelected ? '2px solid #93c5fd' : '1px solid rgba(0,0,0,0.15)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)', fontSize: 11, fontWeight: 600, lineHeight: 1.2,
                          textAlign: 'center', userSelect: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                        <span style={{
                          position: 'absolute', left: 3, top: '50%', transform: 'translateY(-50%)',
                          width: 15, height: 15, borderRadius: '50%', background: 'rgba(255,255,255,0.25)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700,
                        }}>
                          {idx + 1}
                        </span>
                        {p.point_name || 'Sin asignar'}

                        {isSelected && (
                          <div
                            onMouseDown={(e) => handleResizeMouseDown(e, p._localId)}
                            title="Arrastra para cambiar el tamaño"
                            style={{
                              position: 'absolute', right: 0, bottom: 0,
                              width: 12, height: 12, borderRadius: '3px 0 4px 0',
                              background: '#93c5fd', border: '1px solid #1d4ed8',
                              cursor: 'nwse-resize', zIndex: 10,
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                  </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '10px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: currentStep.status === 'published' ? '#d4edda' : '#fff3cd',
                    color: currentStep.status === 'published' ? '#155724' : '#856404',
                  }}>
                    {currentStep.status}
                  </span>
                  <span style={{ fontSize: 13, color: '#64748b' }}>v{currentStep.version}</span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setZoom(z => Math.max(50, z - 10))} style={zoomBtnStyle}>−</button>
                  <span style={{ fontSize: 13, alignSelf: 'center' }}>{zoom}%</span>
                  <button onClick={() => setZoom(z => Math.min(200, z + 10))} style={zoomBtnStyle}>+</button>
                  <button onClick={handleSaveDraft} disabled={saving} style={secondaryBtnStyle}>Save Draft</button>
                  <button onClick={() => setCloningOpen(v => !v)} style={secondaryBtnStyle}>Replicar a otros modelos</button>
                  <button onClick={handlePublish} disabled={saving} style={primaryBtnStyle}>Publish</button>
                </div>
              </div>

              {cloningOpen && (
                <div style={{
                  padding: 16, borderTop: '1px solid #e2e8f0', background: '#fafafa',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                    Copiar este diseño (imagen + posiciones) a:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                    {partNumbers.filter(pn => pn.ssiPN !== partNumber).map(pn => (
                      <label key={pn.pn_id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={cloneTargets.includes(pn.ssiPN)}
                          onChange={() => toggleCloneTarget(pn.ssiPN)}
                        />
                        {pn.ssiPN}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={handleCloneToModels}
                      disabled={cloning || cloneTargets.length === 0}
                      style={primaryBtnStyle}
                    >
                      {cloning ? 'Replicando...' : `Replicar a ${cloneTargets.length || ''} modelo(s)`}
                    </button>
                    <button onClick={() => { setCloningOpen(false); setCloneTargets([]); }} style={secondaryBtnStyle}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              {partNumber ? 'No hay imágenes todavía. Usa "+ Agregar Step" a la derecha →' : 'Este cliente no tiene números de parte en ssi_PartNumbers.'}
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: Steps thumbnails, draggable to reorder */}
        <div style={{ width: 200, borderLeft: '1px solid #e2e8f0', padding: 16, overflowY: 'auto', background: '#fafafa' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 12 }}>
            STEPS {partNumber && `· ${partNumber}`}
          </div>

          {modelSteps.map((s, idx) => (
            <div
              key={s.step_id}
              draggable
              onDragStart={() => handleThumbDragStart(idx)}
              onDragOver={handleThumbDragOver}
              onDrop={() => handleThumbDrop(idx)}
              onClick={() => setCurrentStepId(s.step_id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: 8, marginBottom: 8,
                borderRadius: 6, cursor: 'grab', background: '#fff',
                border: s.step_id === currentStepId ? '2px solid #2563eb' : '1px solid #e2e8f0',
              }}
            >
              <span style={{ fontSize: 11, color: '#94a3b8', width: 14 }}>{s.flow_order}</span>
              <img
                src={`data:image/jpeg;base64,${s.step_image_base64}`}
                alt=""
                style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4 }}
              />
              <div style={{ fontSize: 12, flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.image_name || `Step ${s.step_number}`}
                </div>
                <div style={{
                  fontSize: 10, color: s.status === 'published' ? '#155724' : '#856404',
                }}>
                  {s.status}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); openEditModal(s); }}
                title="Editar"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#64748b', padding: 2 }}
              >
                ✎
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteStep(s); }}
                title="Borrar"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#dc2626', padding: 2 }}
              >
                &times;
              </button>
            </div>
          ))}

          {partNumber && (
            <div
              onClick={openAddModal}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16, borderRadius: 6, border: '2px dashed #cbd5e1',
                color: '#64748b', fontSize: 13, cursor: 'pointer', textAlign: 'center',
              }}
            >
              + Agregar Step
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <StepModal
          mode={modalMode}
          initialData={modalInitialData}
          onClose={() => setModalOpen(false)}
          onSave={handleModalSave}
          saving={modalSaving}
        />
      )}
    </div>
  );
}

const selectStyle = { padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13 };
const toolboxBtnStyle = {
  display: 'block', width: '100%', padding: '10px 12px', marginBottom: 8,
  border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff',
  textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: 500,
};
const labelStyle = { display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 };
const inputStyle = { width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4, boxSizing: 'border-box' };
const zoomBtnStyle = { width: 28, height: 28, border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', cursor: 'pointer' };
const secondaryBtnStyle = { padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', cursor: 'pointer' };
const primaryBtnStyle = { padding: '8px 16px', border: 'none', borderRadius: 4, background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600 };
const deleteBtnStyle = { width: '100%', padding: 10, border: '1px solid #fecaca', borderRadius: 4, background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 600 };

export default StepCanvas;