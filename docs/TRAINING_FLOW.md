# Flujo de la Sección `/training`

## Resumen del Flujo

La sección `/training` combina datos estáticos (JSON) con datos dinámicos (Base de Datos) para mostrar la planificación activa del usuario.

## Arquitectura de Datos

### 1. **Datos Estáticos (JSON)**

- **Ubicación**: `public/data/trainings.json`
- **Contenido**: Plantillas de entrenamientos base con ejercicios, series, repeticiones, etc.
- **Estructura**: `TrainingMap` - Un objeto donde cada clave es un tipo de entrenamiento (ej: "ENTRENAMIENTO A", "ENTRENAMIENTO B")
- **Propósito**: Proporciona la estructura base de ejercicios que se reutiliza

### 2. **Datos Dinámicos (Base de Datos)**

- **Tablas involucradas**:
  - `planning_assignments`: Asigna macrociclos a usuarios y marca cuál está activo
  - `macrocycles`: Planificación de alto nivel (temporada, fechas, objetivos)
  - `mesocycles`: Subdivisiones del macrociclo
  - `microcycles`: Subdivisiones del mesociclo (semanas)
  - `sessions`: Sesiones individuales de entrenamiento

## Flujo Paso a Paso

### Paso 1: Usuario accede a `/training`

```
/training/page.tsx
  └─> TrainingPlanner (componente)
```

### Paso 2: TrainingPlanner carga los datos

```typescript
// 1. Obtiene el usuario actual
const { user } = useAuthStore();

// 2. Carga el JSON base (plantillas)
const baseTrainings = await fetch("/data/trainings.json");

// 3. Obtiene la planificación activa del usuario
const activeTrainings = await getActiveTrainingPlan(user.id, baseTrainings);
```

### Paso 3: getActiveTrainingPlan (función clave)

Esta función combina datos estáticos y dinámicos:

```typescript
getActiveTrainingPlan(userId, baseTrainings)
  │
  ├─> 1. Busca asignación activa del usuario
  │     getActivePlanningForUser(userId)
  │     └─> Busca en planning_assignments donde:
  │         - user_id = userId
  │         - is_active = true
  │     └─> Retorna: { macrocycle_id, user_id, is_active }
  │
  ├─> 2. Si NO hay planificación activa:
  │     └─> Retorna baseTrainings completo (fallback)
  │
  └─> 3. Si HAY planificación activa:
        │
        ├─> Obtiene todas las sesiones del macrociclo
        │   listSessionsByMacrocycle(macrocycle_id)
        │
        ├─> Obtiene mesociclos y microciclos
        │   listMesocyclesByMacrocycle(macrocycle_id)
        │   listMicrocyclesByMesocycle(meso_id)
        │
        ├─> Agrupa sesiones por session_type
        │   (session_type = "ENTRENAMIENTO A", "ENTRENAMIENTO B", etc.)
        │
        └─> Filtra y combina:
            - Solo incluye entrenamientos que tienen sesiones en la BD
            - Usa los microciclos de la BD (no los del JSON)
            - Mantiene los ejercicios del JSON base
```

### Paso 4: Resultado Final

El resultado es un `TrainingMap` que:

- ✅ Tiene solo los entrenamientos que están en el macrociclo activo
- ✅ Usa los microciclos definidos en la BD
- ✅ Mantiene los ejercicios, series y repeticiones del JSON base

## Ejemplo Práctico

### Escenario: Usuario tiene un macrociclo activo

1. **En la BD**:

   ```
   planning_assignments:
     - user_id: "user-123"
       macrocycle_id: "macro-456"
       is_active: true

   sessions (del macrociclo):
     - session_type: "ENTRENAMIENTO A"
       microcycle_id: "micro-1"
     - session_type: "ENTRENAMIENTO B"
       microcycle_id: "micro-2"
   ```

2. **En el JSON** (`trainings.json`):

   ```json
   {
     "ENTRENAMIENTO A": {
       "exercises": [...],
       "microcycles": ["Semana 1", "Semana 2", ...]
     },
     "ENTRENAMIENTO B": { ... },
     "ENTRENAMIENTO C": { ... }
   }
   ```

3. **Resultado en `/training`**:
   - Solo muestra "ENTRENAMIENTO A" y "ENTRENAMIENTO B"
   - Los microciclos vienen de la BD (no del JSON)
   - Los ejercicios vienen del JSON base

## Puntos Clave

### ✅ Ventajas de este enfoque:

1. **Flexibilidad**: Los ejercicios base están en JSON (fácil de editar)
2. **Personalización**: La estructura (macrociclo, mesociclo, microciclo) está en BD
3. **Filtrado**: Solo muestra lo que está asignado al usuario

### ⚠️ Limitaciones actuales:

1. Los ejercicios siempre vienen del JSON (no se pueden personalizar por macrociclo)
2. Si no hay macrociclo activo, muestra TODO el JSON
3. La relación entre `session_type` y las claves del JSON debe coincidir exactamente

## Cómo se relaciona con la Gestión

En `/admin` → Gestión:

- Puedes ver qué macrociclo está activo para cada usuario
- Puedes editar el macrociclo activo
- Puedes asignar/desasignar macrociclos a usuarios

Cuando editas un macrociclo:

- Cambias la estructura (mesociclos, microciclos, sesiones)
- NO cambias los ejercicios (esos vienen del JSON)
- Los cambios se reflejan en `/training` del usuario asignado
