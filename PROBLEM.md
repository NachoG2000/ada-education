# PROBLEM.md — El problema, antes que la solución

> Documento de contexto e ideas: describe el problema y sus fuentes, no el código. El estado real del código vive en `AGENTS.md` y `openspec/`.

Escrito el 22 de agosto de 2026. Este archivo define **qué problema ataca Ada, a quién le duele, por qué existe y qué cambió para que valga la pena resolverlo ahora**. La solución vive en `DECISIONS.md`; las cifras y fuentes, en `research/2026-08-22-impacto-del-problema-en-2026.md` (las citas tipo `[A2]` apuntan ahí). El antecedente es el TFG de 2024, resumido en `research/2024-11-tfg-siglo21.md`: misma intuición, problema mal planteado, solución descartada.

Regla de uso: **si una feature no ataca algo de la sección 2 o no cumple algo de la sección 7, no va.**

---

## 1. El problema en una frase

Un curso es un grupo de gente que aprende junta, y casi todo lo que entiende junta se pierde: la explicación que por fin hizo que algo cerrara, la razón de una decisión, la pregunta que tres personas hicieron por separado. Queda enterrado en chats, se vuelve a preguntar, no pasa a la cohorte siguiente, y desde 2025 además se desvía a chatbots privados que no conocen el curso y de los que nada vuelve al grupo ni al docente.

El TFG de 2024 decía «los alumnos se distraen y los docentes no dan abasto». Eso es cierto y no sirve: vale para cualquier aula de cualquier década. El problema concreto es **la memoria del grupo**, y tiene cuatro fugas medibles.

## 2. Las cuatro fugas

### 2.1 Se pregunta de nuevo lo que ya se respondió

- En un curso introductorio de programación, dos ediciones consecutivas con el mismo contenido generaron **4.404 preguntas en 2020 y 3.218 en 2021** en el foro oficial. El curso arrancó de cero. `[B1]`
- Cuando una herramienta le muestra al alumno las preguntas parecidas ya respondidas mientras escribe, los posts duplicados **bajan 40%**: cuatro de cada diez preguntas ya tenían respuesta en el mismo foro. `[B2]`
- En Stack Overflow, antes de la IA, **~53%** de las preguntas cerradas se cerraban por duplicadas. `[B4]`
- El staff docente genera ~20% de la actividad de un foro de curso pero cubre ~75% de las respuestas: el costo de la repetición lo paga el docente y el ayudante. `[B3]`

### 2.2 Se pregunta en lugares que no guardan nada

- Preguntados dónde prefieren consultar una duda conceptual, solo **~25%** de los alumnos elige el foro oficial en público; el resto va a un **chat grupal no oficial**, a un grupo chico de amigos, a un post privado o a «otro». Las razones: miedo a «no saber» y a las repercusiones de ser visibles ante la comunidad. `[B1]`
- El chat oficial de la universidad (Teams, 100M estudiantes) es corporativo y está hecho para el flujo, no para la memoria: 153 mensajes de Teams y 275 interrupciones por persona por día en el mundo laboral. `[F4]` `[C4]`
- WhatsApp es la infraestructura real de la cursada en Latinoamérica: avisos, apuntes, entregas; sin búsqueda, sin continuidad, con ruido documentado. `[E11]` `[E12]`
- Discord no es indexable; hacen falta herramientas aparte para «rescatar» lo que se dijo ahí. `[C6]`
- El LMS se usa sobre todo como **repositorio de archivos**, y sus foros están «llenos de respuestas rutinarias, ahora a menudo generadas por IA» mientras los alumnos están en Reddit, Discord o TikTok. `[F2]` `[F3]`
- Los equipos pierden **25%** de su tiempo buscando respuestas; **42%** del conocimiento de una organización vive solo en la cabeza de una persona; 5,3 horas por semana se van en recrear información que ya existía. Son datos del trabajo (2012–2025), no de la universidad, y es exactamente lo que le pasa a una cátedra cuando rota el ayudante. `[C1]` `[C2]` `[C3]`

