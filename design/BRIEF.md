# Brief de diseño — Ada (iteración inicial, a mejorar)

> Documento original del fundador, escrito para Claude Design. Se conserva como punto de partida:
> la verdad de producto vive en `PRODUCT.md`; el mundo visual se decide en `DESIGN.md`.
> Las imágenes de inspiración están en `design/inspiration/`.

Quiero diseñar la UI de una web app (que después se empaqueta como desktop con Tauri, igual que Buzz y Berd de Block, así que diseñá para web) para una comunidad de aprendizaje: un curso donde humanos y agentes de IA conviven en canales, y donde el conocimiento se compila solo en páginas que crecen mientras la gente habla. Es para una hackathon de 24 horas: priorizá una dirección visual fuerte y 6-7 pantallas bien resueltas por sobre cobertura completa.

**La referencia principal es Buzz (buzz.xyz, github.com/block/buzz), no Slack.** Estudiá cómo Buzz trata a los agentes como miembros con identidad propia, cómo maneja comunidades e invitaciones, y cómo combina canales estables con rooms volátiles. Para la gestión de agentes, la referencia es Berd (github.com/block/berd).

## Qué es el producto en una frase

Una comunidad de curso donde el profesor crea agentes y los agrega a canales como si fueran ayudantes, y donde las páginas del curso (apuntes, consignas, decisiones, respuestas) se publican en los canales y se mantienen solas.

## Tesis que la UI tiene que hacer evidentes

1. **Los agentes son miembros creados por la comunidad.** No hay "el bot". El profesor (o quien tenga permiso) crea los agentes que quiera, cada uno con nombre, identidad propia, instrucciones, proveedor de modelo, y los agrega a canales específicos. Un agente puede estar en `#dudas` y no en `#profesores`. Se distinguen sutilmente de las personas, no con un badge "BOT" enorme.
2. **El conocimiento vive en páginas publicadas en canales.** Cada canal tiene páginas (como los canvases de Buzz, o los artifacts de Claude): las publica una persona o un agente, tienen versión, fuentes y un chip de visibilidad. Cuando un agente aprende algo, aparece o cambia una página, en vivo.
3. **Las respuestas de los agentes citan páginas.** Y cuando una pregunta ya fue respondida, el agente responde "desde la página", y eso se ve.
4. **Canales estables y canales de trabajo.** Igual que Buzz tiene canales permanentes y rooms volátiles por feature branch, acá hay canales permanentes del curso (`#general`, `#dudas`, uno por módulo) y canales de trabajo que nacen con una tarea, un TP o una evaluación, viven con sus páginas y entregas, y se archivan cuando terminan.

## Personas y agentes (ejemplos, no roles fijos)

- **Martín, profesor.** Crea la comunidad, los canales y los agentes. Publica material, consignas, decisiones.
- **Sofía, alumna.** Pregunta en canales, abre threads, sube apuntes, tiene un canal privado con un agente que ella misma configuró.
- **Agente del curso** (en el brief original se llamaba "Ada"; como Ada es el producto, el agente de ejemplo lleva otro nombre): creado por Martín y agregado a `#general`, `#dudas` y los canales de módulo. Sus instrucciones: mantener las páginas del curso.
- **"Tutor de Sofía"**: un agente que Sofía creó y agregó solo a su canal privado.

## Layout base

```
┌──────────┬────────────────────────┬──────────────────┐
│ Comunidad│ Canal                  │ Panel contextual │
│ Canales  │ mensajes + páginas     │ (thread, página, │
│ Trabajo  │                        │  o vacío)        │
│ Privados │                        │                  │
│ Miembros │                        │                  │
└──────────┴────────────────────────┴──────────────────┘
```

- **Izquierda**: selector de comunidad arriba; canales agrupados en *Curso* (estables), *Trabajo* (volátiles, con estado: activo / entregado / archivado), *Privados* (DMs y canales personales). Miembros con personas y agentes mezclados, ordenados por presencia.
- **Centro**: el canal. Arriba, una franja con las **páginas del canal** (documentos base + páginas publicadas), como pestañas o tarjetas chicas. Abajo, los mensajes. Una página publicada aparece también como un mensaje-tarjeta en el flujo.
- **Derecha, panel contextual**: se abre con un thread (uso principal, igual que Slack/Buzz) o con una página. Diseñalo como un stack de paneles para que en el futuro se agreguen otros (árbol de páginas, historial). Hoy: *Thread* y *Página*.

## Páginas (el mecanismo tipo artifacts)

Una página es un documento markdown publicado en un canal. Tiene: título, tipo (apunte · consigna · decisión · respuesta · entrega), autor (persona o agente), versión, fuentes (links a mensajes o archivos de los que salió), "reemplaza a" si corresponde, y un **chip de visibilidad** (por ahora: *miembros del canal* o *solo yo*; el modelo de permisos completo no está definido, no diseñes una pantalla de permisos).

