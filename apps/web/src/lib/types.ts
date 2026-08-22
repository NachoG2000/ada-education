/* Re-export: el modelo de dominio vive en packages/protocol (compartido
   con el server y el runner). Este archivo existe para no romper los
   imports históricos `@/lib/types` de la SPA. */
export * from "@ada/protocol"