### 2.3 Desde 2025, se pregunta en privado a una IA que no conoce el curso

Esta es la fuga nueva, la que no existía cuando se escribió el TFG, y la que convierte un problema viejo en uno urgente.

- **88%** de los estudiantes del mundo usa IA para aprender (92% en Latinoamérica), pero **solo 15%** dice que la IA está integrada en muchas de sus materias y **43% en ninguna**. Solo **29%** cree que sus docentes pueden guiarlos. `[A2]` `[A3]`
- Cuando se traban, **29%** recurre **primero a la IA**, más que a los compañeros (15%) o al **material del curso (14%)**. `[A4]`
- Lo que el alumno le pregunta a Claude o ChatGPT se responde sin el apunte del profesor, sin la consigna, sin saber que el parcial se movió; y la respuesta **no vuelve** ni al grupo ni al docente. Todos los tutores de IA disponibles en 2026 (Khanmigo, ChatGPT Edu, Claude for Education, Gemini, Coursera Coach, Canvas, Moodle, Copilot) guardan memoria **por usuario** y, salvo dashboards de supervisión individual, ninguno le muestra al docente **qué no entiende el grupo**. `[D]`
- La evidencia causal es consistente: **la misma IA ayuda cuando está diseñada dentro del curso y perjudica cuando se usa suelta.** Con un GPT genérico, ~1.000 alumnos resolvieron 48% más ejercicios de práctica y rindieron **17% peor** en el examen sin IA; con un tutor anclado en pistas diseñadas por docentes, el daño desaparece. `[A6]` Un tutor a medida del curso en Harvard duplicó el aprendizaje. `[A7]` En Nigeria, tutoría con IA supervisada por docentes equivalió a 1,5–2 años de escolaridad. `[A8]`
- Y darle una IA genérica al docente tampoco alcanza: en un RCT con 193 docentes, los alumnos calificaron esas clases como menos interesantes y menos importantes. `[B8]`
- Solo **45%** de las instituciones de educación superior de la región tiene lineamientos de IA; solo **30%** de los estudiantes latinoamericanos dice que el uso institucional de IA cumple sus expectativas. La institución no ve nada y no decidió nada; mientras tanto, el alumno ya decidió. `[A13]` `[A3]`

### 2.4 Cuando termina el cuatrimestre, no queda nada

- Ningún artefacto sobrevive al cierre del curso: el grupo de WhatsApp se archiva, el foro se clona vacío, el tutor de IA no recuerda a la cohorte anterior porque nunca supo que existía un curso. No encontramos literatura que mida la pérdida entre cohortes; `[B1]` es el proxy más directo, y la ausencia de medición es parte del problema. `[G5]`
- Lo que sí se acumula entre cohortes son los apuntes de fotocopiadora, los Drive heredados y plataformas como Studocu (1,5M usuarios, 14.000 universidades): conocimiento del curso sin autor, sin versión, sin fuente y sin que el docente lo vea. `[C11]` La demanda de memoria compartida existe; la oferta es pirata.

## 3. A quién le duele

**Al alumno.** Pregunta a las 23:00 y nadie responde; pregunta en público y se expone; pregunta en privado a la IA y recibe una respuesta sin contexto que puede contradecir al docente. Lo que entiende no se lo puede llevar ni compartir. `[B1]` `[A4]` `[A6]`

**Al docente y al ayudante.** En Argentina: **13,4 alumnos por docente** a nivel nacional, cátedras del CBC de **~1.500** alumnos, **70%** de los cargos con dedicación simple (pocas horas pagas fuera del aula), una capa de **ayudantes ad honorem** del orden del 20% de los cargos, presupuesto **−33%** real y salario **−34%** real desde 2023, paro nacional en marzo de 2026. `[E3]` `[E4]` `[E2]` `[E5]` `[E7]` `[E8]` Nunca tuvieron menos tiempo para responder lo mismo cinco veces, y nunca tuvieron menos visibilidad de qué está pasando con el grupo, porque el grupo está en otro lado.

