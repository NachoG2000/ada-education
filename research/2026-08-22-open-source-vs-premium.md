# Open source amplio vs. premium a colegios top — 2026-08-22

Investigación para la decisión de posicionamiento del pitch (`DECISIONS.md` §16). Verificación: **✓ primaria** · **~ snippet** · **≈ secundaria**.

## Opción A: vender caro a colegios privados de élite

- Ciclos de venta K-12 en EE.UU.: 6–18 meses, comités de 5-7 personas, presupuesto anual jul-jun ~ (dato de distritos públicos; **no hay dato específico de colegios privados de élite** — flag).
- Argentina: ~3M de 11M alumnos en educación privada (INDEC 2021); los colegios de élite (Lincoln ~US$33,4k/año, San Andrés, Northlands) existen como mercado ~ (Bloomberg Línea).
- Alpha School / 2 Hour Learning: US$10k–75k/año ✓ — pero es una cadena de escuelas propias, no un proveedor SaaS: evidencia débil para nuestra vía.
- **No encontramos evidencia** sobre si un equipo de 2 personas sin marca es creíble en ese canal; los requisitos de privacidad de datos y confianza institucional hacen dudarlo (inferencia, no dato).

## Opción B: open source amplio, bottom-up, monetizar hosting después

- **Moodle**: gratis desde 2002; 500M+ usuarios registrados, 147k sitios (2026); monetiza vía MoodleCloud + red de partners certificados; en la GSV 150 de 2026 (requiere revenue de decenas de millones) ~. **El precedente con la misma secuencia que planeamos** (§4 open-core): gratis → hosting/partners → revenue institucional.
- **WordPress/Automattic**: GPL 2003 → WordPress.com 2005 → VIP enterprise 2012 → valuación $7,5B ≈. El análogo dev-tools más nítido de "abierto primero, enterprise después".
- **GitLab**: $81M (FY20) → $955M (FY26), >$1B ARR ~. **Supabase**: $30M ARR (2024) → ~$170M (2026 est.) ≈ — con conversión free→paid lenta: el free tier masivo precede a la plata por años. **Ghost**: nonprofit, ~$7,5M/año autosuficiente con hosting ~ — el modelo "quedarse chico y abierto" también existe.
- Contraejemplos que obligan a decidir con cuidado: **Sakai** (comunidad sin motor comercial → declive) ~; **Cal.com se cerró en may 2026** ~ (open-core no es un estado final garantizado); **Open edX**: adopción plana, le cuesta convertir universidades ~.
- Bottom-up docente: **Kahoot** demuestra el riesgo del otro extremo — uso gigante gratis (9B+ quizzes) y monetización "envenenada": los docentes no pagan ~. La lección: el que paga no es el docente, es la institución que quiere hosting/soporte (modelo Moodle), no el usuario enamorado.

## Contexto hackathon

- Aleph (Crecimiento, BA, 20-23/08/2026): criterios listados en DoraHacks: **Technicality, Originality, UI/UX/DX** ~ (no verificado en fuente oficial). Nada de modelo de negocio.
- Investigación general de hackathons: ganar premios no predice supervivencia a 5 meses; la diversidad de skills del equipo y un dueño con nombre después del evento sí ≈.

## Lectura

1. La evidencia para B es abundante y positiva; para A es escasa y mayormente en contra (ciclos largos, comités, credibilidad de equipo chico sin marca).
2. Ningún LMS open source monetizó vendiéndole caro a colegios de élite uno por uno; todos lo hicieron con hosting + partners.
3. A y B no son excluyentes sino **secuenciales**, y la secuencia tiene nombre: Moodle (y WordPress). Eso ya es lo que dice `DECISIONS.md` §4 ("el hackathon demuestra (a) local; el producto vende (c) hosted").
4. Para el jurado de Aleph, la narrativa B (open source, demo técnica, originalidad "agentes como miembros + memoria en archivos") apunta directo a los tres criterios listados.
5. El colegio de élite no desaparece: es un **early customer del tier hosted** en el futuro (paga por agentes gestionados, backups, analíticas), no el pitch de hoy.
