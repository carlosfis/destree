# Uso del lienzo

## Recorrido de 10 minutos
### Si eres Viewer (Lev1)
1. **Entrar**: abre la URL de tu organización, pon el correo y la contraseña que creaste al aceptar la invitación. Si la olvidaste, pide a un admin una temporal (o usa «¿Olvidaste tu contraseña?» si el correo está configurado).
2. **Orientarte**: el lienzo muestra el árbol de software de la página actual. Arriba a la izquierda, `⌂` abre el **lobby** con todas las páginas que puedes ver. Rueda = desplazar, Ctrl/⌘+rueda = zoom, `Shift+1` = ajustar todo.
3. **Encontrar lo tuyo**: pulsa `★ Mías` (o `#/me`). Verás las cards donde eres responsable o estás asignado, en cualquier página; cada una te lleva al lienzo centrado en esa card.
4. **Leer una ficha**: doble clic (o Enter) sobre una card abre el sidebar con cuatro pestañas: **General** (tipo, descripción, imagen, etiquetas, DS que usa o fuente), **Staff** (`@usuario / rol`, responsable, asignados), **Documentación** (enlaces a Figma, Notion, repos…) y **Notas**.
5. **Entender las líneas**: continua = usa su Design System; discontinua = usa el DS de otro software; punteada = el UI Kit deriva de esa fuente. `⇢ ocultas` indica conexiones con cards que no puedes ver.
6. **Historial**: `⟲ Historial` lista las versiones de la página; puedes ver cualquiera y compararla con la actual (restaurar es de nivel Head o superior).
7. **Tus cards**: en las cards donde eres responsable o estás asignado, el doble clic (o **Editar** en la ficha) abre un editor acotado: nombre, descripción, imagen, etiquetas, staff, documentación, notas y thumbnail. Tipo, contenedor, relaciones y visibilidad no se tocan.

### Si eres Lead, Head u Ops (edición)
1. **Crear una página** (Ops o Admin): `⌂` → `＋ Nueva página` (una por cliente o área). En `⚙ Página` van descripción (Ops) y visibilidad (Head o superior: toda la organización o solo ciertas células). Un Lead solo ve y edita las páginas de sus células o donde está asignado.
2. **Main instance**: `＋ Nueva card` → Software. Es una raíz: una aplicación o producto. Ponle nombre, descripción, imagen (se muestra como hero) y etiquetas.
3. **Anidar**: dentro de la raíz, `＋` (o arrastrar una card dentro) crea **Child instances**: features, forks, versiones mobile… con su tipo de ramificación.
4. **Design System y UI Kit**: crea un DS dentro del software que lo mantiene; conecta otros softwares arrastrando desde un puerto («usa DS»). Un UI Kit siempre tiene **fuente** (el DS o software del que deriva).
5. **Staff y responsables**: pestaña Staff → `@usuario / rol` (texto libre), responsable y asignados (usuarios reales; aparecen en `★ Mías` de cada uno). Visibilidad de la raíz: organización o células.
6. **Documentación**: pestaña Documentación → enlaces (hasta 20) y Notas en markdown. Todo se guarda solo («Guardado» arriba).
7. **Historial**: `⟲ Historial` → «Crear versión» con etiqueta antes de un cambio grande; «Cambios» muestra el diff; «Restaurar» vuelve atrás sin perder nada (crea una versión de restauración).
8. **Equipo**: `⚑ Admin → Usuarios` para invitar roles por debajo del tuyo (un Lead invita Viewers a sus células); `Células` para gestionar miembros (Head crea células; Lead solo las suyas). Admin y Ops gestionan la plantilla completa en `⌂ → Organización`.

## Conceptos
- **Software** (contenedor): aplicación, módulo o feature. Puede ser **raíz** o vivir dentro de otro software (eso es una *ramificación*, con su tipo: feature, fork, versión mobile…).
- **Design System** y **UI Kit**: viven dentro de un software. Un software *usa* uno o varios DS (línea continua; discontinua si el DS vive en otra raíz). Un UI Kit *deriva de* una fuente (DS u otro software).
- **Nombres de tipo**: en `Administrar → Tipos` puedes renombrar Software / Design System / UI Kit por página (p. ej. Producto / Librería / Plantilla). El nombre cambia en cards, menús, editor, leyenda y avisos; las reglas de anidación y de fuente se mantienen.
- **Página**: un lienzo independiente (p. ej. por cliente o área). Cambia de página desde `⌂`.

