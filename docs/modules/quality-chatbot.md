# Chatbot de Calidad: Q-Wall

## Propósito

El chatbot de Calidad es un asistente contextual de Q-Wall basado en preguntas predefinidas y respuestas calculadas mediante servicios internos de platformSSI.

No es un chatbot generativo. No interpreta lenguaje natural libre ni ejecuta consultas arbitrarias. El usuario selecciona una pregunta disponible y el backend resuelve una función registrada explícitamente.

## Estado

Estado actual: implementado con limitaciones de contrato y cobertura de pruebas.

El backend está conectado mediante la app `quality`, publica endpoints bajo `/api/v1/quality/chatbot/` y el frontend monta `ChatbotWidget` desde `AppShell`.

Actualmente `ChatbotQuestionTemplate.MODULE_CHOICES` soporta únicamente `qwall`.

## Ubicación

Backend:

- `apps/backend/apps/quality/chatbot/`
- `apps/backend/apps/quality/chatbot_urls.py`
- `apps/backend/apps/quality/models/__init__.py`

Frontend:

- `apps/frontend/src/modules/quality/chatbot/ChatbotWidget.tsx`
- `apps/frontend/src/modules/quality/chatbot/chatbot.service.ts`
- `apps/frontend/src/modules/quality/chatbot/useChatbotPreload.ts`
- `apps/frontend/src/components/layout/AppShell.tsx`

Datos iniciales:

- `chatbot_questions_fixture.json`

## Flujo de ejecución

1. `AppShell` monta `ChatbotWidget`.
2. El widget verifica la ruta actual.
3. Solo permanece visible en prefijos `/quality/qwall` y `/quality/rejections`.
4. `useChatbotPreload("qwall", true)` solicita preguntas y respuestas.
5. El frontend llama `GET /api/v1/quality/chatbot/preloaded/`.
6. `ChatbotPreloadedView` valida parámetros y llama `ChatbotService.get_preloaded_answers`.
7. El servicio consulta templates activos del módulo.
8. Se aplica `role_slugs_allowed`.
9. `service_method_ref` debe existir en `CHATBOT_SERVICE_REGISTRY`.
10. La función registrada obtiene datos mediante servicios de dominio, principalmente `QWallService`, o devuelve una respuesta estática.
11. El backend interpola la plantilla en español o inglés.
12. El frontend presenta las preguntas como opciones seleccionables.

La pregunta visible no se envía para interpretación. La relación entre pregunta y cálculo está definida por `question_key` y `service_method_ref`.

## API

Todos los endpoints usan `IsAuthenticated`.

| Método | Endpoint | Responsabilidad |
| --- | --- | --- |
| GET | `/api/v1/quality/chatbot/preloaded/` | Resolver templates activos y devolver respuestas |
| POST | `/api/v1/quality/chatbot/feedback/` | Registrar utilidad de una respuesta |
| POST | `/api/v1/quality/chatbot/suggestion/` | Registrar una propuesta de nueva pregunta |

### Preloaded

`module` es obligatorio.

Parámetros opcionales reconocidos:

- `bu_id`
- `date_from`
- `date_to`
- `locale`

`date_from` y `date_to` se convierten mediante `date.fromisoformat`.

La respuesta contiene `module` e `items`. Cada item expone `question_key`, `question`, `response_type` y `answer` o `media`.

### Feedback

Campos:

- `question_key`
- `was_helpful`
- `filters_snapshot`, opcional

El serializer exige que `question_key` corresponda a un template activo.

### Suggestion

Campos:

- `module`
- `suggestion_text`

El texto se normaliza con `strip()` y no puede quedar vacío.

## Datos

Los modelos pertenecen a la app Django `quality` y están incluidos en `0001_initial.py`.

### ChatbotQuestionTemplate

Tabla: `quality_chatbot_question_template`.

Define:

- módulo;
- clave única;
- pregunta en español e inglés;
- plantilla de respuesta en ambos idiomas;
- tipo de respuesta;
- referencia al intent;
- filtros declarados;
- roles permitidos;
- parámetros de configuración;
- estado activo;
- orden de presentación;
- usuario creador y timestamps.

`role_slugs_allowed=[]` significa que no existe una restricción adicional por rol para esa pregunta.

### ChatbotFeedback

Tabla: `quality_chatbot_feedback`.

Almacena template, usuario, `was_helpful`, snapshot opcional de filtros y fecha.

### ChatbotSuggestion

Tabla: `quality_chatbot_suggestion`.

Almacena usuario, módulo, texto, fecha y estado `reviewed`.

## Registry

`CHATBOT_SERVICE_REGISTRY` controla qué funciones pueden ejecutarse. Un valor guardado en base de datos no puede invocar código arbitrario si no existe como key del registry.

Intents actuales:

| Intent | Resultado |
| --- | --- |
| `qwall.pass_rate_today` | Pass rate y total inspeccionado del día |
| `qwall.pass_rate_range` | Pass rate y total inspeccionado de los últimos 7 días |
| `qwall.target_progress` | Comparación contra target |
| `qwall.top_fail_mode` | Fail mode principal |
| `qwall.rejects_summary` | Rechazos del día y últimos 7 días |
| `qwall.worst_part_number` | Parte con más fallas |
| `qwall.worst_inspection_point` | Punto de inspección con más fallas |
| `qwall.pass_rate_today_vs_yesterday` | Comparación hoy contra ayer |
| `qwall.best_worst_bu_today` | Mejor y peor BU del día |
| `qwall.static_semaforo` | Respuesta estática |
| `qwall.static_download_pdf` | Respuesta estática |