**Al grupo y a la cohorte siguiente.** La explicación que funcionó en el thread del martes no existe el jueves. El «por qué se movió el parcial» se pierde. La cohorte 2027 hace las mismas 3.000 preguntas. `[B1]`

**A la institución.** Paga el costo (deserción de ~40% en primer año, 28 de cada 100 ingresantes graduados) sin tener ni política ni datos sobre el cambio más grande en cómo estudian sus alumnos. `[E6]` `[A13]`

## 4. Qué cambió entre el TFG (noviembre 2024) y agosto 2026

| | Noviembre 2024 | Agosto 2026 |
|---|---|---|
| Uso de IA por estudiantes | 66% (HEPI 2024); emergente | 88–92%; universal `[A1]` `[A2]` `[A3]` |
| Uso de IA en evaluaciones | 53% | 88% `[A1]` |
| Integración en las materias | sin dato | 15% «en muchas», 43% «en ninguna» `[A2]` |
| Evidencia causal | casi nada | RCTs en Turquía, Harvard, Nigeria: diseño dentro del curso = ayuda; suelto = daña `[A6]` `[A7]` `[A8]` |
| Memoria de agentes | chats sin memoria; RAG | LLM wiki de Karpathy (abr 2026), memoria en filesystem como corriente, AGENTS.md en 60.000+ repos, ChatGPT/Claude con memoria **por usuario** `[C7]` `[D1]` `[D6]` `[D7]` |
| Agentes como miembros | no existía | Slack + Agentforce (2025), **Buzz de Block (21/07/2026)**, 29.700 estrellas en un mes `[F6]` `[C8]` |
| Agente = CLI sobre una carpeta | no existía | Claude Code / Codex pueden correr sobre una wiki y publicar vía `buzz-acp` `[C8]` |
| Universidad argentina | crisis incipiente | −33% presupuesto, −34% salario, ad honorem como base de la masividad `[E7]` `[E5]` |
| Solución del TFG | LMS + chatbot individual + puntos | descartada: memoria en DB por usuario, el chatbot como pestaña, la conversación sin rastro |

En veinte meses pasaron dos cosas a la vez: **el problema se agravó** (la fuga 2.3 no existía) y **aparecieron las piezas para resolverlo** (agentes con identidad en canales, memoria legible en archivos, un CLI que puede ser el agente). Nadie las juntó para un curso.

## 5. Por qué lo que existe no lo resuelve

| Herramienta | Qué hace bien | Por qué no cierra la fuga |
|---|---|---|
| LMS (Moodle, Canvas, Classroom) | Guarda archivos y notas | Es un repositorio; nadie conversa ahí; los foros están muertos `[F2]` `[F3]` |
| Foros de curso (Piazza, Ed) | Q&A con respuesta rápida | Hilos, no páginas: lo respondido no se compila ni se reemplaza; se migra de un foro a otro igual `[B3]` `[F3]` |
| Chat (WhatsApp, Discord, Teams) | Donde la gente está | Optimiza el ahora; sin búsqueda, sin versión, sin continuidad `[C4]` `[C6]` `[E11]` |
| Tutores IA (Khanmigo, ChatGPT Edu, Claude for Ed, Gemini, Coach) | Explican bien, a cualquier hora | Memoria por usuario, sin material del curso salvo carga manual, el docente no ve el agregado, nada exportable `[D]` |
| AI TAs de investigación (Jill Watson, CS50.ai, Cogniti) | **RAG con citas y abstención funciona**: 76,7% de respuestas aprobadas vs 31,3% de un asistente genérico `[B5]` `[B6]` | Un solo bot propietario, sin memoria entre cohortes, sin páginas que el grupo posea `[B5]` `[B7]` |
| Workspaces con agentes (Buzz, Slack + Agentforce) | Agentes como miembros con identidad y canales | La memoria es un log de eventos, no conocimiento compilado con fuentes y «reemplaza a» `[C8]` `[F6]` |
| LLM wiki, Stash, Obsidian + agentes | Conocimiento compilado en markdown con fuentes | Personal o para equipos de código; sin canales, sin humanos y agentes como pares `[C7]` `[D2]` |

