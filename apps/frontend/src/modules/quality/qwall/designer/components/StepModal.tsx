// @ts-nocheck
// Adaptación inicial desde qwall-designer. La integración con Q-Wall API se valida por separado.
import { useState, useRef } from 'react';

function StepModal({ mode, initialData, onClose, onSave, saving }) {
  const [stepNumber, setStepNumber] = useState(initialData?.step_number || 1);
  const [imageName, setImageName] = useState(initialData?.image_name || '');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(
    initialData?.step_image_base64 ? `data:image/jpeg;base64,${initialData.step_image_base64}` : null
  );
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
    if (!imageName) {
      setImageName(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSubmit = () => {
    if (!imageName.trim()) return;
    if (mode === 'add' && !imageFile) return;
    onSave({ stepNumber, imageName: imageName.trim(), imageFile });
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3 style={{ marginTop: 0 }}>{mode === 'add' ? 'Agregar Step' : 'Editar Step'}</h3>

        <div onClick={() => fileInputRef.current?.click()} style={dropzoneStyle}>
          {imagePreview ? (
            <img src={imagePreview} alt="preview" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 4 }} />
          ) : (
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Click para elegir imagen</span>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        {mode === 'edit' && (
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            Deja la imagen como está si solo quieres cambiar el número o el nombre.
          </p>
        )}

        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>Número de Step</label>
          <input type="number" value={stepNumber} onChange={(e) => setStepNumber(Number(e.target.value))} style={inputStyle} />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Nombre de la imagen</label>
          <input
            value={imageName}
            onChange={(e) => setImageName(e.target.value)}
            placeholder="ej. gearbox-face"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={secondaryBtn}>Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} style={primaryBtn}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle = {
  background: '#fff', borderRadius: 8, padding: 24, width: 360,
  fontFamily: 'sans-serif', boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
};
const dropzoneStyle = {
  border: '2px dashed #cbd5e1', borderRadius: 6, padding: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', minHeight: 100,
};
const labelStyle = { display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 };
const inputStyle = { width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4, boxSizing: 'border-box' };
const secondaryBtn = { padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', cursor: 'pointer' };
const primaryBtn = { padding: '8px 16px', border: 'none', borderRadius: 4, background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600 };

export default StepModal;