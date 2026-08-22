# data/ — los cursos (la memoria vive acá, no en la DB)

**Hoy:** solo la estructura del curso semilla `redes-neuronales-2c-2026`, vacía. El contenido (documento base, `community.json`, `CLAUDE.md` del agente) se crea en el grupo 3 de `openspec/changes/demo-local-backend/tasks.md`.

**Layout por curso** (`DECISIONS.md` §6):

```
data/<curso>/
  community.json                 ← curso, canales, personas, agentes (con token del runner)
  raw/<persona>/...              ← documentos base; los humanos escriben acá, los agentes solo leen
  agents/<agente>/
    CLAUDE.md                    ← reglas + instrucciones del agente (las lee su runtime)
    wiki/                        ← la memoria compilada: index.md, log.md, modulos/, preguntas/, decisiones/, dificultades/
    about/                       ← lo que el agente sabe de cada persona
```

Principios: todo markdown legible (`ls` es la interfaz de auditoría), git como versionado (un commit por corrida del runner, en el repo que contenga la carpeta), el server solo guarda la **copia publicada** de cada ficha. En el repo público este curso es **de ejemplo**: en uso real la carpeta vive donde vive el runner, fuera del repo de código (`docs/como-funciona.html` §4).

**Cómo crece (idea, no código):** un repo git por curso, `people/<alumno>/wiki` para agentes personales, permisos por composición de carpetas (bind mounts / Archil) — `DECISIONS.md` §14.7.
