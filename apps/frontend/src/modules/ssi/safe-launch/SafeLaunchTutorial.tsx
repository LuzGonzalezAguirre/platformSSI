import { useState } from "react";

interface Step {
  label: string;
  title: string;
  description: string;
  tip: string;
}

const STEPS: Step[] = [
  {
    label: "Inicio",
    title: "Pantalla de inicio — Safe Launch",
    description:
      "Al abrir la aplicación verás dos secciones: \"Inicio de sesión\" (credencial y contraseña) y \"Modelo y Work Order\" (unidad de negocio, modelo, inspección y orden de trabajo).",
    tip: "El scanner Zebra leerá automáticamente la credencial al enfocarla.",
  },
  {
    label: "Credencial",
    title: "Paso 1 — Escanear credencial",
    description:
      "Enfoca el scanner hacia tu gafete. El campo Credencial (Barcode ID) se llenará automáticamente. Luego escribe tu contraseña.",
    tip: "Si no tienes scanner disponible, puedes escribir tu Barcode ID manualmente.",
  },
  {
    label: "Cliente",
    title: "Paso 2 — Seleccionar unidad de negocio",
    description:
      "En el dropdown \"Unidad de negocio (cliente)\" selecciona el cliente correspondiente a tu turno. Opciones: Volvo, Cummins, Eaton, Harley-Davidson, John Deere.",
    tip: "Esto filtra automáticamente los modelos e inspecciones disponibles.",
  },
  {
    label: "Modelo",
    title: "Paso 3 — Seleccionar modelo / part number",
    description:
      "Selecciona el número de parte que vas a inspeccionar. La lista se filtra según la unidad de negocio elegida.",
    tip: "Los números de parte con sufijo .6 son los registros activos en base de datos.",
  },
  {
    label: "Inspección",
    title: "Paso 4 — Seleccionar inspección",
    description:
      "Elige el número de inspección asignado para tu turno (Inspection 1, 2 o 3). Cada inspección tiene sus propios puntos de control.",
    tip: "Confirma con tu líder qué inspección te corresponde.",
  },
  {
    label: "Work Order",
    title: "Paso 5 — Escanear orden de trabajo y continuar",
    description:
      "Escanea o escribe la orden de trabajo (ej. P000000). Verifica que todos los campos estén completos y presiona Continuar.",
    tip: "Si la orden empieza con \"P\" seguida de números, el formato es correcto.",
  },
];

interface SafeLaunchTutorialProps {
  images: string[];
  onFinish?: () => void;
}

export default function SafeLaunchTutorial({ images, onFinish }: SafeLaunchTutorialProps) {
  const [current, setCurrent] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));

  const goTo = (index: number) => {
    setCurrent(index);
    setVisited((prev) => new Set(prev).add(index));
  };

  const handleNext = () => {
    if (current < STEPS.length - 1) {
      goTo(current + 1);
    } else {
      onFinish?.();
    }
  };

  const handlePrev = () => {
    if (current > 0) goTo(current - 1);
  };

  const step = STEPS[current];
  const isLast = current === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4" style={{ backgroundColor: "#1a4c7c" }}>
          <h1 className="text-white text-lg font-bold tracking-wide">
            Tutorial — Safe Launch SSI
          </h1>

          {/* Progress dots */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {STEPS.map((s, i) => {
              const isActive = i === current;
              const isDone = visited.has(i) && i !== current;
              return (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                    isActive
                      ? "bg-white text-[#1a4c7c] border-white"
                      : isDone
                      ? "bg-[#2563a8] text-white border-[#2563a8]"
                      : "bg-transparent text-white/60 border-white/30"
                  }`}
                >
                  {isDone ? (
                    <span>✓</span>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${((current + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">

          {/* Image panel */}
          <div className="bg-gray-100 flex items-center justify-center p-6 min-h-[280px]">
            {images[current] ? (
              <img
                src={images[current]}
                alt={`Tutorial paso ${current + 1}`}
                className="max-h-72 max-w-full object-contain rounded-lg shadow"
              />
            ) : (
              <div className="text-gray-400 text-sm">Sin imagen</div>
            )}
          </div>

          {/* Info panel */}
          <div className="flex flex-col justify-between p-6 gap-4">
            <div>
              <span
                className="inline-block text-xs font-bold uppercase tracking-widest px-2 py-1 rounded mb-3"
                style={{ backgroundColor: "#e8f0fb", color: "#1a4c7c" }}
              >
                {step.label}
              </span>
              <h2 className="text-xl font-bold text-gray-800 mb-3 leading-snug">
                {step.title}
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                {step.description}
              </p>

              {/* Tip box */}
              <div
                className="mt-4 flex gap-2 rounded-lg p-3"
                style={{ backgroundColor: "#e8f0fb" }}
              >
                <span className="text-[#1a4c7c] text-base mt-0.5">ℹ️</span>
                <p className="text-sm text-[#1a4c7c] font-medium leading-relaxed">
                  {step.tip}
                </p>
              </div>
            </div>

            {/* Step counter */}
            <p className="text-xs text-gray-400 text-right">
              Paso {current + 1} de {STEPS.length}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100">
          <button
            onClick={handlePrev}
            disabled={current === 0}
            className="px-5 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Anterior
          </button>

          <button
            onClick={handleNext}
            className="px-6 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: "#1a4c7c" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#163d63")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1a4c7c")}
          >
            {isLast ? "Finalizar ✓" : "Siguiente →"}
          </button>
        </div>
      </div>
    </div>
  );
}