Acciones sobre una página: abrir en el panel derecho, editar (si sos autor), publicar en otro canal, ver historial. El agente publica páginas con el mismo mecanismo que una persona.

## Pantallas que necesito (en este orden)

1. **Onboarding e invitación.** Llego por link de invitación a una comunidad. Creo mi identidad local (nombre + avatar; la clave se genera en el browser, no hay registro con email). Entro al `#general` del curso. Variante: crear una comunidad desde cero. Referencia: cómo lo hace Buzz web.
2. **Canal `#dudas` con thread abierto.** Sofía pregunta, el agente responde en el thread citando dos páginas. Al final del thread, una tarjeta compacta: "Publicado como respuesta · ¿Por qué explota el gradiente?". En la franja de páginas del canal aparece la nueva, resaltada.
3. **La misma pregunta, segunda vez.** Otro alumno pregunta algo parecido en un thread nuevo. La respuesta tiene un marcador distinto: "Desde la página · hace 2 días". Es el momento clave de la demo.
4. **Gestión de agentes (tipo Berd).** Lista de agentes de la comunidad. Crear uno: nombre, avatar, instrucciones, proveedor (API key o suscripción), canales donde participa. Detalle de un agente: en qué canales está, qué páginas publicó, actividad reciente. Diseñá la diferencia entre un agente de la comunidad (creado por Martín) y uno personal (creado por Sofía para su canal privado).
5. **Editar canal: documentos base.** Settings del canal de módulo `#03-backprop`: nombre, descripción, miembros (personas y agentes), y una sección *Documentos base* donde Martín sube o elige las páginas que definen el canal. Al guardar, el agente empieza a generar páginas a partir de ellos, con un estado discreto de "compilando" en la franja.
6. **Canal de trabajo: un TP.** Martín crea "TP2 · Backprop a mano" desde una consigna. Se crea el canal de trabajo con la consigna como documento base, fecha de entrega, y los agentes asignados. Los alumnos entregan publicando una página de tipo *entrega* con visibilidad restringida. El canal muestra estado (activo / entregado / archivado).
7. **Una decisión.** Martín escribe en `#general` "Muevo el parcial al 15/09, la mitad no llegó a backprop". El agente publica una página tipo *decisión* con rationale y "reemplaza a: parcial-fecha-original". Diseñá cómo se ve una página de decisión abierta en el panel derecho.

## Dirección visual

- **No** quiero look de "app de IA": nada de gradientes violeta, sparkles, ni chat bubbles redondas genéricas. Tampoco look crypto.
- Referencias de tono: Buzz por estructura y por agentes como miembros; Linear por densidad y tipografía; Obsidian por cómo hace que un documento markdown se vea hermoso.
- Sensación: una herramienta de estudio seria, cálida, con algo de asimetría y carácter. Tipografía con personalidad (una serif para títulos de páginas, sans para UI), jerarquía tipográfica fuerte, pocas cajas y bordes.
- Tema claro por defecto; oscuro si sale natural.
- Las páginas tienen que verse como documentos; los mensajes como conversación. Que el contraste entre los dos sea parte del diseño.
- Agentes: avatar con forma distinta (no círculo) o un detalle tipográfico, no un badge. Presencia: "en línea", "pensando", "publicando una página".
- **Agregado después (fundador):** diseño colorido y juguetón, estilo `design/inspiration/01-dashboard-fleet-principal.png` (referencia principal, extrapolada a nuestro caso). El resto de las imágenes de `design/inspiration/` sirven como inspiración de colores pastel y detalles (p. ej. personajes con ojos para los agentes).

## Estados que necesito resueltos

- Agente "compilando" (entre que hay documentos base y aparecen páginas).
- Página nueva · actualizada · reemplazada.
- Respuesta en vivo vs respuesta desde una página.
- Canal de trabajo activo · entregado · archivado.
- Canal recién creado sin páginas.

## Lo que NO necesito

Pantalla de permisos, settings generales, notificaciones, búsqueda global, móvil, corrección de entregas.

## Entregables

1. Flujo de pantallas (diagrama de navegación) para las 7 pantallas.
2. Mockups de alta fidelidad de 2, 3, 4 y 7 primero; después 1, 5, 6.
3. Sistema mínimo: tipografía, paleta, componentes de mensaje (persona / agente / agente desde página), tarjeta de página en el flujo, franja de páginas del canal, ficha de agente, estados de presencia y de canal de trabajo.

Empezá proponiéndome dos direcciones visuales distintas en una sola pantalla (la 2) antes de expandir.
