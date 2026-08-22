# Product

> Documento de producto (dirección e ideas): describe el producto completo, incluido lo que todavía no existe. **No representa el código actual.** Estado real: `AGENTS.md` + `openspec/`. Alcance vigente del finde: `DECISIONS.md` §15 (desarrollo local para un profesor puntual).

<!-- impeccable:product-schema 1 -->

## Platform

web

Web app empaquetada después como desktop con Tauri (como Buzz y Berd de Block). El wrapper no cambia el lenguaje de diseño: se diseña para web, tema claro por defecto. No hay versión móvil en alcance.

## Users

Dos usuarios primarios que alternan el punto de vista según la pantalla; ninguno manda sobre el otro.

- **Profesor (ej. Martín).** Crea la comunidad del curso, sus canales y sus agentes; publica material, consignas y decisiones; abre canales de trabajo para TPs y evaluaciones. Domina las pantallas de gestión de agentes, configuración de canal, canal de trabajo y decisiones.
- **Alumno (ej. Sofía).** Pregunta en canales, abre threads, sube apuntes, entrega páginas de tipo *entrega*, y puede tener un canal privado con un agente que configuró para sí. Domina las pantallas de onboarding por invitación, #dudas con thread y "la misma pregunta, segunda vez".

Situación: un curso universitario en marcha (el ejemplo de la demo es Redes Neuronales), con 20-40 miembros, durante el cuatrimestre. Idioma de UI y contenido: español rioplatense (voseo).

Audiencia secundaria: jurado de una hackathon de 24 horas que ve una demo guiada.

## Product Purpose

Ada es una comunidad de aprendizaje para un curso donde humanos y agentes de IA conviven en canales, y donde el conocimiento del curso se compila solo en **páginas** que nacen y crecen mientras la gente habla.

En una frase: el profesor crea agentes y los agrega a canales como si fueran ayudantes; las páginas del curso (apuntes, consignas, decisiones, respuestas, entregas) se publican en los canales y se mantienen solas.

Éxito en la demo: que el jurado vea, sin explicación, que (1) los agentes son miembros creados por la comunidad, (2) el conocimiento vive en páginas publicadas en canales, (3) las respuestas de los agentes citan páginas y, cuando la pregunta ya fue respondida, responden *desde la página*, y (4) hay canales estables del curso y canales de trabajo que nacen, viven y se archivan. El momento clave de la demo es la pantalla "la misma pregunta, segunda vez".

## Positioning

- **No hay "el bot".** Cada comunidad crea los agentes que quiera, cada uno con nombre propio, identidad, instrucciones, proveedor y canales específicos. Un agente puede estar en `#dudas` y no en `#profesores`. Se distinguen sutilmente de las personas, no con un badge "BOT".
- **Las páginas son el producto del chat.** Un agente que aprende algo publica o actualiza una página, en vivo, con versión, fuentes y visibilidad. Una pregunta que el fichero ya cubre se responde componiendo desde las páginas (no pegando una respuesta anterior), y eso se ve; si trae un ángulo nuevo, la página se enriquece.
- **Canales de trabajo volátiles con ciclo de vida** (activo · entregado · archivado), al estilo de los rooms por feature branch de Buzz, pero para TPs, evaluaciones y tareas.
- Referencia estructural declarada: **Buzz** (buzz.xyz, github.com/block/buzz) para comunidades, invitaciones, agentes como miembros y canales/rooms; **Berd** (github.com/block/berd) para gestión de agentes. Ada se posiciona explícitamente sobre esa familia, con su propio sistema de diseño. No es Slack ni Discord con un bot.

## Operating Context

- Comunidad por curso. Entrada por **link de invitación**; identidad local (nombre + avatar) con clave generada en el browser, sin registro por email. Variante: crear una comunidad desde cero.
- Layout de tres columnas: sidebar (selector de comunidad; canales agrupados en *Curso*, *Trabajo*, *Privados*; miembros con personas y agentes mezclados por presencia) · canal (franja de páginas del canal arriba, mensajes abajo) · panel contextual derecho (stack: *Thread*, *Página*; extensible a árbol de páginas e historial).
- Canales estables del curso: `#general`, `#dudas`, `#profesores`, uno por módulo (`#01-perceptrón`, `#02-mlp`, `#03-backprop`…). Canales de trabajo: nacen de una consigna (ej. "TP2 · Backprop a mano") con documento base, fecha de entrega y agentes asignados.
- **Página**: documento markdown publicado en un canal, con título, tipo (`apunte` · `consigna` · `decisión` · `respuesta` · `entrega`), autor (persona o agente), versión, fuentes (mensajes o archivos de origen), "reemplaza a" cuando corresponde, y chip de visibilidad (*miembros del canal* o *solo yo*). Acciones: abrir en el panel derecho, editar (si sos autor), publicar en otro canal, ver historial. Una página publicada aparece también como mensaje-tarjeta en el flujo del canal.
- **Documentos base** de un canal: páginas o archivos que el profesor sube o elige en la configuración del canal; al guardar, el agente del canal empieza a generar páginas a partir de ellos (estado "compilando").
- Presencia de agentes: *en línea*, *pensando*, *publicando una página*.
- Estados que el producto tiene que mostrar: agente compilando; página nueva · actualizada · reemplazada; respuesta en vivo vs. respuesta desde una página; canal de trabajo activo · entregado · archivado; canal recién creado sin páginas.

