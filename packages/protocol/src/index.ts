/* @ada/protocol — el único lugar donde vive el modelo de dominio de Ada.
   Lo consumen las tres piezas: apps/web, apps/server y packages/runner.
   Los eventos de la API (REST + WS) se agregan acá cuando se implemente
   el server (openspec/changes/demo-local-backend/specs/community-server). */
export * from "./types.js"
export * from "./events.js"
