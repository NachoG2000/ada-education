---
name: Ada
description: Comunidad de curso donde humanos y agentes conviven en canales y el conocimiento se archiva solo en fichas.
colors:
  ground: "#f3f1ee"
  panel: "#ffffff"
  panel-2: "#f7f6f3"
  panel-3: "#efede8"
  line: "#ebe9e4"
  line-strong: "#dedbd4"
  ink: "#1b1b20"
  ink-2: "#5a5a63"
  ink-3: "#8b8b95"
  ink-4: "#b9b9c2"
  sol: "#ffd43b"
  sol-soft: "#fff3c4"
  sol-ink: "#6f5200"
  sello: "#2f55d4"
  sello-soft: "#e9eefc"
  alerta: "#e0493f"
  alerta-soft: "#fde9e7"
  ok: "#d9f4e6"
  ok-ink: "#1f7a4a"
  tab-apunte: "#d9e8ff"
  tab-apunte-ink: "#1f55a8"
  tab-consigna: "#ffe4c7"
  tab-consigna-ink: "#9a4f0a"
  tab-decision: "#d7f3de"
  tab-decision-ink: "#1f6b3c"
  tab-respuesta: "#fff0b3"
  tab-respuesta-ink: "#7a5a00"
  tab-entrega: "#ffdbe6"
  tab-entrega-ink: "#a8335f"
  estado-activo: "#3fbf6b"
  estado-entregado: "#2f55d4"
  estado-archivado: "#b9b9c2"
typography:
  display:
    fontFamily: "Literata Variable, Literata, Georgia, serif"
    fontSize: "25px"
    fontWeight: 500
    lineHeight: 1.18
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Literata Variable, Literata, Georgia, serif"
    fontSize: "14.5px"
    fontWeight: 500
    lineHeight: 1.25
  prose:
    fontFamily: "Literata Variable, Literata, Georgia, serif"
    fontSize: "15.5px"
    fontWeight: 400
    lineHeight: 1.6
  headline:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.012em"
  body:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "-0.006em"
  ui:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
  code:
    fontFamily: "Geist Mono Variable, Geist Mono, ui-monospace, monospace"
    fontSize: "12.5px"
    fontWeight: 400
rounded:
  panel: "22px"
  card: "16px"
  ficha: "14px"
  control: "10px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.panel}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "32px"
  button-ghost:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "32px"
  pill-state:
    backgroundColor: "{colors.ok}"
    textColor: "{colors.ok-ink}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "22px"
  tab-type:
    backgroundColor: "{colors.tab-apunte}"
    textColor: "{colors.tab-apunte-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 16px 0 12px"
    height: "22px"
  ficha-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "14px 16px"
  ficha-card-nueva:
    backgroundColor: "{colors.sol}"
    textColor: "{colors.sol-ink}"
    rounded: "{rounded.card}"
    padding: "14px 16px"
  composer:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px 16px"
---

# Design System: Ada

## Overview

**Creative North Star: "El fichero"**

Ada toma la lógica de un fichero — fichas clasificadas por la pestaña de color, estados que se sellan, agentes que archivan — y la ejecuta con el material de la referencia `design/inspiration/01`: un lavado de color de fondo (rosa → lavanda → menta → amarillo), paneles blancos que flotan con radio grande y sombra difusa, pestañas plegadas con el corte diagonal, un amarillo pleno que marca lo nuevo y pills pastel que dicen el estado. Colorido y juguetón con confianza, a la par de Berd y Buzz, sin look de "app de IA": nada de violeta en gradiente, sparkles ni burbujas.

La personalidad vive en los **agentes**: cada uno es un personaje procedural plano (`src/lib/figure.ts`) — una silueta de color sólido y vivo, siempre del mismo tamaño, con una "corona" arriba (bucles, hojas, orejas, antena, cuernos, mechón, domo) y "pies" abajo (patas, arco, redondeados), y dos ojos de punto negro. Sin degradados, sin sombras, sin bocas: minimalista, tipo mascota. Generado por seed, así que cada agente nuevo nace distinto y se puede "tirar otra". Las personas son círculos pastel con iniciales. La conversación se queda en conversación (texto plano) y las fichas son documentos en serif: ese contraste sigue siendo el diseño.

