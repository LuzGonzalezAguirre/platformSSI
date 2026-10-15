# CRUD de localidades — Warehouse Storage Designer

## Gestión

Ruta: Warehouse → Storage Utilization → Settings → Warehouse Designer.
Requiere permiso `warehouse.edit` para agregar, editar, eliminar y mover racks.

- **Agregar:** nombre de localidad (1–80 caracteres) y cantidad de niveles (1–20).
- **Editar:** permite cambiar nombre y cantidad de niveles sin cambiar la identidad interna del rack ni su posición.
- **Eliminar:** borra el rack y sus niveles asociados tras confirmación. Operación irreversible.
- Los nuevos niveles se crean sin pallets; los existentes conservan sus cantidades.
- No se permite reducir niveles si los niveles removidos contienen pallets; vaciar antes.
- Se prohíben nombres duplicados sin distinguir mayúsculas, incluidos nombres heredados `TJR1`–`TJR55`.
- Los números internos de rack permanecen numéricos por compatibilidad. La etiqueta visible es `name` o, para racks heredados, `TJR{number}`.
- El plano conserva posiciones, tamaño y rotación, e incluye las nuevas localidades en la biblioteca.
- El mapa automático representa TJR1–TJR55 en sus zonas y coloca las localidades de número mayor a 55 en «Localidades adicionales».

## API

Endpoint existente `/api/v1/warehouse/storage-utilization/`:
- `GET`: devuelve `racks[]`, cada uno con `name` y `levels[]`.
- `POST {"name":"TJR56","level_count":5}`: crea.
- `PATCH {"number":56,"name":"TJR56-A","level_count":3}`: actualiza.
- `DELETE ?number=56`: elimina.
- `PATCH` existente para `levels`, coordenadas y `designer_enabled` sigue disponible.

## Migración y compatibilidad

La migración `0004_storage_locality_crud.py` agrega `StorageRack.name` y `StorageLayout.initial_racks_seeded`. En bases existentes marca la semilla como completada para preservar datos y no restaurar racks que sean eliminados posteriormente. En nuevas instalaciones la primera lectura crea TJR1–TJR55 y marca la semilla completa.

**Despliegue:** ejecutar `python manage.py migrate` antes de iniciar el backend con este código; reiniciar backend/frontend. Hacer copia de seguridad previa si hay diseños productivos.

## Pendiente de validar

No se han ejecutado los tests/build locales de Django/React en esta sesión; verificar en el entorno instalado: CRUD, mapa con distintos niveles, permisos, posicionamiento y comportamiento tras reinicio.
