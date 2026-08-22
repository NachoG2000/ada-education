/* Modelo de dominio de Ada (ver PRODUCT.md → Operating Context). */

import type { FigureColorName } from "./figure"

export type PageType = "apunte" | "consigna" | "decision" | "respuesta" | "entrega"

export type Visibility = "canal" | "solo-yo"

export type WorkStatus = "activo" | "entregado" | "archivado"

export type Presence = "en-linea" | "ausente" | "pensando" | "publicando"

export interface Person {
  kind: "person"
  id: string
  name: string
  initials: string
  /** color de cartulina del círculo (solo neutros/tintas suaves, nunca colores de pestaña) */
  tone: "ficha" | "cartulina" | "sello-soft" | "rojo-soft"
  role?: "profesor" | "alumno"
  presence: Presence
}

export interface Agent {
  kind: "agent"
  id: string
  name: string
  /** quién lo creó: la comunidad (profesor) o una persona para su canal privado */
  scope: "comunidad" | "personal"
  createdBy: string
  /** seed del personaje procedural (ver lib/figure.ts); por defecto, el id */
  figureSeed?: string
  /** color fijo del personaje (si no, lo decide la seed) */
  figureColor?: FigureColorName
  instructions: string
  provider: { mode: "suscripcion" | "api-key"; model: string }
  channelIds: string[]
  presence: Presence
}

export type Member = Person | Agent

export interface Page {
  id: string
  channelId: string
  title: string
  type: PageType
  authorId: string
  version: number
  visibility: Visibility
  /** ids de mensajes o archivos de los que salió */
  sources: Array<{ kind: "mensaje" | "archivo"; ref: string; label: string }>
  replaces?: string
  /** documento base del canal (no publicado desde la conversación) */
  base?: boolean
  state?: "nueva" | "actualizada" | "reemplazada" | "compilando"
  publishedAt: string
  /** markdown */
  body: string
}

export interface Citation {
  pageId: string
  section?: string
}

export type MessageBlock =
  | { kind: "text"; text: string }
  | { kind: "cite"; text: string; cite: Citation }
  | { kind: "code"; text: string }

export interface Message {
  id: string
  channelId: string
  authorId: string
  at: string
  /** párrafos; cada párrafo es una lista de bloques inline */
  paragraphs: MessageBlock[][]
  threadId?: string
  /** la respuesta sale de una ficha ya existente ("desde la ficha") */
  fromPage?: { pageId: string; ago: string }
  /** el mensaje es la publicación de una ficha */
  publishes?: string
  reactions?: Array<{ emoji: string; count: number }>
}

export interface Thread {
  id: string
  rootMessageId: string
  replyIds: string[]
  /** ficha publicada al cierre del thread */
  publishedPageId?: string
}

export interface Channel {
  id: string
  name: string
  group: "curso" | "trabajo" | "privados"
  description?: string
  memberIds: string[]
  /** total real cuando la lista de ids es parcial (demo) */
  memberCount?: number
  work?: { status: WorkStatus; due?: string }
  unread?: boolean
}

export interface Community {
  id: string
  name: string
  subtitle: string
  initial: string
  members: Member[]
  channels: Channel[]
  pages: Page[]
  messages: Message[]
  threads: Thread[]
  meId: string
}