## Niveles de rol
Cinco niveles fijos, cada uno incluye lo del inferior: **Lev5 Admin** (todo, incluida la organización), **Lev4 Ops** (todo lo operativo: páginas, plantilla, respaldos), **Lev3 Head** (ve todo, invita, asigna, visibilidad y células; no crea ni borra páginas), **Lev2 Lead** (solo sus páginas; edita su interior, asigna, invita Viewers), **Lev1 Viewer** (solo sus páginas; edita sus cards). Los nombres visibles (salvo Admin) los cambia un Admin en `⌂ → Organización`, donde está la tabla completa de capacidades.

## Crear y editar (Lead, Head, Ops, Admin)
- `＋ Nueva card` o clic derecho en el fondo → **Main instance** (software raíz). Dentro de un contenedor: botón `＋` o menú `⋯` → Child instance (feature, DS o UI Kit).
- Doble clic / Enter / `⋯ → Editar` abre el **sidebar** de la instancia (**Main instance** si es raíz, **Child instance** si vive dentro de un contenedor), con pestañas: **General** (tipo, nombre, contenedor padre, descripción, imagen, etiquetas, DS que usa / fuente), **Staff** (usuario `@nombre` + rol, p. ej. `@Lorena / UX Designer`; responsable, asignados y **visibilidad de la raíz**), **Documentación** (enlaces) y **Notas** (markdown: títulos, listas, enlaces, código, negrita).
- Si la card tiene imagen se muestra arriba como **hero** (también en la cabecera de los contenedores).
- Una página sin cards muestra una guía centrada con el botón **＋ Nueva Main instance** (en modo lectura, un aviso).
- Arrastra una card dentro de otro contenedor para anidarla, o fuera para sacarla a raíz. Arrastra desde un puerto para conectar.
- `⇅ Auto-layout` ordena todo. Ctrl/⌘+Z deshace. Todo se guarda solo ("Guardado" arriba).

## Thumbnail para Figma
En el editor de una instancia, pestaña **General**, al final hay la sección **Thumbnail**: una vista previa 1920×1080 que se redibuja con los datos del formulario (nombre, contenedor, etiquetas, staff, geografía e icono).
- **Geografía**: país (bandera) que aparece junto al tipo. **Icono**: imagen propia para el thumbnail (mejor PNG con fondo transparente); si no eliges ninguna se usa la imagen de la instancia.
- **Copiar thumbnail** copia el PNG al portapapeles: en Figma pega (⌘/Ctrl+V) dentro de un frame y usa «Set as thumbnail». **Descargar PNG** guarda el archivo (útil en Firefox antiguo o si el navegador no permite copiar imágenes).
- Los Viewers tienen los mismos botones en la ficha de lectura (pestaña General).

## Ver (Viewer) y editar lo propio
Modo lectura: pan/zoom, doble clic o Enter abren la **ficha** en el sidebar, con las mismas pestañas (General, Staff, Documentación, Notas). Solo ves las raíces de la organización, las de tus células y aquellas donde estás asignado o eres responsable (un Lead ve lo mismo, pero edita); en tus propias cards el doble clic abre el editor acotado y la ficha muestra **Editar**. `⇢ ocultas` indica conexiones con elementos que no ves.

## Mi cuenta (chip de usuario)
Pulsa tu nombre arriba a la derecha: cambia tu **nombre** o tu **contraseña** (actual, nueva, repetir; mínimo 8). Al cambiar la contraseña se cierran tus demás sesiones; también puedes cerrarlas sin cambiarla con **Cerrar las demás sesiones**. Si la olvidaste: «¿Olvidaste tu contraseña?» en el login (cuando la instalación tiene correo) o pide a un admin una temporal desde Administración → Usuarios.

## Mis asignaciones (`★ Mías` o `#/me`)
Lista de cards donde eres responsable o asignado en todas las páginas; cada una centra el lienzo en la card.

## Atajos
`?` muestra la lista. Rueda: desplazar · Ctrl/⌘+rueda: zoom · Espacio+arrastrar o `H`: mano · `V`: selección · Shift+1 ajustar · Shift+2 ajustar a selección · Supr eliminar · Ctrl/⌘+D duplicar · `E`/Enter editar · Esc cierra menús, el sidebar, el lobby o la administración y vuelve al lienzo.