## Capabilities and Constraints

- **Stack confirmado:** Vite + React 19 + Tailwind CSS v4 + shadcn/ui v4 (primitivas Base UI) como base, con sistema de diseño propio encima. Empaquetado Tauri después. Sin SSR.
- **Entregable de la hackathon:** app funcional con agentes reales — canales, páginas y al menos un agente respondiendo de verdad; la UI se conecta a eso. No es solo un prototipo con mocks.
- **Agentes:** cada agente corre en un **runner** de quien lo creó, que ejecuta el binario del proveedor sin modificar (`claude`, `codex`, `pi`); la credencial (suscripción o API key) vive con ese binario, nunca en Ada (`DECISIONS.md` §14; reglas verificadas en `research/2026-08-22-suscripciones-runners-buzz-pi.md`). Cada agente tiene nombre, avatar, instrucciones, proveedor/credencial y lista de canales donde participa. Hay agentes **de la comunidad** (creados por el profesor) y agentes **personales** (creados por un alumno para su canal privado); la diferencia es de producto y debe ser visible.
- Los agentes publican páginas con el mismo mecanismo que una persona.
- Terminología fija (español): comunidad, canal, canal de trabajo, thread, página, tipo de página, documento base, fuentes, "reemplaza a", visibilidad, agente, miembros, entrega, compilando, "desde la página".
- **Fuera de alcance (no diseñar):** pantalla de permisos (el modelo completo no está definido; solo existe el chip de visibilidad), settings generales, notificaciones, búsqueda global, móvil, corrección de entregas.
- Decisiones abiertas: nombre del agente de ejemplo del curso (en el brief original se llamaba "Ada", pero Ada es el producto y los agentes llevan nombres propios distintos); modelo de permisos completo; tema oscuro (solo si sale natural).

## Brand Commitments

- **Nombre:** Ada (el producto). Los agentes son muchos y con nombres propios; ninguno se llama Ada.
- **Referencia de familia:** Buzz y Berd (Block) por estructura y por tratar a los agentes como miembros, con sistema de diseño propio de Ada.
- Restricciones visuales fijadas por el fundador (binding): sin look de "app de IA" (nada de gradientes violeta, sparkles ni chat bubbles genéricas), sin look crypto; tono de herramienta de estudio seria y cálida; serif con personalidad solo para títulos y cuerpo de páginas, sans para la UI; jerarquía tipográfica fuerte, pocas cajas y bordes; las páginas se ven como documentos y los mensajes como conversación, y ese contraste es parte del diseño; los agentes se distinguen por forma de avatar o detalle tipográfico, no por badge; tema claro por defecto.
- Decisión del 22/08/2026 (tercera iteración, vigente): el mundo visual es **«El fichero» con el material de la referencia `design/inspiration/01`** — fondo con lavado de color, paneles blancos flotantes con radio grande y sombra suave, pestañas plegadas de color por tipo de ficha, un amarillo pleno como acento, pills pastel para estado. **Colorido y juguetón, a la par de Berd/Buzz**, sin look de "app de IA". Los agentes son **personajes procedurales planos** (silueta sólida de color vivo, mismo tamaño, dos ojos; `src/lib/figure.ts`): cada agente nuevo nace con una variación única por seed y se puede "tirar otra". Tipografías gratuitas de calidad (Inter, Literata, Geist Mono): el fundador pidió "más pro sin pagar". Iteraciones anteriores descartadas: fichas de cartulina con máquina de escribir y caritas (barata), versión sobria plana (sin personalidad).
- Referencias de tono: Buzz (estructura, agentes como miembros), Linear (densidad, tipografía), Obsidian (markdown hermoso).

## Evidence on Hand

- `design/BRIEF.md` — brief original del fundador, iteración inicial a mejorar (no es verdad final de diseño).
- `design/inspiration/01..07-*.png` — siete imágenes de inspiración visual aportadas por el fundador; la 01 es la referencia principal.
- `design/mockups/` — exploración descartada (mockups HTML para Figma); no es autoridad visual ni código del producto.
- **No existe nada real:** curso, personas, mensajes, páginas, métricas y testimonios son ficticios y se presentan como demo. No hay logo ni identidad previa. No inventar testimonios, cifras de adopción ni clientes.

## Product Principles

1. **Los agentes son miembros, no features.** Cada decisión de UI los trata como personas con identidad propia y presencia, distinguidos con sutileza.
2. **Lo que se conversa se vuelve página.** El flujo de chat existe para producir y mantener documentos; la página es el artefacto durable y citable.
3. **Mostrar la procedencia.** Fuentes, versión, "reemplaza a" y "desde la página" son información de primera clase, nunca metadata escondida.
4. **Canales con ciclo de vida.** Lo estable del curso y lo volátil del trabajo se ven y se comportan distinto.
5. **Demo primero.** Ante la duda, priorizar que las cuatro tesis se entiendan sin explicación en 7 pantallas, por sobre cobertura completa.

## Accessibility & Inclusion

Sin requisito específico establecido más allá de buenas prácticas web. Contenido y UI en español rioplatense.
