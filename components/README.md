# Librería de componentes (Atomic Design)

Estructura nueva, en paralelo a las pantallas existentes en `app/`. Ninguna
pantalla fue reescrita — esto es la base para ir migrando gradualmente.

```
components/
  theme/tokens.ts     ← colores compartidos + hook useTokens()
  atoms/
    Button.tsx
    Input.tsx
    IconButton.tsx
  molecules/
    FormField.tsx      ← label + Input + error
    Card.tsx
  organisms/
    Header.tsx          ← IconButton (back) + título + acciones a la derecha
```

## Cómo importar

```tsx
import { Button, Input, FormField, Card, Header } from '@/components';
```

o de forma más específica:

```tsx
import { Button } from '@/components/atoms';
import { FormField } from '@/components/molecules';
import { Header } from '@/components/organisms';
```

## Ejemplo: cómo se vería vehicle-form.tsx migrado (referencia, no aplicado)

```tsx
import { Button, FormField, Header } from '@/components';

<Header title="Registrar vehículo" onBack={() => router.back()} />

<FormField
  label="Placa"
  value={placa}
  onChangeText={setPlaca}
  autoCapitalize="characters"
  placeholder="ABC12D"
/>

<Button label={guardando ? 'Guardando...' : 'Guardar'} loading={guardando} onPress={handleGuardar} />
```

## Reglas para seguir agregando piezas

- **Atom**: no depende de otros componentes de la app, solo de `theme/tokens`.
  Ej: `Button`, `Input`, `IconButton`, (futuro) `Badge`, `Avatar`.
- **Molecule**: combina 2+ atoms para una unidad con sentido propio.
  Ej: `FormField` (Input + label + error), `Card`.
- **Organism**: combina atoms/molecules en un bloque de UI completo y con
  contexto de la app (pero sigue sin saber de rutas ni de negocio).
  Ej: `Header`.
- **Templates/Pages**: eso sigue siendo `app/*.tsx` (rutas de expo-router) —
  ahí es donde eventualmente se importan estos componentes en vez de tener
  el JSX y los estilos duplicados en cada pantalla.

## Migrar una pantalla existente (cuando decidan hacerlo)

1. Reemplazar el `Field` local de la pantalla por `FormField` del molecule.
2. Reemplazar los `TouchableOpacity` de guardar/enviar por `Button`.
3. Reemplazar el header manual (View con back + título + íconos) por `Header`.
4. Borrar los estilos que ya no se usan en el `StyleSheet.create` de esa
   pantalla.

Se recomienda migrar de a una pantalla por PR/commit, no todas de una vez.
