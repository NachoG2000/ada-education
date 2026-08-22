/* Comunidad de demo — todo sintético (ver PRODUCT.md → Evidence on Hand).
   Curso: Redes Neuronales, 2C 2026. Agente del curso: "Ada" (azul), el agente por defecto de la comunidad. */

import type { Community, Message, Page } from "./types"

const T = (text: string) => ({ kind: "text" as const, text })
const C = (text: string, pageId: string, section?: string) => ({
  kind: "cite" as const,
  text,
  cite: { pageId, section },
})
const K = (text: string) => ({ kind: "code" as const, text })

const pages: Page[] = [
  {
    id: "p-guia",
    channelId: "dudas",
    title: "Guía de dudas frecuentes",
    type: "apunte",
    authorId: "martin",
    version: 4,
    visibility: "canal",
    sources: [{ kind: "archivo", ref: "guia-dudas.md", label: "guia-dudas.md" }],
    base: true,
    publishedAt: "2026-08-03T10:00:00-03:00",
    body: `## 1. Antes de preguntar\nBuscá en las fichas del canal. Si la duda ya está, el agente te va a responder desde ahí.\n\n## 2. Learning rate\nSi la loss oscila, bajá el learning rate un orden de magnitud. Si se queda quieta, subilo.\n\n## 3. Por qué se promedia la loss por batch\nPara que el learning rate no dependa del tamaño del batch. Con suma, un batch de 256 mueve los pesos 256 veces más que uno de 1.`,
  },
  {
    id: "p-vanishing",
    channelId: "dudas",
    title: "Vanishing gradient",
    type: "apunte",
    authorId: "ada",
    version: 2,
    visibility: "canal",
    sources: [
      { kind: "mensaje", ref: "m-old-1", label: "Tomás · 12/08" },
      { kind: "archivo", ref: "clase-06.pdf", label: "clase-06.pdf" },
    ],
    publishedAt: "2026-08-14T18:20:00-03:00",
    body: `## 1. Qué es\nEn una red profunda, el gradiente de las primeras capas es un producto de muchas derivadas. Si cada factor es menor que 1, el producto tiende a cero.\n\n## 2. El producto de jacobianos\nLa derivada de la sigmoide está acotada por 0.25. Diez capas de sigmoide multiplican, como mucho, 0.25¹⁰ ≈ 10⁻⁶. Con ReLU el factor es 0 o 1, y el problema cambia de forma: no se achica, se apaga.\n\n## 3. Qué hacer\nInicialización cuidada (Xavier/He), ReLU o variantes, normalización por capa, conexiones residuales.`,
  },
  {
    id: "p-explota",
    channelId: "dudas",
    title: "¿Por qué explota el gradiente?",
    type: "respuesta",
    authorId: "ada",
    version: 1,
    visibility: "canal",
    sources: [
      { kind: "mensaje", ref: "m-sofia-q", label: "Sofía · hoy 10:03" },
      { kind: "mensaje", ref: "m-ada-a1", label: "Ada · hoy 10:04" },
    ],
    state: "nueva",
    publishedAt: "2026-08-22T10:06:00-03:00",
    body: `## Respuesta corta\nNo es la sigmoide en sí: es el **producto de jacobianos** en la cadena. Con un learning rate de 0.5, cada paso amplifica un error que ya venía grande desde la última capa, y en tres épocas la loss se va a \`nan\`.\n\n## Qué mirar\n1. Cómo se multiplican las derivadas capa a capa → *Vanishing gradient*, §2.\n2. Por qué la escala inicial de los pesos importa tanto → *Inicialización de pesos*, §1.\n\n## Qué probar\n\`lr = 0.1\` con inicialización Xavier. Si sigue explotando, es el batch: revisá que estés promediando la loss y no sumándola.`,
  },
  {
    id: "p-init",
    channelId: "dudas",
    title: "Inicialización de pesos",
    type: "respuesta",
    authorId: "ada",
    version: 3,
    visibility: "canal",
    sources: [{ kind: "mensaje", ref: "m-old-2", label: "Lucía · 09/08" }],
    publishedAt: "2026-08-10T16:40:00-03:00",
    body: `## 1. Escala inicial\nSi los pesos arrancan grandes, las activaciones saturan y los gradientes explotan o se apagan. Xavier (tanh/sigmoide) y He (ReLU) eligen la varianza inicial para que la señal conserve su escala capa a capa.`,
  },
  {
    id: "p-batch",
    channelId: "dudas",
    title: "Promediar la loss por batch",
    type: "respuesta",
    authorId: "ada",
    version: 1,
    visibility: "canal",
    sources: [{ kind: "mensaje", ref: "m-tomas-q", label: "Tomás · ayer 18:42" }],
    publishedAt: "2026-08-21T18:50:00-03:00",
    body: `Se promedia para que el learning rate no dependa del tamaño del batch.`,
  },
]

