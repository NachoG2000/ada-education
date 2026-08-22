# Por qué ahora — timing tecnológico y evidencia de aprendizaje — 2026-08-22

Investigación para reforzar el "por qué ahora" de `PROBLEM.md` §4/§8 y auditar el claim "el problema es la atención / el ritmo". Dos pasadas paralelas (timing tecnológico; evidencia de atención/ritmo/personalización). Verificación: **✓ primaria** · **~ snippet** · **≈ secundaria**.

## 1. Timing tecnológico: por qué esto no se podía construir en 2024

**Capacidad y costo de agentes**
- Anthropic ARR: $87M (ene 2024) → $1B (dic 2024) → ~$30B+ run-rate (abr 2026). Claude Code: $1B anualizado a los 6 meses del launch (feb 2025), ~$2,5B run-rate feb 2026. ✓ (VentureBeat 08/05/2026). La cifra "$8B / 54% share" circula solo en agregadores ~, no usar.
- Codex CLI: lanzado 16/04/2025; 82K → 41,8M descargas a may 2026 ~.
- Colapso de precios por token: GPT-4 (2023) $30/$60 por M in/out → clase 2026 ~$1,25/$10; Claude Opus $15/$75 (2025) → $5/$25 (nov 2025). ~ (trackers de precios, no páginas oficiales). Dirección clara, números no verificados en fuente primaria.

**Estándares e identidad de agentes**
- MCP anunciado por Anthropic el 25/11/2024, con Block como partner de lanzamiento. ✓ (anthropic.com/news/model-context-protocol).
- ACP (Agent Client Protocol, Zed + Gemini CLI) mediados de 2025 ✓ (blog de Zed; fecha exacta de origen sin confirmar); JetBrains co-desarrolla (oct 2025) ~.
- **Buzz de Block (21/07/2026): agentes con identidad criptográfica como miembros de un workspace junto a personas.** ✓ (decrypt.co 22/07/2026). El precedente directo de "agentes como miembros"; nuestro §14 copia su topología.

**Memoria como archivos**
- Claude memory: Team/Enterprise sep 2025 → Pro/Max 23/10/2025 ✓ → todos ~mar 2026 ~. Siempre **por usuario**.
- Claude Managed Agents (23/04/2026): memoria persistente como archivos en filesystem, exportable ~. Paralelo directo a nuestra wiki-como-memoria.
- LLM wiki de Karpathy: ~abr 2026 ~ (tweet ubicado, no fetcheado; ya citado como [C7] en el research de impacto).

**Incumbentes: todos privados-por-alumno**
- Instructure (Canvas) + OpenAI, 23/07/2025: ✓, y el anuncio dice textual que la información del alumno "remains private to the Canvas user" — confirma nuestra tesis de que nada vuelve al grupo.
- Google Classroom + Gemini para todas las ediciones (jun 2025) ~; Moodle 5.0 con subsistema de IA (abr 2025) ~ (versión inconsistente entre fuentes).
- Khanmigo: RCT de dos años (NBER w35620, circulado 17/08/2026, Oreopoulos & Low): ~0,06–0,08 SD/año, ~15% de uso entre quienes lo tienen ~ (id del paper confirmado, PDF no leído). El tutor privado del incumbente más famoso mueve poco la aguja.

**Instituciones: de prohibir a exigir alfabetización**
- UNESCO (02/09/2025): 61% de instituciones de educación superior tienen (19%) o están desarrollando (42%) lineamientos de IA. ✓
- Argentina: programa nacional PaideIA (may 2025) y contenidos de IA obligatorios aprobados por el Consejo Federal (desde ago 2025) ~ (prensa, sin fuente .gob.ar); CABA: alfabetización en IA obligatoria en primaria/secundaria (18-20/08/2026, múltiples medios) ~. Purdue y Ohio State con requisitos de "AI fluency" ~.

## 2. Auditoría del claim "el problema es la atención y el ritmo"