**Key Characteristics:**
- Fondo lavado de color; paneles blancos flotantes (radio 22 px, sombra suave); aire generoso.
- Pestaña plegada de color = tipo de ficha; el corte diagonal es la firma estructural.
- Amarillo pleno (#ffd43b) para lo nuevo y para "ya en el fichero"; pills pastel para estados.
- Agentes = siluetas planas de color vivo con dos ojos, todas del mismo tamaño; personas = círculos pastel.
- Botón primario negro en pill; el azul de sello solo para foco y links.
- Inter para la UI, Literata para fichas, Geist Mono para código.

## Colors

Estrategia **Full palette con roles**: neutros cálidos, un amarillo protagonista, un negro para acciones, cinco colores de pestaña y pills pastel de estado.

### Primary
- **Sol** (#ffd43b / tinta #6f5200): la ficha nueva entera, el pill "Nueva", el pill "Ya en el fichero", el resaltado del mensaje raíz (`sol-soft` #fff3c4), la marca de la comunidad. Es el color con confianza de la referencia; aparece una vez por pantalla como máximo en superficie grande.
- **Tinta** (#1b1b20): botón primario (pill negra), canal activo en el sidebar, pestaña activa del panel, líneas de rayos X.

### Secondary — pestañas por tipo de ficha
- **Apunte** (#d9e8ff / #1f55a8) · **Consigna** (#ffe4c7 / #9a4f0a) · **Decisión** (#d7f3de / #1f6b3c) · **Respuesta** (#fff0b3 / #7a5a00) · **Entrega** (#ffdbe6 / #a8335f). Solo en pestañas plegadas y en el punto de las citas.

### Tertiary — estado y acción
- **Ok** (#d9f4e6 / #1f7a4a): "Archivada", entregado. **Alerta** (#fde9e7 / #e0493f): errores. **Sello azul** (#2f55d4): foco, links, canal entregado.
- Tintas de agente: cada personaje toma un par [relleno, tinta] de la paleta juguetona `FIGURE_COLORS` (coral, verde, amarillo, azul, lila, rosa, teal, naranja, rojo, lima); la tinta colorea su nombre.

### Neutral
- **Suelo** (#f3f1ee) bajo el lavado · **Panel** (#ffffff) · **Panel 2** (#f7f6f3) franja de fichas, hover, composer · **Panel 3** (#efede8) pills grises, código · **Línea** (#ebe9e4) · **Tinta 2/3/4** (#5a5a63, #8b8b95, #b9b9c2).

### Named Rules
**The Tab Rule.** Un color de tipo aparece solo como pestaña plegada o como punto de una cita. Nunca en fondos de panel, botones ni texto.

**The One Sun Rule.** El amarillo pleno cubre una sola superficie grande por pantalla (la ficha nueva) y los pills del momento "ya en el fichero". Más de eso y deja de señalar.

## Typography

**Display Font:** Literata Variable (opsz) — títulos y cuerpo de fichas.
**Body Font:** Inter Variable (opsz) con `cv11`, `ss01`, `tnum` — toda la UI.
**Label/Mono Font:** Geist Mono Variable — código inline y versiones.

**Character:** un sans claro y amable para operar, una serif de lectura para lo que se archiva, mono solo donde hay código. Tres voces con trabajos fijos.

### Hierarchy
- **Display** (Literata 500, 25 px, 1.18): título de la ficha abierta.
- **Headline** (Inter 600, 19 px, −0.012 em): nombre del canal.
- **Title** (Literata 500, 14.5–19 px): ficha en fila (14.5, dos líneas), cita (13.5), tarjeta-mensaje (19).
- **Prose** (Literata 400, 15.5 px, 1.6, máx. 68 ch): cuerpo de ficha.
- **Body** (Inter 400, 14.5 px, 1.55): mensajes.
- **UI** (Inter 400/500/600, 13.5 px): sidebar, nombres, botones (12.5 px 500).
- **Label** (Inter 600, 11 px, 0.04 em, MAYÚSCULAS): secciones del sidebar, "Fichas", pestañas (10–10.5 px). Con moderación.
- **Meta** (Inter 400, 12 px): versión · autor · fuentes.

### Named Rules
**The Three Voices Rule.** Literata = lo que se lee y se archiva. Inter = lo que se conversa y se opera. Geist Mono = código y versión.

## Layout

Tres paneles flotantes sobre el lavado de color, con 16 px de aire: cajones (264 px) · canal (mín. 560 px) · panel contextual (416 px). Dentro del canal: cabecera (19 px), **franja de fichas** sobre panel-2 con radio 16 (tres fichas de 82 px + "+N"), conversación en filas de 36 px de avatar con 8 px de aire, composer en panel-2 con radio 16. El canal activo del sidebar es una pill negra. Ritmo de 4 px; más aire arriba de un título que abajo. Solo desktop.

## Elevation & Depth

Flotante y suave. Tres sombras: **panel** (`0 1px 2px rgba(24,24,36,.04), 0 18px 40px -22px rgba(24,24,36,.22)`) para los tres paneles; **card** (`0 1px 2px …, 0 8px 20px -12px rgba(24,24,36,.18)`) para fichas, tarjetas y el botón de thread; **pop** para overlays. Los personajes llevan su propia sombra elíptica. Sin bordes de 1 px salvo hairlines internos (`line`).

### Named Rules
**The Float Rule.** Lo que se puede tocar flota (sombra card); lo que contiene flota más (sombra panel); el resto es plano sobre panel-2.

## Shapes

Radios grandes: paneles 22 px, tarjetas 16 px, fichas 14 px, controles 10 px, pills y botones 999 px. La pestaña plegada usa `clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)` y esquina superior izquierda de 10 px; la ficha pierde ese radio donde nace la pestaña. Personajes: contornos blandos irregulares (blob, squircle, drop, bean, cat) con detalles opcionales.

## Components

### Buttons
- **Primary:** pill negra (tinta), 32 px, Inter 500 12.5 px, texto blanco; hover 85 %.
- **Secondary / thread:** pill blanca con sombra card; hover panel-2.
- **Ghost (acciones del panel):** pill transparente, tinta 2; activa = negra.
- **Focus:** anillo 2 px sello azul.

### Tab (pestaña plegada)
- 22 px (18 px chica), Inter 600 10.5 px mayúsculas, fondo y tinta del tipo, corte diagonal a la derecha. Siempre pegada arriba a la izquierda de su ficha.

### Pill
- 22 px, Inter 600 12 px, radio completo. Tonos: sol (nueva, ya en el fichero), ok (archivada), gris (visibilidad, compilando con punto pulsante), azul (actualizada), alerta.

### Ficha en fila
- 82 px, título Literata 14.5 en dos líneas, meta abajo. Nueva = fondo sol completo con "Nueva" a la derecha. Activa = anillo 2 px tinta. Documento base = panel-2 sin sombra con hairline.

### Cita
- Pill de 24 px sobre panel-2 con el punto del tipo, título Literata 13.5 y § en mono.

### Tarjeta-mensaje de ficha
- 520 px, pestaña plegada, título Literata 19, meta, botón "Abrir" negro. Nueva = fondo sol.

### Mensaje
- Avatar 36 px (personaje o círculo) · nombre Inter 600 13.5 (agente en su tinta) · hora 11.5 tinta 4 · cuerpo Inter 14.5. Sin burbujas ni filetes. Raíz del thread abierto sobre sol-soft con radio 16.

### Panel contextual
- Pestañas como pills (activa panel-3). Thread: raíz sobre panel-2, respuestas compactas (30 px), tarjeta final con pill "Archivada". Ficha: pestaña + tarjeta de título (sol si es nueva), tabla de metadatos con el personaje del autor a 40 px, cuerpo Prose, pie de acciones en pills.

### Personaje de agente (firma)
- `Figure` renderiza `figureParams(seed)`: cuerpo fijo (72×70 en caja de 100) con radio de esquina variable, corona y pies dibujados por máscara SVG (uniones y recortes), relleno sólido de `FIGURE_COLORS`, dos ojos negros (#15151a) con posición y separación variables. Sin degradados ni sombras. Tamaños 20–96 px; idéntico a cualquier escala.

### Rayos X de fuentes (firma)
- "Ver fuentes" atenúa el canal a 22 % salvo los mensajes de origen (fondo sol-soft) y dibuja curvas negras de 1.5 px con punto amarillo en el destino.

## Do's and Don'ts

### Do:
- **Do** dejar que el fondo lavado se vea entre paneles; es parte del carácter.
- **Do** usar el amarillo pleno una vez por pantalla en superficie grande.
- **Do** dar a cada agente su personaje por seed y su tinta derivada.
- **Do** clasificar con la pestaña plegada y contar estado con pills; nada de chips cuadrados.
- **Do** animar solo estados: archivar (360 ms), sellar (380 ms), rayos X (300 ms).

### Don't:
- **Don't** usar gradientes violeta, sparkles, burbujas de chat, "powered by" ni badges "BOT".
- **Don't** poner colores de tipo fuera de pestañas y puntos de cita.
- **Don't** volver a bordes de 1 px como sistema de profundidad ni a densidad de 28 px por fila.
- **Don't** dibujar en los agentes nada más que la silueta y dos ojos: sin bocas, cachetes, degradados ni sombras.
- **Don't** titular fichas en Inter ni poner Literata en controles.
