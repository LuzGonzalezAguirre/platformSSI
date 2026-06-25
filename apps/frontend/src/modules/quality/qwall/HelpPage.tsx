import { useEffect, useRef, useState } from "react";
import * as Icons from "lucide-react";

// ─── Datos de cada sección ─────────────────────────────────────────────────────

interface StepItem {
  title: string;
  description: string;
}

interface SectionData {
  id: string;
  icon: keyof typeof Icons;
  label: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  steps: StepItem[];
  tips: string[];
}

const SECTIONS: SectionData[] = [
  {
    id: "inicio",
    icon: "MonitorSmartphone",
    label: "Pantalla de inicio",
    subtitle: "Familiarízate con la interfaz antes de empezar",
    image: "/tutorial/paso0-inicio.png",
    imageAlt: "Pantalla completa de Safe Launch SSI vacía",
    steps: [
      {
        title: "Sección superior — Inicio de sesión",
        description:
          'Contiene dos campos: "Credencial (Barcode ID)" y "Password". Aquí te autentificas antes de continuar.',
      },
      {
        title: "Sección inferior — Modelo y Work Order",
        description:
          'Contiene cuatro campos: Unidad de negocio, Modelo, Inspección y Orden de trabajo. Se habilitan después de iniciar sesión.',
      },
      {
        title: 'Botón "Iniciar sesión"',
        description:
          "Al fondo de la pantalla. Procesa la autenticación y carga los catálogos de modelo e inspección.",
      },
    ],
    tips: [
      "Todos los campos deben estar llenos antes de presionar el botón.",
    ],
  },
  {
    id: "credencial",
    icon: "ScanLine",
    label: "Escanear credencial",
    subtitle: "Autenticación con scanner Zebra o teclado",
    image: "/tutorial/paso1-credencial.png",
    imageAlt: "Campo credencial lleno con 900014469A y contraseña oculta",
    steps: [
      {
        title: "Enfoca el scanner hacia tu gafete",
        description:
          "Apunta el scanner Zebra al código de barras de tu credencial. El campo Credencial (Barcode ID) se llenará solo.",
      },
      {
        title: "Ingresa tu contraseña",
        description:
          "Escribe tu contraseña en el campo Password.",
      },
      {
        title: 'Presiona "Iniciar sesión"',
        description:
          "Una vez que ambos campos estén llenos presiona el botón azul. La app cargará tu sesión.",
      },
    ],
    tips: [
      "Si tu contraseña es incorrecta, el sistema mostrará un aviso — vuelve a intentarlo.",
    ],
  },
  {
    id: "cliente",
    icon: "Building2",
    label: "Unidad de negocio",
    subtitle: "Selecciona el cliente correspondiente a tu turno",
    image: "/tutorial/paso2-cliente.png",
    imageAlt: "Dropdown de unidad de negocio con Volvo, Cummins, Eaton, Harley-Davidson, John Deere",
    steps: [
      {
        title: 'Abre el dropdown "Unidad de negocio (cliente)"',
        description:
          "Haz clic en el selector y verás la lista de clientes activos",
      },
      {
        title: "Selecciona el cliente de tu turno",
        description:
          "Elige el cliente asignado. Esta selección filtra automáticamente los modelos e inspecciones disponibles.",
      },
    ],
    tips: [
     
      "Cambiar la unidad de negocio limpiará los campos de modelo e inspección.",
    ],
  },
  {
    id: "modelo",
    icon: "Layers",
    label: "Seleccionar modelo",
    subtitle: "Elige el número de parte que vas a inspeccionar",
    image: "/tutorial/paso3-modelo.png",
    imageAlt: "Dropdown de modelo con números de parte como 43291.6, 43292.6, 43301.3",
    steps: [
      {
        title: 'Abre el dropdown "Seleccione modelo"',
        description:
          "La lista solo muestra los modelos habilitados para la unidad de negocio que seleccionaste.",
      },
      {
        title: "Elige el número de parte a inspeccionar",
        description:
          "Selecciona el part number correspondiente a la pieza que tienes en estación.",
      },
    ],
    tips: [
      "Si el modelo no aparece en la lista, verifica que la unidad de negocio seleccionada sea la correcta.",
    ],
  },
  {
    id: "inspeccion",
    icon: "ClipboardList",
    label: "Seleccionar inspección",
    subtitle: "Elige el número de inspección asignado a tu turno",
    image: "/tutorial/paso4-inspeccion.png",
    imageAlt: "Dropdown de inspección con Inspection 1, Inspection 2, Inspection 3",
    steps: [
      {
        title: 'Abre el dropdown "Seleccione inspección"',
        description:
          "Verás las inspecciones disponibles para el modelo elegido: Inspection 1, 2 o 3.",
      },
      {
        title: "Elige la inspección de tu turno",
        description:
          "Cada número de inspección tiene sus propios puntos de control y criterios de aceptación.",
      },
    ],
    tips: [
      "Seleccionar la inspección incorrecta puede registrar datos en el turno equivocado.",
    ],
  },
  {
    id: "workorder",
    icon: "ScanBarcode",
    label: "Orden de trabajo",
    subtitle: "Escanea la Work Order y confirma todos los campos",
    image: "/tutorial/paso5-workorder.png",
    imageAlt: "Formulario completo con Volvo, modelo 43291.6, Inspection 1 y orden P000000",
    steps: [
      {
        title: "Escanea o escribe la orden de trabajo",
        description:
          'Escanea el código de barras de la hoja de ruta o escríbelo manualmente (ej. P000000). El formato correcto empieza con "P" seguida de 6 dígitos.',
      },
      {
        title: "Revisa que todos los campos estén completos",
        description:
          "Verifica: Credencial, Unidad de negocio, Modelo, Inspección y Orden de trabajo. Todos deben tener un valor.",
      },
      {
        title: 'Presiona "Continuar"',
        description:
          "El botón azul al fondo abre la pantalla de inspección con los puntos de control correspondientes.",
      },
    ],
    tips: [
      'Si la orden empieza con "P" seguida de números, el formato es correcto.',
      "Si presionas Continuar y la app no avanza, revisa que ningún campo quede vacío.",
    ],
  },
];

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function TipBox({ text }: { text: string }) {
  return (
    <div style={s.tipBox}>
      <Icons.Info size={14} style={{ color: "#1a4c7c", flexShrink: 0, marginTop: 1 }} />
      <span style={s.tipText}>{text}</span>
    </div>
  );
}