Ninguno cumple a la vez las cuatro condiciones: **agentes como miembros del canal · memoria del grupo, no del usuario · expresada como páginas citables, versionadas y corregibles · en archivos que el grupo posee.** `[D]` `[F]`

## 6. Causas raíz

1. **El chat optimiza el ahora.** El mensaje más nuevo gana; volver a preguntar cuesta lo mismo que buscar en un historial sin estructura, así que se vuelve a preguntar. `[C4]` `[B2]`
2. **Nadie tiene el rol de compilar.** El docente no tiene horas; el ayudante rota y muchas veces no cobra; el alumno no tiene incentivo para documentar para otros. Wikipedia, los wikis de equipo y el LLM wiki funcionan porque *alguien* (persona o agente) convierte la conversación cruda en un artefacto aparte, con fuentes y versión. `[E2]` `[E5]` `[C7]`
3. **La memoria de la IA es privada por diseño de negocio.** La memoria por usuario retiene al usuario; una memoria del grupo en archivos la puede leer cualquiera, incluido un competidor. Por eso ningún proveedor la construyó. `[D7]` `[D]`
4. **El conocimiento del curso no tiene dueño ni formato.** No es un archivo que alguien pueda listar, versionar o llevarse; es filas en la base de datos de un tercero o mensajes en el teléfono de alguien. `[F2]` `[C6]`
5. **Preguntar en público cuesta.** Miedo a quedar expuesto → gana lo privado → lo privado no vuelve. Cualquier solución que exija preguntar en público para «contar» reproduce la fuga. `[B1]`
6. **Buscar en vivo no acumula.** RAG sobre el material redescubre desde cero en cada pregunta; no hay cómputo que se haga una sola vez. `[C7]`

## 7. Qué tiene que ser verdad para que el problema desaparezca

Criterios, no features. Cada uno tiene su contraparte en `DECISIONS.md` §6 (memoria) y en los estados de `PRODUCT.md`.

| # | Criterio | Ataca | Cómo se ve en Ada |
|---|---|---|---|
| 7.1 | Lo que se entendió al responder (el concepto, la conexión entre dos cosas, la dificultad) queda como **ficha legible con fuente**, conectada a las demás, fuera del flujo. La ficha es la comprensión, no la conversación. | 2.1, 6.1, 6.2 | Reglas 3 y 4 del agente; `modulos/…/<tema>.md` + `preguntas/<slug>.md` como índice de ángulos; tarjeta «publicado como respuesta» |
| 7.2 | La segunda vez que alguien pregunta «lo mismo» (otras palabras, otro hueco), el agente **compone una respuesta nueva desde las fichas**, sin volver a las fuentes crudas, y la ficha se enriquece con el ángulo nuevo. Se ve que salió del fichero. **No es un caché de respuestas.** | 2.1, 6.6 | `fromPage`, sello «desde el fichero»: el momento clave de la demo |
| 7.3 | El conocimiento lo **posee el grupo** en un formato que sobrevive a la plataforma y al cuatrimestre. | 2.4, 6.4 | `data/<curso>/…/wiki/*.md` en git; `ls` + `git log` en la demo |
| 7.4 | Preguntar en privado **no implica perder**: el agente personal escribe en la wiki del alumno, y lo generalizable puede subir al grupo. | 2.2, 2.3, 6.5 | Agentes `comunidad` vs `personal`; `people/<alumno>/wiki`; visibilidad |
| 7.5 | El docente ve el **agregado** («qué no entiende el grupo en backprop»), no la vigilancia individual. | 2.3, §3 docente | `dificultades/<modulo>.md`; «quien crea el agente ve lo que el agente escribe» |
| 7.6 | Las respuestas del agente están **ancladas en el material del curso, citan y se abstienen** si no hay fuente. Es lo único que demostró funcionar. `[B5]` `[A6]` | 2.3 | Reglas 1 y 2 del agente; bloques `cite`; documentos base del canal |
| 7.7 | Cuando algo cambia, la página vieja **no se edita: se reemplaza** y queda el rastro. | 2.4, 6.4 | `supersedes`; estado `reemplazada`; páginas tipo `decisión` |
| 7.8 | El agente es **un miembro más**, creado por la comunidad, con nombre y canales; no «el bot» de la plataforma. | 6.3 | Compromiso 1 de `DECISIONS.md`; topología identidad + carpeta + runner (§14) |