**Atención: real pero sobrevendido**
- Gloria Mark: tiempo ante una pantalla antes de cambiar: 2,5 min (2004) → 75 s (2012) → 47 s mediana 40 s (~2016+) ≈. Mide frecuencia de cambio, **no capacidad de atención**.
- El "goldfish de 8 segundos" no tiene respaldo peer-reviewed ~. Investigadores califican parte del discurso "TikTok brain" de **pánico moral** ≈ (2024).
- Meta-análisis (71 estudios, n=98.299): correlación entre short-video pesado y peor control atencional, con **causalidad inversa probable** ~.
- NAEP ✓ (primaria): lectura de 13 años −4 pts (2020→2023), −7 pts vs década; PISA 2022 −10 pts OCDE, distracción por dispositivos −15 pts controlada por NSE ≈ — pero la caída "solo parcialmente" atribuible a teléfonos.
- Prohibir celulares: el estudio más grande (NBER w34388, 2025) da efectos académicos mixtos/nulos ~.

**Ritmo (aburrirse si va rápido/lento)**
- El "2 sigma" de Bloom (1984) **no replica**: meta-análisis moderno de 96 RCTs de tutoría da ~0,37 SD ≈. El mecanismo "ritmo fijo pierde a ambas puntas" es plausible y consistente con mastery learning, pero **no encontramos RCT de aula a escala que lo pruebe directo**; casi todo lo que lo afirma es marketing edtech.

**Tutoría con IA: la evidencia causal más fuerte del área**
- Harvard (Kestin et al., Scientific Reports jun 2025): >2x aprendizaje en menos tiempo, n=194 ≈ (primaria paywalled). Nigeria (World Bank): ~0,3 SD en 6 semanas, $48/alumno, con sesgo hacia alumnas y mejores promedios ≈. Ya citados como [A7][A8].
- Meta-análisis con 0,7–0,9 SD ~: sospechosos de inflación (solo ~20% de estudios >6 meses).
- **Khanmigo "22% de mejora, n=340.000": no confirmable, rastrea a un blog de marketing. No usar nunca.** Khan Academy misma decía (nov 2024) que los estudios estaban "underway"; el RCT real de 2026 da 0,06–0,08 SD/año.
- Fracasos de "personalización": Summit Learning (walkouts 2018-19, sin mejora sustantiva según Chalkbeat) ≈; AltSchool cerró sus escuelas en 2019 ≈.

**Descarga cognitiva / IA suelta**
- MIT "Your Brain on ChatGPT" (Kosmyna et al., arxiv 2506.08872): menor conectividad EEG y recall en el grupo LLM — **preprint, n=54, preliminar** ~. Microsoft/CMU (feb 2025): menor esfuerzo crítico autorreportado en knowledge workers ≈.
- "Chatbots privados fragmentan el aprendizaje grupal": **no existe estudio directo**; es inferencia razonable desde la literatura de aprendizaje-como-proceso-social ≈. Mantener como inferencia declarada (ya está así en `PROBLEM.md` §10.1).

**Qué nombran las encuestas como problema #1**
- EDUCAUSE 2025/26: confianza institucional (57%→36% en una década) ≈. HEPI 2025: preocupación por acusaciones de misconduct y outputs incorrectos ≈. RAND 2025 (docentes): conducta/disciplina (52-58%), sueldo (39-44%), carga administrativa. **La atención aparece, pero secundaria en todas.**

## 3. Veredicto (aplicado a Ada)

1. **"Crisis de atención" es el framing más débil**: datos reales pero narrativa contestada y en parte pánico moral. No construir el pitch ahí. `PROBLEM.md` §1 ya lo había descartado ("vale para cualquier aula de cualquier década"); esta auditoría lo confirma con fuentes.
2. **El framing defendible sigue siendo el nuestro**: memoria del grupo que se pierde + fuga a chatbots privados (documentada) + sobrecarga docente (el problema mejor evidenciado en encuestas). La fragmentación grupal por chatbots es inferencia y hay que decirlo.
3. **La personalización/tutoría con IA es el arma del rival, no la nuestra**: la evidencia causal fuerte (Harvard, Nigeria) es de tutores **diseñados dentro del curso** — exactamente [A6]: la IA ayuda anclada al curso y daña suelta. Ada usa eso como condición 7.6, no como promesa de "aprendizaje personalizado".
4. Números prohibidos en el pitch: goldfish de 8 s, 2-sigma de Bloom como vigente, Khanmigo 22%, "$8B Claude Code".