const messages: Message[] = [
  {
    id: "m-tomas-q",
    channelId: "dudas",
    authorId: "tomas",
    at: "2026-08-21T18:42:00-03:00",
    paragraphs: [
      [T("¿Alguien entendió por qué hay que promediar la loss por batch? En la clase Martín lo dijo al pasar.")],
    ],
    threadId: "t-batch",
  },
  {
    id: "m-ada-batch",
    channelId: "dudas",
    authorId: "ada",
    at: "2026-08-21T18:44:00-03:00",
    paragraphs: [
      [
        T("Corto: para que el learning rate no dependa del tamaño del batch. Con suma, un batch de 256 mueve los pesos 256 veces más que uno de 1. Está con el ejemplo numérico de la clase en "),
        C("Guía de dudas frecuentes", "p-guia", "§3"),
      ],
    ],
    threadId: "t-batch",
    reactions: [
      { emoji: "👍", count: 4 },
      { emoji: "🙏", count: 1 },
    ],
  },
  {
    id: "m-sofia-q",
    channelId: "dudas",
    authorId: "sofia",
    at: "2026-08-22T10:03:00-03:00",
    paragraphs: [
      [
        T("Cuando subo el learning rate a "),
        K("0.5"),
        T(" la loss se va a "),
        K("nan"),
        T(" en tres épocas. Bajándolo a "),
        K("0.01"),
        T(" anda. ¿Por qué explota el gradiente? ¿Es por la sigmoide?"),
      ],
    ],
    threadId: "t-explota",
  },
  {
    id: "m-ada-a1",
    channelId: "dudas",
    authorId: "ada",
    at: "2026-08-22T10:04:00-03:00",
    threadId: "t-explota",
    paragraphs: [
      [
        T("No es la sigmoide en sí, es el producto de jacobianos en la cadena. Con lr = 0.5 cada paso amplifica un error que ya venía grande desde la última capa."),
      ],
      [T("Dos cosas para mirar:")],
      [T("1. Cómo se multiplican las derivadas capa a capa → "), C("Vanishing gradient", "p-vanishing", "§2")],
      [
        T("2. Por qué la escala inicial de los pesos importa tanto → "),
        C("Inicialización de pesos", "p-init", "§1"),
      ],
      [T("Probá "), K("lr = 0.1"), T(" con inicialización Xavier. Si sigue explotando, es el batch.")],
    ],
  },
  {
    id: "m-sofia-a2",
    channelId: "dudas",
    authorId: "sofia",
    at: "2026-08-22T10:05:00-03:00",
    threadId: "t-explota",
    paragraphs: [[T("Ahh, con Xavier ya no da nan. Gracias!")]],
  },
  {
    id: "m-ada-a3",
    channelId: "dudas",
    authorId: "ada",
    at: "2026-08-22T10:06:00-03:00",
    threadId: "t-explota",
    paragraphs: [[T("Lo dejo archivado, seguro vuelve a aparecer.")]],
  },
  {
    id: "m-ada-pub",
    channelId: "dudas",
    authorId: "ada",
    at: "2026-08-22T10:06:00-03:00",
    paragraphs: [],
    publishes: "p-explota",
  },
  {
    id: "m-tomas-2",
    channelId: "dudas",
    authorId: "tomas",
    at: "2026-08-22T10:21:00-03:00",
    paragraphs: [[T("Me pasó lo mismo ayer con ReLU, así que no es solo la sigmoide 👀")]],
  },
]