Cómo medirlo después, en un curso real (no es el cierre del pitch; es cómo saber si el fichero está vivo): **qué porción de las preguntas de `#dudas` se responde componiendo solo desde fichas, sin volver a `raw/`**; **cuántas fichas se conectan o enriquecen por semana frente a cuántas nacen duplicadas**; y **cuántas sobreviven al cambio de cuatrimestre**. Reusar no es el objetivo; lo es que cada pregunta nueva encuentre comprensión ya compilada sobre la cual componer.

## 8. Visión

> Every group of people who learn together builds up knowledge that mostly disappears. We believe that knowledge should belong to the group, grow on its own, and outlive any single conversation. So we're building a place where humans and AI agents are members of the same community, where what gets understood once becomes something everyone can read, and where the agents remember alongside the people instead of starting over every time.
>
> **Humans and agents learn together, and what they learn stays with them.** (`DECISIONS.md` §1)

Por qué educación: un curso es el caso más puro del problema. Tiene fecha de inicio y de fin, cambia de gente cada cuatro meses, concentra preguntas repetidas por diseño (todos estudian lo mismo a la vez) y hoy es el lugar donde la IA privada ya ganó sin que nadie lo decidiera. Si la memoria compartida entre humanos y agentes funciona acá, funciona en cualquier grupo que aprende.

Por qué ahora: la ventana de veinte meses de la sección 4, que se sostiene en cuatro patas verificables (fuentes y niveles de verificación en `research/2026-08-22-por-que-ahora.md` §1):

1. **El agente-sobre-archivos ya es un producto masivo, no un experimento.** Claude Code pasó de lanzarse (feb 2025) a $1B anualizado en 6 meses; Codex CLI multiplicó descargas ~500x en un año. Un agente que lee y escribe una wiki en una carpeta es hoy tecnología aburrida — y el costo por token cayó más de 10x desde 2023.
2. **Los estándares para "agentes como miembros" tienen meses.** MCP (nov 2024), ACP (2025), y Buzz de Block (21/07/2026): agentes con identidad propia conviviendo con personas en canales. La forma de producto que Ada necesita se volvió legible para el mercado hace semanas.
3. **Los incumbentes eligieron memoria privada, y quedó escrito.** Canvas + OpenAI (jul 2025) declara textual que lo del alumno "remains private to the Canvas user"; Claude/ChatGPT memory es por usuario; el RCT de dos años de Khanmigo (ago 2026) da 0,06–0,08 SD/año con ~15% de uso. La ventana de "memoria del grupo" está vacía no por descuido sino por diseño de negocio (causa raíz 6.3) — un incumbente no la puede copiar sin canibalizar su retención.
4. **Las instituciones pasaron de prohibir a exigir.** UNESCO: 61% de instituciones con lineamientos hechos o en curso (sep 2025); Argentina aprobó contenidos de IA obligatorios (2025) y CABA alfabetización en IA obligatoria (ago 2026). El docente que adopte Ada ya no rema contra la política institucional; la política le pide exactamente esto.

## 9. Qué NO es el problema (y por qué dejamos atrás la solución del TFG)