function StepRow({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div style={s.stepRow}>
      <div style={s.stepNum}>{number}</div>
      <div>
        <p style={s.stepTitle}>{title}</p>
        <p style={s.stepDesc}>{description}</p>
      </div>
    </div>
  );
}

function SectionImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const filename = src.split("/").pop() ?? src;

  return (
    <div style={s.imagePanel}>
      {!failed ? (
        <img
          src={src}
          alt={alt}
          style={s.screenshot}
          onError={() => setFailed(true)}
        />
      ) : (
        <div style={s.imagePlaceholder}>
          <Icons.ImageOff size={28} color="#94a3b8" />
          <span style={s.placeholderText}>
            Agrega la imagen en
            <br />
            <code style={s.placeholderCode}>public/tutorial/{filename}</code>
          </span>
        </div>
      )}
    </div>
  );
}

function HelpSection({ data, index }: { data: SectionData; index: number }) {
  const IconComponent = Icons[data.icon] as React.ElementType;
  return (
    <section id={data.id} style={s.section}>
      {/* Header de sección */}
      <div style={s.sectionHeader}>
        <div style={s.sectionIconWrap}>
          <IconComponent size={17} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={s.sectionTitle}>{data.label}</h2>
            <span style={s.sectionBadge}>Paso {index}</span>
          </div>
          <p style={s.sectionSubtitle}>{data.subtitle}</p>
        </div>
      </div>

      {/* Cuerpo */}
      <div style={s.sectionBody}>
        <SectionImage src={data.image} alt={data.imageAlt} />

        <div style={s.stepsPanel}>
          {data.steps.map((step, i) => (
            <StepRow
              key={i}
              number={i + 1}
              title={step.title}
              description={step.description}
            />
          ))}
          <div style={s.tipsGroup}>
            {data.tips.map((tip, i) => (
              <TipBox key={i} text={tip} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Navegación lateral sticky ─────────────────────────────────────────────────

function SideNav({ activeId }: { activeId: string }) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav style={s.sideNav}>
      <p style={s.sideNavLabel}>Contenido</p>
      {SECTIONS.map((sec, i) => {
        const IconComponent = Icons[sec.icon] as React.ElementType;
        const isActive = activeId === sec.id;
        return (
          <button
            key={sec.id}
            onClick={() => scrollTo(sec.id)}
            style={{
              ...s.sideNavItem,
              ...(isActive ? s.sideNavItemActive : {}),
            }}
          >
            <IconComponent size={14} style={{ flexShrink: 0 }} />
            <span style={s.sideNavText}>
              <span style={s.sideNavIndex}>{i}</span>
              {sec.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function HelpPage() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );

    SECTIONS.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div style={s.page}>
      {/* Page header */}
      <div style={s.pageHeader}>
        <div style={s.pageHeaderLeft}>
          <Icons.BookOpen size={21} style={{ color: "#1a4c7c" }} />
          <div>
            <h1 style={s.pageTitle}>Ayuda y Tutorial</h1>
            <p style={s.pageSubtitle}>Safe Launch SSI — Guía completa de uso</p>
          </div>
        </div>
        <div style={s.headerBadge}>
          <Icons.MonitorSmartphone size={13} />
          Safe Launch SSI
        </div>
      </div>

      {/* Layout: nav lateral + contenido */}
      <div style={s.layout}>
        <div style={s.sideNavWrapper}>
          <SideNav activeId={activeId} />
        </div>

        <div style={s.sectionsWrapper}>
          {SECTIONS.map((sec, i) => (
            <HelpSection key={sec.id} data={sec} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: "1.5rem 2rem 3rem",
    maxWidth: 1100,
    margin: "0 auto",
  },

  // Header
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "0.75rem",
    marginBottom: "1.75rem",
  },
  pageHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  pageTitle: {
    fontSize: "1.4rem",
    fontWeight: 700,
    color: "var(--color-text-primary)",
    margin: 0,
  },
  pageSubtitle: {
    fontSize: "0.82rem",
    color: "var(--color-text-secondary)",
    margin: 0,
    marginTop: 2,
  },
  headerBadge: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#e8f0fb",
    color: "#1a4c7c",
    fontSize: "0.73rem",
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 999,
  },

  // Layout 2 columnas
  layout: {
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    gap: "1.5rem",
    alignItems: "start",
  },

  // Side nav
  sideNavWrapper: {
    position: "sticky",
    top: "1rem",
  },
  sideNav: {
    backgroundColor: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    padding: "0.75rem 0.5rem",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  sideNavLabel: {
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--color-text-secondary)",
    margin: "0 0 6px 6px",
  },
  sideNavItem: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "6px 8px",
    borderRadius: 7,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: "var(--color-text-secondary)",
    fontSize: "0.78rem",
    textAlign: "left" as const,
    width: "100%",
    transition: "background 0.15s",
  },
  sideNavItemActive: {
    backgroundColor: "#e8f0fb",
    color: "#1a4c7c",
    fontWeight: 600,
  },
  sideNavText: {
    display: "flex",
    flexDirection: "column" as const,
    lineHeight: 1.3,
  },
  sideNavIndex: {
    fontSize: "0.62rem",
    opacity: 0.6,
    marginBottom: 1,
  },

  // Sections
  sectionsWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  section: {
    backgroundColor: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: 12,
    overflow: "hidden",
    scrollMarginTop: "1rem",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.9rem 1.25rem",
    borderBottom: "1px solid var(--color-border)",
    backgroundColor: "#f8fafc",
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#1a4c7c",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: "0.95rem",
    fontWeight: 700,
    color: "var(--color-text-primary)",
    margin: 0,
  },
  sectionBadge: {
    fontSize: "0.68rem",
    fontWeight: 600,
    color: "#1a4c7c",
    backgroundColor: "#e8f0fb",
    borderRadius: 999,
    padding: "2px 8px",
  },
  sectionSubtitle: {
    fontSize: "0.78rem",
    color: "var(--color-text-secondary)",
    margin: 0,
    marginTop: 2,
  },
  sectionBody: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
  },

  // Image panel
  imagePanel: {
    backgroundColor: "#f1f5f9",
    borderRight: "1px solid var(--color-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem",
    minHeight: 260,
  },
  screenshot: {
    maxHeight: 280,
    maxWidth: "100%",
    objectFit: "contain",
    borderRadius: 8,
    boxShadow: "0 2px 14px rgba(0,0,0,0.13)",
  },
  imagePlaceholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    gap: 10,
  },
  placeholderText: {
    color: "#94a3b8",
    fontSize: "0.78rem",
    lineHeight: 1.6,
  },
  placeholderCode: {
    fontSize: "0.72rem",
    backgroundColor: "#e2e8f0",
    padding: "1px 5px",
    borderRadius: 4,
  },

  // Steps panel
  stepsPanel: {
    padding: "1.1rem 1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
  },
  stepRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.65rem",
    padding: "0.55rem 0.7rem",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    backgroundColor: "#1a4c7c",
    color: "#fff",
    fontSize: "0.72rem",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepTitle: {
    fontSize: "0.82rem",
    fontWeight: 600,
    color: "var(--color-text-primary)",
    margin: 0,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: "0.78rem",
    color: "var(--color-text-secondary)",
    margin: 0,
    lineHeight: 1.5,
  },

  // Tips
  tipsGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginTop: 4,
  },
  tipBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: "#e8f0fb",
    borderRadius: 7,
    padding: "0.45rem 0.7rem",
  },
  tipText: {
    fontSize: "0.76rem",
    color: "#1a4c7c",
    lineHeight: 1.5,
  },
};
