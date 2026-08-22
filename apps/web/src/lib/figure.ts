/* Generador de personajes de agente — versión plana y minimalista.
   Silueta de color sólido, siempre del mismo tamaño, con una "corona" arriba y "pies" abajo que varían,
   y dos ojos de punto negro. Determinista por seed → cada agente nace con una variación única.
   Referencia: siluetas planas tipo mascota (naranja con bucles, verde con hojas). */

export type Crown = "flat" | "bumps" | "leaves" | "ears" | "dome" | "antenna" | "horns" | "tuft"
export type Feet = "flat" | "feet" | "round" | "notch"

export interface FigureParams {
  seed: string
  color: string
  ink: string
  crown: Crown
  feet: Feet
  /** cantidad de bucles/hojas cuando aplica */
  count: number
  /** radio de esquina del cuerpo (0..1 relativo al ancho) */
  corner: number
  eyes: { y: number; gap: number; r: number }
}

/** Paleta juguetona (sólida, saturada). Cada entrada: nombre, relleno, tinta legible sobre blanco. */
export const FIGURE_COLORS = [
  { name: "coral", fill: "#e8764f", ink: "#b8452a" },
  { name: "verde", fill: "#5ec27f", ink: "#237a44" },
  { name: "amarillo", fill: "#f6c23c", ink: "#8a6200" },
  { name: "azul", fill: "#5b93ea", ink: "#2552b4" },
  { name: "lila", fill: "#a587e6", ink: "#5f3fb5" },
  { name: "rosa", fill: "#f08db3", ink: "#b43a72" },
  { name: "teal", fill: "#45bdb5", ink: "#1e7d77" },
  { name: "naranja", fill: "#f3a03d", ink: "#a35f0c" },
  { name: "rojo", fill: "#ef6b6b", ink: "#b73a3a" },
  { name: "lima", fill: "#8fcf4a", ink: "#4c7f16" },
] as const

import type { FigureColorName } from "@ada/protocol"
export type { FigureColorName }
// chequeo estático: los nombres de FIGURE_COLORS tienen que coincidir con el protocolo
type _Check = (typeof FIGURE_COLORS)[number]["name"] extends FigureColorName ? true : never
const _check: _Check = true
void _check

function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rng(seed: string) {
  let a = hash(seed) || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const between = (r: () => number, a: number, b: number) => a + (b - a) * r()
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)]

export function figureParams(seed: string, colorName?: FigureColorName): FigureParams {
  const r = rng(seed)
  const rolled = pick(r, FIGURE_COLORS)
  const { fill: color, ink } = (colorName && FIGURE_COLORS.find((c) => c.name === colorName)) || rolled
  const crown = pick(r, ["flat", "bumps", "leaves", "ears", "dome", "antenna", "horns", "tuft"] as const)
  const feet = pick(r, ["flat", "feet", "round", "notch"] as const)
  const count = crown === "bumps" ? Math.round(between(r, 3, 5)) : crown === "leaves" ? Math.round(between(r, 2, 3)) : 2
  return {
    seed,
    color,
    ink,
    crown,
    feet,
    count,
    corner: between(r, 0.22, 0.42),
    eyes: { y: between(r, 0.3, 0.5), gap: between(r, 0.3, 0.42), r: between(r, 0.055, 0.07) },
  }
}

/* ---- Geometría (caja 0..100; cuerpo fijo: x 14..86, y 22..92) ---- */

export const BODY = { x: 14, y: 22, w: 72, h: 70 } as const

/** Dibuja la silueta completa (cuerpo + corona + pies) como elementos SVG en forma de datos. */
export function silhouette(p: FigureParams) {
  const { x, y, w, h } = BODY
  const rad = p.corner * w
  const shapes: Array<{ kind: "rect"; x: number; y: number; w: number; h: number; r: number } | { kind: "circle"; cx: number; cy: number; r: number } | { kind: "path"; d: string }> = []
  const cuts: Array<{ kind: "circle"; cx: number; cy: number; r: number } | { kind: "rect"; x: number; y: number; w: number; h: number; r: number }> = []

  // cuerpo
  shapes.push({ kind: "rect", x, y, w, h, r: rad })

  // corona
  const cx = x + w / 2
  if (p.crown === "bumps") {
    const n = p.count
    const bw = (w - 16) / n
    for (let i = 0; i < n; i++) {
      const bx = x + 8 + bw * i + bw / 2
      shapes.push({ kind: "circle", cx: bx, cy: y + 2, r: bw / 2 })
    }
  }
  if (p.crown === "leaves") {
    const n = p.count
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * 0.62
      const len = 30
      const tx = cx + Math.sin(a) * len
      const ty = y + 8 - Math.cos(a) * len
      const px = Math.cos(a) * 13
      const py = Math.sin(a) * 13
      shapes.push({
        kind: "path",
        d: `M${cx} ${y + 10} Q${(cx + tx) / 2 - px} ${(y + 10 + ty) / 2 - py} ${tx} ${ty} Q${(cx + tx) / 2 + px} ${(y + 10 + ty) / 2 + py} ${cx} ${y + 10} Z`,
      })
    }
  }
  if (p.crown === "ears") {
    shapes.push({ kind: "circle", cx: x + 14, cy: y + 2, r: 11 })
    shapes.push({ kind: "circle", cx: x + w - 14, cy: y + 2, r: 11 })
  }
  if (p.crown === "dome") {
    shapes.push({ kind: "circle", cx, cy: y + 6, r: w / 2 - 4 })
  }
  if (p.crown === "antenna") {
    shapes.push({ kind: "rect", x: cx - 2, y: y - 12, w: 4, h: 16, r: 2 })
    shapes.push({ kind: "circle", cx, cy: y - 14, r: 5 })
  }
  if (p.crown === "horns") {
    shapes.push({ kind: "path", d: `M${x + 10} ${y + 6} L${x + 18} ${y - 10} L${x + 26} ${y + 6} Z` })
    shapes.push({ kind: "path", d: `M${x + w - 26} ${y + 6} L${x + w - 18} ${y - 10} L${x + w - 10} ${y + 6} Z` })
  }
  if (p.crown === "tuft") {
    shapes.push({ kind: "path", d: `M${cx - 6} ${y + 6} Q${cx - 2} ${y - 14} ${cx + 10} ${y - 8} Q${cx + 2} ${y - 4} ${cx + 6} ${y + 6} Z` })
  }

  // pies
  if (p.feet === "feet") {
    cuts.push({ kind: "circle", cx, cy: y + h, r: 13 })
  }
  if (p.feet === "notch") {
    cuts.push({ kind: "rect", x: cx - 16, y: y + h - 9, w: 32, h: 20, r: 9 })
  }
  if (p.feet === "round") {
    cuts.push({ kind: "rect", x: x - 2, y: y + h - 10, w: 18, h: 20, r: 9 })
    cuts.push({ kind: "rect", x: x + w - 16, y: y + h - 10, w: 18, h: 20, r: 9 })
  }

  return { shapes, cuts }
}