- **No es (principalmente) atención.** El TFG partía de "los alumnos se distraen"; la evidencia 2024-2026 muestra un cambio real de conducta (cambio de pantalla cada ~47 s, lectura NAEP en baja) pero una narrativa de "crisis de atención" contestada por los propios investigadores (parte es pánico moral; el "goldfish de 8 segundos" no existe; prohibir celulares da efectos mixtos/nulos), y **ninguna encuesta grande a docentes o instituciones la nombra como problema #1** (RAND 2025: conducta y sueldo; EDUCAUSE: confianza; HEPI: misconduct). La atención entra en Ada solo como consecuencia: menos re-preguntar, menos ruido, fichas en vez de scroll. Detalle y fuentes: `research/2026-08-22-por-que-ahora.md` §2.
- **No es motivación.** El TFG proponía puntos y tablero de líderes. El alumno de 2026 no está desmotivado: está resolviendo, en privado, con una IA. El riesgo no es que no participe; es que participe donde nada queda. `[A2]` `[A4]`
- **No es personalización algorítmica por alumno.** Más IA individual sin contexto del curso es exactamente lo que perjudica el aprendizaje. `[A6]` La personalización útil es la del agente personal que escribe en una wiki que el alumno posee (7.4), no un perfil con puntaje.
- **No es corrección automática ni vigilancia.** Ver el agregado, sí; leer los chats privados, no. `[B1]` (el miedo a la visibilidad es causa, no accidente).
- **No es reemplazar al docente.** Es devolverle las horas que gasta repitiendo y la visibilidad que perdió cuando el grupo se fue a WhatsApp y a ChatGPT.
- **No es «mejor búsqueda».** RAG en vivo redescubre; no acumula. `[C7]`
- **No es un caché de respuestas.** Ahorrar trabajo mostrando lo que ya se respondió no es la tesis. Lo que a Sofía le sirvió puede no servirle a Ignacio: él tiene otro hueco y otro lenguaje. La tesis es que la *comprensión* se compila una vez en fichas conectadas, y cada respuesta se compone fresca desde ahí. (`DECISIONS.md`, compromiso 3)
- **No es un chatbot en el LMS.** Canvas + OpenAI, Classroom + Gemini y Moodle AI ya lo hacen: memoria privada por alumno dentro de un repositorio que nadie lee. `[D]` `[F2]`

## 10. Límites de este diagnóstico

Para no sobrevender (detalle en `research/…§G`):

1. Nadie midió directamente que «lo que se aprende en privado con la IA nunca vuelve al grupo». Se infiere de `[A2]` `[A4]` `[B1]`.
2. Los RCTs son de secundaria o de cursos puntuales en otros países; no hay evidencia de universidad argentina.
3. Las cifras de pérdida de conocimiento en organizaciones son de 2012–2018 o de proveedores con interés comercial.
4. No hay dato argentino universitario grande sobre uso de IA; el dato regional (DEC LATAM) no lista países.
5. No hay literatura que mida la pérdida entre cohortes; `[B1]` es un proxy.
6. La evidencia causal de tutoría con IA que citamos (`[A7]` Harvard, `[A8]` Nigeria) la leímos en cobertura secundaria (primarias paywalled/bloqueadas), y los meta-análisis con efectos 0,7–0,9 SD lucen inflados (pocos estudios >6 meses). El mecanismo "ritmo fijo pierde a las dos puntas" es plausible pero sin RCT de aula a escala; el 2-sigma de Bloom no replica (~0,37 SD real).
7. Números que circulan y **no** deben usarse en ningún material: "goldfish de 8 segundos", "2 sigma" como vigente, "Khanmigo +22% (n=340.000)" (rastrea a un blog de marketing), "$8B run-rate de Claude Code".

Lo que la demo del 23/08 puede probar: que 7.1, 7.2, 7.3, 7.6 y 7.7 son posibles hoy con Claude Code sobre una carpeta y nuestro server local como comunidad (`DECISIONS.md` §14-§15). Lo que no puede probar: el impacto en un curso real. Eso es lo primero después de la hackathon.