export const demo: Community = {
  id: "redes",
  name: "Redes Neuronales",
  subtitle: "2C 2026 · 31 miembros",
  initial: "R",
  meId: "sofia",
  members: [
    { kind: "person", id: "martin", name: "Martín", initials: "M", tone: "rojo-soft", role: "profesor", presence: "en-linea" },
    {
      kind: "agent",
      id: "ada",
      name: "Ada",
      scope: "comunidad",
      createdBy: "martin",
      figureSeed: "ada-01",
      figureColor: "azul",
      instructions: "Mantener las fichas del curso: responder dudas citando fichas, y archivar como respuesta lo que vuelve a aparecer.",
      provider: { mode: "suscripcion", model: "Claude" },
      channelIds: ["general", "dudas", "m01", "m02", "m03", "tp2"],
      presence: "publicando",
    },
    { kind: "person", id: "sofia", name: "Sofía", initials: "S", tone: "sello-soft", role: "alumno", presence: "en-linea" },
    { kind: "person", id: "tomas", name: "Tomás", initials: "T", tone: "cartulina", role: "alumno", presence: "en-linea" },
    { kind: "person", id: "lucia", name: "Lucía", initials: "L", tone: "ficha", role: "alumno", presence: "ausente" },
    {
      kind: "agent",
      id: "tutor-sofia",
      name: "Tutor de Sofía",
      scope: "personal",
      createdBy: "sofia",
      figureSeed: "tutor-sofia-02",
      instructions: "Explicarme las cosas con ejemplos numéricos chicos antes que con fórmulas.",
      provider: { mode: "api-key", model: "Claude" },
      channelIds: ["dm-tutor"],
      presence: "ausente",
    },
  ],
  channels: [
    { id: "general", name: "general", group: "curso", memberIds: [] },
    {
      id: "dudas",
      name: "dudas",
      group: "curso",
      description: "Preguntá lo que sea. Ada responde y archiva lo que vale la pena.",
      memberIds: ["martin", "ada", "sofia", "tomas", "lucia"],
      memberCount: 31,
    },
    { id: "m01", name: "01-perceptrón", group: "curso", memberIds: [] },
    { id: "m02", name: "02-mlp", group: "curso", memberIds: [] },
    { id: "m03", name: "03-backprop", group: "curso", memberIds: [], unread: true },
    { id: "profes", name: "profesores", group: "curso", memberIds: [] },
    { id: "tp2", name: "TP2 · Backprop a mano", group: "trabajo", memberIds: [], work: { status: "activo", due: "12 sep" } },
    { id: "tp1", name: "TP1 · Perceptrón", group: "trabajo", memberIds: [], work: { status: "entregado" } },
    { id: "parcial1", name: "Parcial 1", group: "trabajo", memberIds: [], work: { status: "archivado" } },
    { id: "dm-tutor", name: "Tutor de Sofía", group: "privados", memberIds: ["sofia", "tutor-sofia"] },
    { id: "dm-martin", name: "Martín", group: "privados", memberIds: ["sofia", "martin"] },
  ],
  pages,
  messages,
  threads: [
    { id: "t-batch", rootMessageId: "m-tomas-q", replyIds: ["m-ada-batch"], publishedPageId: "p-batch" },
    {
      id: "t-explota",
      rootMessageId: "m-sofia-q",
      replyIds: ["m-ada-a1", "m-sofia-a2", "m-ada-a3"],
      publishedPageId: "p-explota",
    },
  ],
}

export const PAGE_TYPE_LABEL: Record<Page["type"], string> = {
  apunte: "apunte",
  consigna: "consigna",
  decision: "decisión",
  respuesta: "respuesta",
  entrega: "entrega",
}