Las métricas dinámicas reutilizan `QWallService`; el chatbot no debe duplicar cálculos de dominio.

## Validación de templates

`ChatbotTemplateValidationService` verifica:

- que `service_method_ref` exista;
- que respuestas `text` tengan plantilla en español e inglés;
- que las variables entre llaves estén declaradas en `intent.output_fields`.

Para `media_list` no se valida interpolación de texto.

Django Admin usa la misma validación al guardar templates.

La acción administrativa `revalidate-all/` revalida templates activos y desactiva los incompatibles.

## Administración

Django Admin registra:

- `ChatbotQuestionTemplate`;
- `ChatbotFeedback`;
- `ChatbotSuggestion`.

Un template puede modificarse sin deploy si continúa utilizando un intent existente y mantiene un contrato válido.

Agregar una métrica nueva requiere agregar código al registry y sus pruebas.

## Frontend

`ChatbotWidget` se monta globalmente en `AppShell`, pero retorna `null` fuera de las rutas Q-Wall/Rejections.

Tiene tres pestañas:

- FAQ;
- historial;
- feedback.

Las preguntas se presentan como chips predefinidos. Existe un retraso visual de aproximadamente 550 ms antes de mostrar una respuesta; no representa procesamiento adicional del backend.

### Historial

`askedHistory` vive únicamente en estado React.

No existe persistencia de conversaciones en PostgreSQL, localStorage o una API de historial. Un refresh elimina la conversación visible.

### Feedback

El frontend actual envía `question_key` y `was_helpful`.

El backend acepta `filters_snapshot`, pero el cliente no lo envía.

La caja de texto de la pestaña feedback crea una sugerencia. No funciona como entrada conversacional.

## Idioma

El frontend envía `en` si el idioma comienza con `en`; en cualquier otro caso envía `es`.

El backend usa campos españoles únicamente cuando `locale == "es"`; en otro caso utiliza inglés.

## Seguridad

Los endpoints requieren autenticación.

Además, `ChatbotService` filtra templates por los slugs de roles del usuario cuando `role_slugs_allowed` contiene valores.

No existe en las vistas del chatbot un permiso de dominio adicional a `IsAuthenticated`.

La ejecución de funciones queda limitada por `CHATBOT_SERVICE_REGISTRY`; `service_method_ref` no se evalúa dinámicamente como código.

## Caché

`useChatbotPreload` utiliza React Query con:

- `staleTime` de 5 minutos;
- `refetchOnWindowFocus=false`.

La key de caché incluye `module` y `locale`.

`ChatbotService` del backend no implementa por sí mismo un caché alrededor de la resolución de templates. Cualquier caché utilizado por servicios de dominio pertenece a esas capas.

## Manejo de fallos

Durante la precarga:

- intent inexistente: se registra warning y se omite la pregunta;
- filtros requeridos por el intent ausentes: se omite la pregunta;
- error en el service call: se registra excepción y se omite la pregunta;
- error interpolando variables: se registra excepción y se omite la pregunta.

El fallo de una pregunta no invalida necesariamente toda la lista.

El frontend ignora silenciosamente un error al enviar thumbs up/down después de actualizar el estado visual local.

## Fixture

`chatbot_questions_fixture.json` contiene templates iniciales de Q-Wall.

Debe revisarse antes de utilizarse como seed portable porque:

- el contenido español versionado presenta caracteres mojibake;
- contiene una referencia fija en `created_by`;
- la carga depende de que exista el usuario referenciado.

## Limitaciones y deuda

### required_filters no usa la configuración del modelo

`ChatbotQuestionTemplate.required_filters` está almacenado en base de datos, pero `ChatbotService` verifica `intent.required_filters` del registry.

Modificar el campo del template no cambia actualmente el gating de filtros.

En la versión revisada todos los intents registran `required_filters=set()`.

### config_params tiene infraestructura, pero no uso efectivo actual

`template.config_params` se entrega a cada `service_call`, pero los intents actuales no utilizan configuración dinámica relevante.

### media_list no está completo de extremo a extremo

El modelo, serializer lógico y tipo TypeScript contemplan `media_list` y `media`.

`ChatbotWidget` renderiza respuestas con `answer` y no implementa una vista para `media`.

No debe considerarse funcional un template `media_list` hasta completar el frontend.

### No existe conversación libre

El sistema actual es una interfaz de preguntas registradas, no un motor NLP ni un agente.

## Pruebas

No existe una suite específica de chatbot dentro de `apps/backend/apps/quality/tests`.

Cobertura prioritaria:

1. filtrado por roles;
2. intent inexistente;
3. excepción aislada por pregunta;
4. validación de variables;
5. idioma español e inglés;
6. feedback sobre templates activos e inactivos;
7. sugerencias vacías;
8. contrato de filtros requeridos;
9. soporte `media_list`;
10. visibilidad del widget por ruta.

## Regla de extensión

Para agregar una pregunta basada en un intent existente basta con crear un template válido.

Para agregar una capacidad nueva:

1. implementar la función en la capa adecuada;
2. registrarla en `CHATBOT_SERVICE_REGISTRY`;
3. declarar `output_fields`;
4. declarar filtros requeridos;
5. reutilizar servicios de dominio;
6. crear o actualizar el template;
7. mantener español e inglés;
8. agregar pruebas;
9. actualizar este documento.

La lógica de negocio de Q-Wall debe permanecer en sus services; el chatbot debe limitarse a orquestar y presentar resultados.
