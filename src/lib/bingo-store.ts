import fs from "fs";
import path from "path";
import crypto from "crypto";
import { supabase } from "./supabase-client";
import {
  StageType,
  validateTablePattern,
  ValidationResult,
  applyTableMask,
} from "./bingo-patterns";

export type SaasPlanId =
  | "DEMO_GRATIS"
  | "PAQUETE_100"
  | "PAQUETE_300"
  | "PAQUETE_1000"
  | "SUSCRIPCION_MENSUAL";

export interface SaasPlanDefinition {
  id: SaasPlanId;
  name: string;
  priceUsd: number;
  billingPeriod: string;
  maxCardsPerEvent: number;
  maxEvents: number;
  allowSellers: boolean;
  badgeColor: string;
  description: string;
  features: string[];
}

export const SAAS_PLANS: Record<SaasPlanId, SaasPlanDefinition> = {
  DEMO_GRATIS: {
    id: "DEMO_GRATIS",
    name: "Demo Gratis (15 Hojas)",
    priceUsd: 0,
    billingPeriod: "Prueba 1 Solo Bingo",
    maxCardsPerEvent: 15,
    maxEvents: 1,
    allowSellers: false,
    badgeColor: "bg-slate-700 text-slate-200",
    description: "Ideal para probar el bolillero con voz, el lector QR y ver cómo juegan en el celular.",
    features: [
      "1 solo Bingo de prueba",
      "Hasta 15 hojas numeradas (90 juegos en total)",
      "Bolillero con voz en español y verificación automática",
      "Impresión PDF en 1 hoja A4 con QR y vista móvil",
    ],
  },
  PAQUETE_100: {
    id: "PAQUETE_100",
    name: "Paquete 100 Hojas",
    priceUsd: 15,
    billingPeriod: "1 Solo Bingo (1 Evento)",
    maxCardsPerEvent: 100,
    maxEvents: 1,
    allowSellers: true,
    badgeColor: "bg-sky-500 text-slate-950",
    description: "Perfecto para bingos familiares, escolares, de grado o pro-fondos barriales.",
    features: [
      "1 solo Evento (1 Bingo completo)",
      "100 hojas numeradas (#00001 a #00100)",
      "Vendedores con enlaces directos de WhatsApp",
      "Link de elección rápida para que el cliente escoja sus números",
    ],
  },
  PAQUETE_300: {
    id: "PAQUETE_300",
    name: "Paquete 200 a 300 Hojas",
    priceUsd: 25,
    billingPeriod: "1 Solo Bingo (1 Evento)",
    maxCardsPerEvent: 300,
    maxEvents: 1,
    allowSellers: true,
    badgeColor: "bg-amber-400 text-slate-950",
    description: "Para bingos medianos de clubes, fundaciones y colegios con varios vendedores.",
    features: [
      "1 solo Evento (1 Bingo completo)",
      "Hasta 300 hojas numeradas (#00001 a #00300)",
      "Reparto de lotes por rangos a vendedores (trazabilidad)",
      "Cuadre de caja automático y liquidación de comisiones",
    ],
  },
  PAQUETE_1000: {
    id: "PAQUETE_1000",
    name: "Paquete 500 a 1,000 Hojas",
    priceUsd: 40,
    billingPeriod: "1 Solo Bingo (1 Evento)",
    maxCardsPerEvent: 1000,
    maxEvents: 1,
    allowSellers: true,
    badgeColor: "bg-purple-400 text-slate-950",
    description: "Para bingos masivos parroquiales, solidarios cantonales o de alta concurrencia.",
    features: [
      "1 solo Evento (1 Bingo masivo)",
      "Hasta 1,000 hojas numeradas (#00001 a #01000)",
      "Vendedores y cajeros ilimitados con link propio",
      "Candado de IP por comprador y desempate al número mayor",
    ],
  },
  SUSCRIPCION_MENSUAL: {
    id: "SUSCRIPCION_MENSUAL",
    name: "Binguero Frecuente (Mensual)",
    priceUsd: 49,
    billingPeriod: "Por Mes (Bingos Ilimitados)",
    maxCardsPerEvent: 1000,
    maxEvents: 999,
    allowSellers: true,
    badgeColor: "bg-emerald-400 text-slate-950",
    description: "Para bingueros profesionales que transmiten todas las semanas en TikTok y Facebook Live.",
    features: [
      "Bingos ilimitados durante todo el mes",
      "Hasta 1,000 hojas por cada bingo transmitido",
      "Red de vendedores con links propios y trazabilidad",
      "Soporte prioritario y panel multi-bingo continuo",
    ],
  },
};

export interface EventSeller {
  id: string;
  sellerCode: string; // ej. "vend-juan-01" -> abre /vendedor/vend-juan-01
  name: string;
  phone: string;
  commissionPercent: number; // ej. 10%
  active: boolean;
  createdAt: string;
}

export interface SaasOrganizer {
  id: string;
  name: string;
  organizationName: string;
  email: string;
  phone: string;
  accessCode: string;
  planId: SaasPlanId;
  status: "ACTIVO" | "SUSPENDIDO";
  totalPaidUsd: number;
  createdAt: string;
}

export interface BingoTableData {
  tableIndex: number; // 1 a 6
  serialCode: string; // ej. "00001-1"
  grid: number[][];   // Matriz 5x5: -1 = casilla vacía en blanco, 0 = centro BINGO, >0 = número
  signature?: string; // Huella digital canónica de los números activos de esta tabla
}

export interface DeviceSessionLock {
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  lockedAt: string;
  lastSeenAt: string;
}

export interface SelectionLinkSession {
  id: string;
  code: string; // ej. "sel-8f3a1b" -> abre /elegir/sel-8f3a1b
  eventId: string;
  sellerId?: string;
  sellerName?: string;
  buyerName: string;
  buyerPhone: string;
  allowedQuantity: number;
  status: "ACTIVO" | "COMPLETADO" | "CANCELADO";
  selectedCardNumbers: string[];
  finalPlayerToken?: string;
  createdAt: string;
  completedAt?: string;
}

export interface BingoCardSheet {
  id: string;
  cardNumber: string; // ej. "00001"
  secretToken: string; // Token compartido por todas las tablas compradas por este mismo cliente
  buyerName: string;
  buyerPhone: string;
  createdAt: string;
  tables: BingoTableData[]; // Los 6 juegos de esta hoja (1..6)
  markedByTable: Record<string, number[]>;
  sessionLock: DeviceSessionLock | null;
  eventId?: string;
  status?: "DISPONIBLE" | "VENDIDA"; // Si es DISPONIBLE, está en el inventario pre-generado esperando comprador
  assignedSellerId?: string; // Talonario asignado a un vendedor específico
  assignedSellerName?: string;
  soldBySellerId?: string;
  soldBySellerName?: string;
}

export interface BingoClaim {
  id: string;
  cardNumber: string;
  secretToken: string;
  buyerName: string;
  tableIndex: number;
  stage: StageType;
  claimedAt: string;
  ballCountAtClaim: number;
  lastBallAtClaim: number | null;
  markedNumbers: number[];
  gridSnapshot: number[][];
  validation: ValidationResult;
  status: "PENDIENTE" | "VALIDO" | "RECHAZADO";
  organizerNote?: string;
}

export interface TieBreakCandidate {
  claimId: string;
  cardNumber: string;
  buyerName: string;
  tableIndex: number;
  drawnNumber: number | null;
  drawnAt: string | null;
  drawnBy: "JUGADOR" | "ORGANIZADOR" | null;
}

export interface TieBreakSession {
  id: string;
  active: boolean;
  tableIndex: number;
  stage: StageType;
  prizeName: string;
  candidates: TieBreakCandidate[];
  winnerClaimId: string | null;
  winnerCardNumber: string | null;
  winnerName: string | null;
  winningHighNumber: number | null;
  startedAt: string;
  completedAt: string | null;
}

export interface WinnerRecord {
  id: string;
  tableIndex: number;
  stage: StageType;
  patternType?: StageType;
  prizeName: string;
  cardNumber: string;
  buyerName: string;
  patternName: string;
  wonViaTieBreak: boolean;
  highBallNumber: number | null;
  confirmedAt: string;
}

export interface EventMetadata {
  title: string;
  organizedBy: string;
  address: string;
  note: string;
  dateTimeText: string;
  phones: string;
  priceText: string;
  prizesByTable?: Record<string, string>;
  prizesByTableStage?: Record<string, Partial<Record<StageType, string>>>;
}

export interface BingoGameState {
  eventId: string;
  organizerId: string;
  status: "EN_VIVO" | "PROGRAMADO" | "FINALIZADO";
  event: EventMetadata;
  activeTable: number; // 1 a 6 (en orden: B, I, N, G, O, Tabla Llena)
  activeStage: StageType;
  currentPrizeName: string;
  drawnBalls: number[];
  isPausedForVerification: boolean;
  cards: BingoCardSheet[];
  claims: BingoClaim[];
  tieBreak: TieBreakSession | null;
  winnersHistory: WinnerRecord[];
  sellers: EventSeller[];
  selectionLinks?: SelectionLinkSession[];
  pregeneratedPoolSize?: number;
  updatedAt: string;
}

export interface SaasDatabase {
  version: number;
  activeDefaultEventId: string;
  organizers: SaasOrganizer[];
  events: Record<string, BingoGameState>;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "bingo-db.json");

let memoryCacheDb: SaasDatabase | null = null;
let lastMemoryCacheTime = 0;
let supabaseLoadedOnce = false;

function getSupabaseCredentials(): { url: string; key: string } | null {
  // Solo activar Supabase si se definen explícitamente las variables de entorno
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ""
  ).replace(/\/$/, "").trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  if (!url || !key) return null;
  return { url, key };
}

/**
 * Sincroniza el estado desde Supabase hacia la caché en memoria y archivo local.
 * Prioriza las tablas relacionales optimizadas (organizers, events, cards, claims).
 */
export async function syncFromSupabase(): Promise<void> {
  const creds = getSupabaseCredentials();
  if (!creds) return;
  try {
    // Si ya cargó en memoria recientemente (en los últimos 3 segundos), no spamear Supabase
    const now = Date.now();
    if (memoryCacheDb && (now - lastMemoryCacheTime < 3000)) {
      return;
    }

    // Intentar leer de las nuevas tablas relacionales optimizadas
    const [orgsRes, eventsRes, cardsRes, claimsRes, sellersRes] = await Promise.all([
      supabase.from("organizers").select("*"),
      supabase.from("events").select("*"),
      supabase.from("cards").select("*"),
      supabase.from("claims").select("*"),
      supabase.from("event_sellers").select("*"),
    ]);

    if (
      !orgsRes.error &&
      !eventsRes.error &&
      eventsRes.data &&
      eventsRes.data.length > 0
    ) {
      const organizers: SaasOrganizer[] = orgsRes.data.map((o: any) => ({
        id: o.id,
        name: o.name,
        organizationName: o.organization_name,
        email: o.email,
        phone: o.phone,
        accessCode: o.access_code,
        planId: o.plan_id,
        status: o.status,
        totalPaidUsd: Number(o.total_paid_usd || 0),
        createdAt: o.created_at,
      }));

      const eventsMap: Record<string, BingoGameState> = {};

      for (const ev of eventsRes.data) {
        const evCards: BingoCardSheet[] = (cardsRes.data || [])
          .filter((c: any) => c.event_id === ev.id)
          .map((c: any) => ({
            id: c.card_number,
            cardNumber: c.card_number,
            secretToken: c.secret_token,
            buyerName: c.buyer_name || "",
            buyerPhone: c.buyer_phone || "",
            createdAt: c.created_at,
            tables: c.tables_data || [],
            markedByTable: c.marked_by_table || { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] },
            sessionLock: c.session_lock || null,
            eventId: c.event_id,
            status: c.status || "DISPONIBLE",
            assignedSellerId: c.assigned_seller_id,
            soldBySellerId: c.sold_by_seller_id,
            soldBySellerName: c.sold_by_seller_name,
          }));

        const evClaims: BingoClaim[] = (claimsRes.data || [])
          .filter((cl: any) => cl.event_id === ev.id)
          .map((cl: any) => ({
            id: cl.id,
            cardNumber: cl.card_number,
            secretToken: cl.secret_token,
            buyerName: cl.buyer_name,
            tableIndex: cl.table_index,
            stage: cl.stage,
            claimedAt: cl.claimed_at,
            ballCountAtClaim: cl.ball_count_at_claim,
            lastBallAtClaim: cl.last_ball_at_claim,
            markedNumbers: cl.marked_numbers || [],
            gridSnapshot: cl.grid_snapshot || [],
            validation: cl.validation || {},
            status: cl.status,
            organizerNote: cl.organizer_note,
          }));

        const evSellers: EventSeller[] = (sellersRes.data || [])
          .filter((s: any) => s.event_id === ev.id)
          .map((s: any) => ({
            id: s.id,
            sellerCode: s.seller_code,
            name: s.name,
            phone: s.phone,
            commissionPercent: Number(s.commission_percent || 10),
            active: s.active,
            createdAt: s.created_at,
          }));

        eventsMap[ev.id] = {
          eventId: ev.id,
          organizerId: ev.organizer_id,
          status: ev.status,
          event: {
            title: ev.title,
            organizedBy: ev.organized_by || "",
            address: ev.address || "",
            note: ev.note || "",
            dateTimeText: ev.date_time_text || "",
            phones: ev.phones || "",
            priceText: ev.price_text || "$2.00",
            prizesByTable: ev.prizes_by_table || {},
            prizesByTableStage: ev.prizes_by_table_stage || {},
          },
          activeTable: ev.active_table || 1,
          activeStage: ev.active_stage || "LETRA",
          currentPrizeName: ev.current_prize_name || "",
          drawnBalls: ev.drawn_balls || [],
          isPausedForVerification: ev.is_paused_for_verification || false,
          cards: evCards,
          claims: evClaims,
          tieBreak: null,
          winnersHistory: [],
          sellers: evSellers,
          pregeneratedPoolSize: ev.pregenerated_pool_size || evCards.length,
          updatedAt: ev.updated_at,
        };
      }

      const activeDefaultEventId = eventsRes.data[0]?.id || "evt-solidario-01";
      const remoteDb: SaasDatabase = {
        version: 2,
        activeDefaultEventId,
        organizers,
        events: eventsMap,
        updatedAt: new Date().toISOString(),
      };

      memoryCacheDb = remoteDb;
      lastMemoryCacheTime = Date.now();
      supabaseLoadedOnce = true;
      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(DB_PATH, JSON.stringify(remoteDb, null, 2), "utf-8");
      } catch {}
      return;
    }

    // Fallback de retrocompatibilidad con la tabla monolítica si aún no hubiera datos relacionales
    const res = await fetch(
      `${creds.url}/rest/v1/bingo_store?id=eq.main&select=payload,updated_at`,
      {
        method: "GET",
        headers: {
          apikey: creds.key,
          Authorization: `Bearer ${creds.key}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return;
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0 && rows[0].payload) {
      const remoteDb = rows[0].payload as SaasDatabase;
      if (remoteDb && remoteDb.events && remoteDb.organizers) {
        memoryCacheDb = remoteDb;
        lastMemoryCacheTime = Date.now();
        supabaseLoadedOnce = true;
        try {
          if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
          }
          fs.writeFileSync(DB_PATH, JSON.stringify(remoteDb, null, 2), "utf-8");
        } catch {}
      }
    }
  } catch {}
}

/**
 * Guarda y actualiza entidades específicas en las tablas relacionales de Supabase.
 */
export async function syncToSupabase(db?: SaasDatabase, specificEventId?: string): Promise<void> {
  const creds = getSupabaseCredentials();
  const payload = db || memoryCacheDb;
  if (!creds || !payload) return;
  try {
    // 1. Guardar todos los eventos modificados en las tablas relacionales
    const eventsToSync = specificEventId && payload.events[specificEventId]
      ? [payload.events[specificEventId]]
      : Object.values(payload.events);

    for (const targetEvent of eventsToSync) {
      if (!targetEvent) continue;
      await supabase.from("events").upsert({
        id: targetEvent.eventId,
        organizer_id: targetEvent.organizerId,
        status: targetEvent.status,
        title: targetEvent.event.title,
        organized_by: targetEvent.event.organizedBy,
        address: targetEvent.event.address,
        note: targetEvent.event.note,
        date_time_text: targetEvent.event.dateTimeText,
        phones: targetEvent.event.phones,
        price_text: targetEvent.event.priceText,
        active_table: targetEvent.activeTable,
        active_stage: targetEvent.activeStage,
        current_prize_name: targetEvent.currentPrizeName,
        drawn_balls: targetEvent.drawnBalls,
        is_paused_for_verification: targetEvent.isPausedForVerification,
        prizes_by_table: targetEvent.event.prizesByTable,
        prizes_by_table_stage: targetEvent.event.prizesByTableStage,
        pregenerated_pool_size: targetEvent.pregeneratedPoolSize || targetEvent.cards.length,
        updated_at: new Date().toISOString(),
      });

      // Sincronizar también cartones si existen
      if (targetEvent.cards && targetEvent.cards.length > 0) {
        const cardsChunk = targetEvent.cards.slice(0, 100).map((c) => ({
          id: `${targetEvent.eventId}_${c.cardNumber}`,
          event_id: targetEvent.eventId,
          card_number: c.cardNumber,
          secret_token: c.secretToken,
          buyer_name: c.buyerName || "",
          buyer_phone: c.buyerPhone || "",
          status: c.status || "DISPONIBLE",
          tables_data: c.tables,
          marked_by_table: c.markedByTable,
          session_lock: c.sessionLock,
          assigned_seller_id: c.assignedSellerId,
          sold_by_seller_id: c.soldBySellerId,
          sold_by_seller_name: c.soldBySellerName,
          created_at: c.createdAt || new Date().toISOString(),
        }));
        await supabase.from("cards").upsert(cardsChunk);
      }

      // Sincronizar los reclamos (claims) en la tabla relacional de Supabase para que persistan
      if (targetEvent.claims) {
        if (targetEvent.claims.length === 0) {
          await supabase.from("claims").delete().eq("event_id", targetEvent.eventId);
        } else {
          const claimsPayload = targetEvent.claims.map((cl) => ({
            id: cl.id,
            event_id: targetEvent.eventId,
            card_number: cl.cardNumber,
            secret_token: cl.secretToken,
            buyer_name: cl.buyerName,
            table_index: cl.tableIndex,
            stage: cl.stage,
            claimed_at: cl.claimedAt,
            ball_count_at_claim: cl.ballCountAtClaim,
            last_ball_at_claim: cl.lastBallAtClaim,
            marked_numbers: cl.markedNumbers,
            grid_snapshot: cl.gridSnapshot,
            validation: cl.validation,
            status: cl.status,
            organizer_note: cl.organizerNote || null,
          }));
          await supabase.from("claims").upsert(claimsPayload);
        }
      }
    }

    // 2. Mantener también la tabla de respaldo monolítica por seguridad sin bloquear
    fetch(`${creds.url}/rest/v1/bingo_store`, {
      method: "POST",
      headers: {
        apikey: creds.key,
        Authorization: `Bearer ${creds.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        id: "main",
        payload,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    }).catch(() => {});
  } catch {}
}

export function parsePriceUsd(priceText: string): number {
  const cleaned = (priceText || "").replace(/[^0-9.,]/g, "").replace(",", ".");
  const val = parseFloat(cleaned);
  return isNaN(val) || val < 0 ? 2.0 : val;
}

export function getActiveNumbersFromGrid(grid: number[][]): number[] {
  const nums: number[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (grid[r][c] > 0) {
        nums.push(grid[r][c]);
      }
    }
  }
  return nums.sort((a, b) => a - b);
}

export function computeTableSignature(grid: number[][]): string {
  return getActiveNumbersFromGrid(grid)
    .map((n) => String(n).padStart(2, "0"))
    .join("-");
}

export function isTableUniqueAndDistinct(
  candidateGrid: number[][],
  tableIndex: number,
  existingCards: BingoCardSheet[],
  minDiff: number = 3
): boolean {
  const candidateNums = getActiveNumbersFromGrid(candidateGrid);
  const candidateSet = new Set(candidateNums);
  const candidateSig = computeTableSignature(candidateGrid);

  for (const card of existingCards) {
    const otherTable = card.tables.find((t) => t.tableIndex === tableIndex);
    if (!otherTable) continue;

    const otherSig =
      otherTable.signature || computeTableSignature(otherTable.grid);
    if (candidateSig === otherSig) {
      return false;
    }

    const otherNums = getActiveNumbersFromGrid(otherTable.grid);
    let sharedCount = 0;
    for (const n of otherNums) {
      if (candidateSet.has(n)) sharedCount++;
    }
    const diffCount = candidateNums.length - sharedCount;
    if (diffCount < minDiff) {
      return false;
    }
  }

  return true;
}

function sampleRange(min: number, max: number, count: number): number[] {
  const pool: number[] = [];
  for (let i = min; i <= max; i++) pool.push(i);
  const picked: number[] = [];
  while (picked.length < count) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

export function generateRandomMasterGrid(): number[][] {
  const colB = sampleRange(1, 15, 5);
  const colI = sampleRange(16, 30, 5);
  const colN = sampleRange(31, 45, 5);
  const colG = sampleRange(46, 60, 5);
  const colO = sampleRange(61, 75, 5);

  const grid: number[][] = [];
  for (let r = 0; r < 5; r++) {
    grid.push([colB[r], colI[r], r === 2 ? 0 : colN[r], colG[r], colO[r]]);
  }
  return grid;
}

export function generateSixUniqueTablesModalidadA(
  cardNumber: string,
  existingCards: BingoCardSheet[]
): BingoTableData[] {
  const tables: BingoTableData[] = [];
  const usedCornerSignaturesInSameCard = new Set<string>();

  for (let tIdx = 1; tIdx <= 6; tIdx++) {
    let chosenGrid: number[][] | null = null;

    for (let attempt = 0; attempt < 500; attempt++) {
      const rawGrid = generateRandomMasterGrid();
      const maskedGrid = applyTableMask(rawGrid, tIdx);

      const cornerSig = `${maskedGrid[0][0]}-${maskedGrid[0][4]}-${maskedGrid[4][0]}-${maskedGrid[4][4]}`;
      if (usedCornerSignaturesInSameCard.has(cornerSig)) {
        continue;
      }

      if (isTableUniqueAndDistinct(maskedGrid, tIdx, existingCards, 3)) {
        chosenGrid = maskedGrid;
        usedCornerSignaturesInSameCard.add(cornerSig);
        break;
      }
    }

    if (!chosenGrid) {
      chosenGrid = applyTableMask(generateRandomMasterGrid(), tIdx);
    }

    tables.push({
      tableIndex: tIdx,
      serialCode: `${cardNumber}-${tIdx}`,
      grid: chosenGrid,
      signature: computeTableSignature(chosenGrid),
    });
  }

  return tables;
}

export function createBingoCardSheet(
  cardNumberNum: number,
  buyerName: string,
  buyerPhone: string,
  existingCards: BingoCardSheet[] = [],
  forcedSecretToken?: string,
  extraMeta?: {
    eventId?: string;
    status?: "DISPONIBLE" | "VENDIDA";
    assignedSellerId?: string;
    assignedSellerName?: string;
    soldBySellerId?: string;
    soldBySellerName?: string;
  }
): BingoCardSheet {
  const cardNumber = String(cardNumberNum).padStart(5, "0");
  const shortHash = crypto.randomBytes(3).toString("hex");
  const secretToken = forcedSecretToken || `carton-${cardNumber}-${shortHash}`;

  const tables = generateSixUniqueTablesModalidadA(cardNumber, existingCards);

  return {
    id: cardNumber,
    cardNumber,
    secretToken,
    buyerName,
    buyerPhone,
    createdAt: new Date().toISOString(),
    tables,
    markedByTable: {
      "1": [],
      "2": [],
      "3": [],
      "4": [],
      "5": [],
      "6": [],
    },
    sessionLock: null,
    eventId: extraMeta?.eventId,
    status: extraMeta?.status || "VENDIDA",
    assignedSellerId: extraMeta?.assignedSellerId,
    assignedSellerName: extraMeta?.assignedSellerName,
    soldBySellerId: extraMeta?.soldBySellerId,
    soldBySellerName: extraMeta?.soldBySellerName,
  };
}

/**
 * Genera o completa un talonario pre-generado de N tablas numeradas (#00001..#0000N)
 * en estado DISPONIBLE para que los clientes puedan escoger sus números favoritos.
 */
export function generateNumberedPoolForEvent(
  state: BingoGameState,
  targetPoolSize: number
): { createdCount: number; totalCount: number } {
  const safeSize = Math.max(1, Math.min(2000, Math.floor(targetPoolSize)));
  const existingByNum = new Map<number, BingoCardSheet>();
  for (const c of state.cards) {
    const num = parseInt(c.cardNumber, 10);
    if (!isNaN(num)) {
      existingByNum.set(num, c);
    }
  }

  let createdCount = 0;
  for (let num = 1; num <= safeSize; num++) {
    if (!existingByNum.has(num)) {
      const cardNumber = String(num).padStart(5, "0");
      const poolCard = createBingoCardSheet(
        num,
        "",
        "",
        state.cards,
        `disponible-${state.eventId}-${cardNumber}`,
        {
          eventId: state.eventId,
          status: "DISPONIBLE",
        }
      );
      state.cards.push(poolCard);
      createdCount++;
    }
  }

  state.cards.sort(
    (a, b) => (parseInt(a.cardNumber, 10) || 0) - (parseInt(b.cardNumber, 10) || 0)
  );
  state.pregeneratedPoolSize = Math.max(
    state.pregeneratedPoolSize || 0,
    safeSize,
    state.cards.length
  );

  return { createdCount, totalCount: state.cards.length };
}

export function isCardSold(card: BingoCardSheet): boolean {
  return card.status !== "DISPONIBLE";
}

const REAL_ECUADOR_CARD_00001_RAW_GRIDS: number[][][] = [
  [
    [12, 29, 36, 52, 65],
    [8, 18, 42, 54, 66],
    [11, 22, 0, 49, 64],
    [2, 28, 39, 55, 67],
    [6, 26, 31, 57, 71],
  ],
  [
    [15, 26, 38, 48, 75],
    [1, 19, 43, 59, 65],
    [13, 28, 0, 47, 66],
    [7, 21, 34, 56, 63],
    [11, 27, 35, 55, 71],
  ],
  [
    [3, 22, 33, 59, 63],
    [8, 28, 44, 52, 72],
    [15, 21, 0, 51, 71],
    [10, 30, 40, 57, 64],
    [11, 24, 34, 50, 61],
  ],
  [
    [5, 17, 39, 52, 72],
    [13, 18, 41, 59, 75],
    [4, 28, 0, 47, 64],
    [11, 23, 40, 48, 69],
    [7, 24, 33, 57, 62],
  ],
  [
    [8, 28, 41, 59, 63],
    [3, 19, 38, 51, 61],
    [10, 27, 0, 47, 66],
    [12, 23, 40, 52, 65],
    [7, 24, 32, 56, 70],
  ],
  [
    [8, 25, 43, 59, 71],
    [10, 19, 35, 54, 61],
    [6, 26, 0, 46, 66],
    [7, 16, 34, 58, 70],
    [3, 17, 38, 49, 74],
  ],
];

export function createDefaultPrizesMatrix(): Record<
  string,
  Partial<Record<StageType, string>>
> {
  return {
    "1": {
      LINEA: "$10 en Efectivo",
      PUNTA: "$5 / Sorpresa",
      ESQUINAS: "$15 en Efectivo",
      LINEA_Y_PUNTA: "$15 (Línea + Punta)",
      LINEA_Y_ESQUINAS: "$20 (Línea + 4 Esquinas)",
      PUNTA_Y_ESQUINAS: "$20 (Punta + 4 Esquinas)",
      BINGO_LOCO: "Pollo Hornado",
      LETRA: "Canasta de Víveres #1 (Letra B)",
      LLENA: "Canasta Familiar #1",
    },
    "2": {
      LINEA: "$10 en Efectivo",
      PUNTA: "$5 / Sorpresa",
      ESQUINAS: "$15 en Efectivo",
      LINEA_Y_PUNTA: "$15 (Línea + Punta)",
      LINEA_Y_ESQUINAS: "$20 (Línea + 4 Esquinas)",
      PUNTA_Y_ESQUINAS: "$20 (Punta + 4 Esquinas)",
      BINGO_LOCO: "Premio Rápido $10",
      LETRA: "Canasta de Víveres #2 (Letra I)",
      LLENA: "Canasta Familiar #2",
    },
    "3": {
      LINEA: "$10 en Efectivo",
      PUNTA: "$5 / Sorpresa",
      ESQUINAS: "$15 en Efectivo",
      LINEA_Y_PUNTA: "$15 (Línea + Punta)",
      LINEA_Y_ESQUINAS: "$20 (Línea + 4 Esquinas)",
      PUNTA_Y_ESQUINAS: "$20 (Punta + 4 Esquinas)",
      BINGO_LOCO: "Premio Rápido $10",
      LETRA: "Premio Sorpresa $30 (Letra N)",
      LLENA: "Premio Especial $40",
    },
    "4": {
      LINEA: "$15 en Efectivo",
      PUNTA: "$5 / Sorpresa",
      ESQUINAS: "$20 en Efectivo",
      LINEA_Y_PUNTA: "$20 (Línea + Punta)",
      LINEA_Y_ESQUINAS: "$25 (Línea + 4 Esquinas)",
      PUNTA_Y_ESQUINAS: "$25 (Punta + 4 Esquinas)",
      BINGO_LOCO: "Premio Rápido $15",
      LETRA: "Electrodoméstico (Letra G)",
      LLENA: "Premio Especial $50",
    },
    "5": {
      LINEA: "$15 en Efectivo",
      PUNTA: "$10 en Efectivo",
      ESQUINAS: "$20 en Efectivo",
      LINEA_Y_PUNTA: "$25 (Línea + Punta)",
      LINEA_Y_ESQUINAS: "$30 (Línea + 4 Esquinas)",
      PUNTA_Y_ESQUINAS: "$30 (Punta + 4 Esquinas)",
      BINGO_LOCO: "Premio Rápido $15",
      LETRA: "Premio Especial $50 (Letra O)",
      LLENA: "Premio Especial $80",
    },
    "6": {
      LINEA: "$25 en Efectivo",
      PUNTA: "$10 en Efectivo",
      ESQUINAS: "$30 en Efectivo",
      LINEA_Y_PUNTA: "$35 (Línea + Punta)",
      LINEA_Y_ESQUINAS: "$45 (Línea + 4 Esquinas)",
      PUNTA_Y_ESQUINAS: "$40 (Punta + 4 Esquinas)",
      BINGO_LOCO: "$20 en Efectivo",
      LETRA: "Gran Premio Mayor $200 (Tabla Llena)",
      LLENA: "Gran Premio Mayor $200 (Tabla Llena)",
    },
  };
}

function buildMainDefaultEvent(): BingoGameState {
  const eventId = "evt-solidario-01";
  const sellers: EventSeller[] = [
    {
      id: "sel-01",
      sellerCode: "vendedor-juan",
      name: "Juan Carlos Pérez (Comisionista #1)",
      phone: "0998887766",
      commissionPercent: 10,
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "sel-02",
      sellerCode: "vendedora-carmen",
      name: "Doña Carmen Andrade (Directiva)",
      phone: "0981122334",
      commissionPercent: 15,
      active: true,
      createdAt: new Date().toISOString(),
    },
  ];

  // CLIENTE 1: María Fernanda López (Compró 2 Tablas bajo /jugar/juego-00001)
  const card1Tables: BingoTableData[] = [1, 2, 3, 4, 5, 6].map((tIdx) => {
    const masked = applyTableMask(
      REAL_ECUADOR_CARD_00001_RAW_GRIDS[tIdx - 1],
      tIdx
    );
    return {
      tableIndex: tIdx,
      serialCode: `00001-${tIdx}`,
      grid: masked,
      signature: computeTableSignature(masked),
    };
  });

  const card1: BingoCardSheet = {
    id: "00001",
    cardNumber: "00001",
    secretToken: "juego-00001",
    buyerName: "María Fernanda López",
    buyerPhone: "0991234567",
    createdAt: new Date().toISOString(),
    tables: card1Tables,
    markedByTable: { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] },
    sessionLock: null,
    eventId,
    soldBySellerId: "sel-01",
    soldBySellerName: "Juan Carlos Pérez (Comisionista #1)",
  };

  const card2Tables = generateSixUniqueTablesModalidadA("00002", [card1]);
  const card2: BingoCardSheet = {
    id: "00002",
    cardNumber: "00002",
    secretToken: "juego-00001",
    buyerName: "María Fernanda López",
    buyerPhone: "0991234567",
    createdAt: new Date().toISOString(),
    tables: card2Tables,
    markedByTable: { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] },
    sessionLock: null,
    eventId,
    soldBySellerId: "sel-01",
    soldBySellerName: "Juan Carlos Pérez (Comisionista #1)",
  };

  // CLIENTE 2: Carlos Andrés Zambrano (1 Tabla en /jugar/juego-00002)
  const card3Tables = generateSixUniqueTablesModalidadA("00003", [
    card1,
    card2,
  ]);
  const card3: BingoCardSheet = {
    id: "00003",
    cardNumber: "00003",
    secretToken: "juego-00002",
    buyerName: "Carlos Andrés Zambrano",
    buyerPhone: "0987654321",
    createdAt: new Date().toISOString(),
    tables: card3Tables,
    markedByTable: { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] },
    sessionLock: null,
    eventId,
    soldBySellerId: "sel-02",
    soldBySellerName: "Doña Carmen Andrade (Directiva)",
  };

  // CLIENTE 3: Rosa Elena Vera (3 Tablas en /jugar/juego-00003)
  const card4Tables = generateSixUniqueTablesModalidadA("00004", [
    card1,
    card2,
    card3,
  ]);
  const card4: BingoCardSheet = {
    id: "00004",
    cardNumber: "00004",
    secretToken: "juego-00003",
    buyerName: "Rosa Elena Vera",
    buyerPhone: "0963344556",
    createdAt: new Date().toISOString(),
    tables: card4Tables,
    markedByTable: { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] },
    sessionLock: null,
    eventId,
    soldBySellerId: "sel-02",
    soldBySellerName: "Doña Carmen Andrade (Directiva)",
  };

  const card5Tables = generateSixUniqueTablesModalidadA("00005", [
    card1,
    card2,
    card3,
    card4,
  ]);
  const card5: BingoCardSheet = {
    id: "00005",
    cardNumber: "00005",
    secretToken: "juego-00003",
    buyerName: "Rosa Elena Vera",
    buyerPhone: "0963344556",
    createdAt: new Date().toISOString(),
    tables: card5Tables,
    markedByTable: { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] },
    sessionLock: null,
    eventId,
    soldBySellerId: "sel-02",
    soldBySellerName: "Doña Carmen Andrade (Directiva)",
  };

  const card6Tables = generateSixUniqueTablesModalidadA("00006", [
    card1,
    card2,
    card3,
    card4,
    card5,
  ]);
  const card6: BingoCardSheet = {
    id: "00006",
    cardNumber: "00006",
    secretToken: "juego-00003",
    buyerName: "Rosa Elena Vera",
    buyerPhone: "0963344556",
    createdAt: new Date().toISOString(),
    tables: card6Tables,
    markedByTable: { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] },
    sessionLock: null,
    eventId,
    soldBySellerId: "sel-02",
    soldBySellerName: "Doña Carmen Andrade (Directiva)",
  };

  return {
    eventId,
    organizerId: "org-01",
    status: "EN_VIVO",
    event: {
      title: "GRAN BINGO SOLIDARIO ECUADOR",
      organizedBy: "Comité Barrial / Evento Especial",
      address: "Transmisión en Vivo por Facebook Live y TikTok",
      note: "Conserve su cartón digital o PDF impreso para validación por QR",
      dateTimeText: "Domingo 20h00",
      phones: "099-123-4567",
      priceText: "$2.00",
      prizesByTable: {
        "1": "Canasta de Víveres #1 (Letra B)",
        "2": "Canasta de Víveres #2 (Letra I)",
        "3": "Premio Sorpresa $30 (Letra N)",
        "4": "Electrodoméstico (Letra G)",
        "5": "Premio Especial $50 (Letra O)",
        "6": "Gran Premio Mayor $200 (Tabla Llena)",
      },
      prizesByTableStage: createDefaultPrizesMatrix(),
    },
    activeTable: 1,
    activeStage: "LETRA",
    currentPrizeName: "Canasta de Víveres #1 (Letra B)",
    drawnBalls: [],
    isPausedForVerification: false,
    cards: [card1, card2, card3, card4, card5, card6],
    claims: [],
    tieBreak: null,
    winnersHistory: [],
    sellers,
    updatedAt: new Date().toISOString(),
  };
}

export function createNewEventState(params: {
  eventId: string;
  organizerId: string;
  title: string;
  organizedBy: string;
  priceText?: string;
  dateTimeText?: string;
  address?: string;
  phones?: string;
  pregeneratedPoolSize?: number;
}): BingoGameState {
  const state: BingoGameState = {
    eventId: params.eventId,
    organizerId: params.organizerId,
    status: "EN_VIVO",
    event: {
      title: params.title.toUpperCase(),
      organizedBy: params.organizedBy,
      address:
        params.address || "Transmisión en Vivo por Facebook Live y TikTok",
      note: "Conserve su cartón digital o PDF impreso para validación por QR",
      dateTimeText: params.dateTimeText || "Sábado 20h00",
      phones: params.phones || "099-000-0000",
      priceText: params.priceText || "$2.00",
      prizesByTable: {
        "1": "Premio Tabla #1 (Letra B)",
        "2": "Premio Tabla #2 (Letra I)",
        "3": "Premio Tabla #3 (Letra N)",
        "4": "Premio Tabla #4 (Letra G)",
        "5": "Premio Tabla #5 (Letra O)",
        "6": "Gran Premio Mayor (Tabla Llena)",
      },
      prizesByTableStage: createDefaultPrizesMatrix(),
    },
    activeTable: 1,
    activeStage: "LETRA",
    currentPrizeName: "Canasta de Víveres #1 (Letra B)",
    drawnBalls: [],
    isPausedForVerification: false,
    cards: [],
    claims: [],
    tieBreak: null,
    winnersHistory: [],
    sellers: [
      {
        id: `sel-${Date.now()}`,
        sellerCode: `caja-${params.eventId}`,
        name: "Taquilla Principal",
        phone: params.phones || "0990000000",
        commissionPercent: 10,
        active: true,
        createdAt: new Date().toISOString(),
      },
    ],
    selectionLinks: [],
    pregeneratedPoolSize: params.pregeneratedPoolSize || 0,
    updatedAt: new Date().toISOString(),
  };

  if (params.pregeneratedPoolSize && params.pregeneratedPoolSize > 0) {
    generateNumberedPoolForEvent(state, params.pregeneratedPoolSize);
  } else {
    const c1 = createBingoCardSheet(
      1,
      "Cliente Demo #1",
      "0990001111",
      [],
      `${params.eventId}-00001`,
      { eventId: params.eventId, status: "VENDIDA" }
    );
    state.cards = [c1];
  }

  return state;
}

function getInitialSaasDatabase(): SaasDatabase {
  const organizers: SaasOrganizer[] = [
    {
      id: "org-01",
      name: "Roberto Gómez",
      organizationName: "Comité Barrial / Eventos Ecuador",
      email: "roberto@bingoecuador.ec",
      phone: "0991234567",
      accessCode: "ADMIN2025",
      planId: "PAQUETE_300",
      status: "ACTIVO",
      totalPaidUsd: 25,
      createdAt: new Date().toISOString(),
    },
    {
      id: "org-02",
      name: "Daniela Alvarado",
      organizationName: "Bingomanía Live TikTok EC",
      email: "daniela@bingolive.ec",
      phone: "0987654321",
      accessCode: "TIKTOK2025",
      planId: "SUSCRIPCION_MENSUAL",
      status: "ACTIVO",
      totalPaidUsd: 98,
      createdAt: new Date().toISOString(),
    },
    {
      id: "org-03",
      name: "Comité Padres de Familia",
      organizationName: "Unidad Educativa San Francisco",
      email: "padres@uesanfrancisco.edu.ec",
      phone: "0963344556",
      accessCode: "COLEGIO2025",
      planId: "DEMO_GRATIS",
      status: "ACTIVO",
      totalPaidUsd: 0,
      createdAt: new Date().toISOString(),
    },
  ];

  const mainEvent = buildMainDefaultEvent();
  const secondEvent = createNewEventState({
    eventId: "evt-tiktok-02",
    organizerId: "org-02",
    title: "SUPER BINGO TIKTOK EN VIVO $500",
    organizedBy: "Bingomanía Live TikTok EC",
    priceText: "$3.00",
    dateTimeText: "Viernes 21h00",
    phones: "098-765-4321",
  });
  const thirdEvent = createNewEventState({
    eventId: "evt-colegio-03",
    organizerId: "org-03",
    title: "BINGO PRO-FONDOS GRADUACIÓN",
    organizedBy: "Unidad Educativa San Francisco",
    priceText: "$1.50",
    dateTimeText: "Sábado 16h00",
    phones: "096-334-4556",
  });

  return {
    version: 2,
    activeDefaultEventId: mainEvent.eventId,
    organizers,
    events: {
      [mainEvent.eventId]: mainEvent,
      [secondEvent.eventId]: secondEvent,
      [thirdEvent.eventId]: thirdEvent,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function readSaasDb(): SaasDatabase {
  if (memoryCacheDb) {
    return memoryCacheDb;
  }
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      if (raw && raw.version && raw.events && raw.organizers) {
        memoryCacheDb = raw as SaasDatabase;
        return memoryCacheDb;
      }
      const initial = getInitialSaasDatabase();
      const legacyEvent: BingoGameState = {
        ...raw,
        eventId: "evt-solidario-01",
        organizerId: "org-01",
        status: "EN_VIVO",
        sellers: initial.events["evt-solidario-01"].sellers,
      };
      initial.events["evt-solidario-01"] = legacyEvent;
      memoryCacheDb = initial;
      try {
        fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), "utf-8");
      } catch {}
      return initial;
    }
    const initial = getInitialSaasDatabase();
    memoryCacheDb = initial;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), "utf-8");
    } catch {}
    return initial;
  } catch {
    const fallback = getInitialSaasDatabase();
    memoryCacheDb = fallback;
    return fallback;
  }
}

export function writeSaasDb(db: SaasDatabase): SaasDatabase {
  db.updatedAt = new Date().toISOString();
  memoryCacheDb = db;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch {
    // En entornos serverless (Vercel) el sistema de archivos es read-only
  }
  // Si hay credenciales de Supabase configuradas, sincronizar en segundo plano
  if (getSupabaseCredentials()) {
    syncToSupabase(db).catch(() => {});
  }
  return db;
}

export function readGameState(eventId?: string): BingoGameState {
  const db = readSaasDb();
  const targetId =
    eventId && db.events[eventId] ? eventId : db.activeDefaultEventId;
  return db.events[targetId] || Object.values(db.events)[0];
}

export function writeGameState(
  state: BingoGameState,
  eventId?: string
): BingoGameState {
  const db = readSaasDb();
  const targetId = eventId || state.eventId || db.activeDefaultEventId;
  state.eventId = targetId;
  state.updatedAt = new Date().toISOString();
  db.events[targetId] = state;
  writeSaasDb(db);
  return state;
}

export function findEventByCardToken(token: string): {
  state: BingoGameState;
  matchedCard: BingoCardSheet;
  playerCards: BingoCardSheet[];
} | null {
  const db = readSaasDb();
  // Buscar primero en el evento activo por defecto
  const orderedEvents = [
    db.events[db.activeDefaultEventId],
    ...Object.values(db.events).filter(
      (e) => e.eventId !== db.activeDefaultEventId
    ),
  ].filter(Boolean);

  for (const ev of orderedEvents) {
    const matched = ev.cards.find(
      (c) => c.secretToken === token || c.cardNumber === token
    );
    if (matched) {
      const playerCards = ev.cards.filter(
        (c) => c.secretToken === matched.secretToken
      );
      return {
        state: ev,
        matchedCard: matched,
        playerCards,
      };
    }
  }
  return null;
}

export function findEventBySellerCode(sellerCode: string): {
  state: BingoGameState;
  seller: EventSeller;
  organizer: SaasOrganizer | undefined;
} | null {
  const db = readSaasDb();
  for (const ev of Object.values(db.events)) {
    const seller = (ev.sellers || []).find(
      (s) => s.sellerCode.toLowerCase() === sellerCode.toLowerCase()
    );
    if (seller) {
      const organizer = db.organizers.find((o) => o.id === ev.organizerId);
      return { state: ev, seller, organizer };
    }
  }
  return null;
}

export function findEventBySelectionCode(selectionCode: string): {
  state: BingoGameState;
  linkSession: SelectionLinkSession;
  organizer: SaasOrganizer | undefined;
} | null {
  const db = readSaasDb();
  for (const ev of Object.values(db.events)) {
    const linkSession = (ev.selectionLinks || []).find(
      (l) => l.code.toLowerCase() === selectionCode.toLowerCase()
    );
    if (linkSession) {
      const organizer = db.organizers.find((o) => o.id === ev.organizerId);
      return { state: ev, linkSession, organizer };
    }
  }
  return null;
}

/**
 * Envía a verificación una tabla específica (`cardNumber` + `tableIndex`) de un comprador.
 * Permite que una tabla que ya ganó una figura (ej. Punta) siga participando para las otras (ej. Línea o Tabla Llena).
 */
export function submitPlayerClaim(
  tokenOrCardNumber: string,
  tableIndex: number,
  specificCardNumber?: string,
  eventId?: string
): { ok: boolean; message: string; claim?: BingoClaim; eventId?: string } {
  const found = !eventId ? findEventByCardToken(tokenOrCardNumber) : null;
  const state = found ? found.state : readGameState(eventId);
  const card = state.cards.find((c) =>
    specificCardNumber
      ? c.cardNumber === specificCardNumber
      : c.cardNumber === tokenOrCardNumber ||
        c.secretToken === tokenOrCardNumber
  );
  if (!card) {
    return { ok: false, message: "Cartón no encontrado." };
  }

  const tableObj = card.tables.find((t) => t.tableIndex === tableIndex);
  if (!tableObj) {
    return { ok: false, message: "Tabla inválida." };
  }

  // Figuras que esta tabla YA ganó en el historial de ganadores
  const alreadyWonPatterns: StageType[] = (state.winnersHistory || [])
    .filter((w) => w.cardNumber === card.cardNumber && w.tableIndex === tableIndex)
    .map((w) => w.patternType || w.stage);

  const markedNumbers = card.markedByTable[String(tableIndex)] || [];
  const validation = validateTablePattern(
    tableObj.grid,
    tableIndex,
    state.activeStage,
    state.drawnBalls,
    markedNumbers,
    alreadyWonPatterns
  );

  const targetPatternType: StageType = validation.patternType || state.activeStage;

  // Si ya tiene un reclamo PENDIENTE sin revisar para esta misma figura, evitar reenvíos innecesarios
  const existingPending = state.claims.find(
    (cl) =>
      cl.cardNumber === card.cardNumber &&
      cl.tableIndex === tableIndex &&
      (cl.validation?.patternType === targetPatternType || cl.stage === state.activeStage) &&
      cl.status === "PENDIENTE"
  );
  if (existingPending) {
    return {
      ok: true,
      message: `El Cartón #${card.cardNumber} (Tabla #${tableIndex}) ya está en revisión para esta figura (${existingPending.validation.patternName}).`,
      claim: existingPending,
      eventId: state.eventId,
    };
  }

  // Si la figura ya fue ganada por este mismo cartón
  if (alreadyWonPatterns.includes(targetPatternType)) {
    return {
      ok: false,
      message: `Este Cartón #${card.cardNumber} ya ganó el premio de ${validation.patternName}. Sigue participando por las demás figuras de esta tabla.`,
      eventId: state.eventId,
    };
  }

  const claimId = `BINGO-${Date.now().toString().slice(-6)}`;
  const newClaim: BingoClaim = {
    id: claimId,
    cardNumber: card.cardNumber,
    secretToken: card.secretToken,
    buyerName: card.buyerName,
    tableIndex,
    stage: state.activeStage,
    claimedAt: new Date().toISOString(),
    ballCountAtClaim: state.drawnBalls.length,
    lastBallAtClaim:
      state.drawnBalls.length > 0
        ? state.drawnBalls[state.drawnBalls.length - 1]
        : null,
    markedNumbers: [...markedNumbers],
    gridSnapshot: tableObj.grid,
    validation,
    status: validation.isValidOfficial ? "VALIDO" : "PENDIENTE",
  };

  state.claims.unshift(newClaim);
  state.isPausedForVerification = true;
  writeGameState(state, state.eventId);

  // Inserción directa e inmediata en Supabase para persistencia y activación de Realtime
  Promise.resolve(
    supabase
      .from("claims")
      .upsert({
        id: newClaim.id,
        event_id: state.eventId,
        card_number: newClaim.cardNumber,
        secret_token: newClaim.secretToken,
        buyer_name: newClaim.buyerName,
        table_index: newClaim.tableIndex,
        stage: newClaim.stage,
        claimed_at: newClaim.claimedAt,
        ball_count_at_claim: newClaim.ballCountAtClaim,
        last_ball_at_claim: newClaim.lastBallAtClaim,
        marked_numbers: newClaim.markedNumbers,
        grid_snapshot: newClaim.gridSnapshot,
        validation: newClaim.validation,
        status: newClaim.status,
        organizer_note: null,
      })
  ).catch(() => {});

  return {
    ok: true,
    message: `¡Cartón #${card.cardNumber} (Tabla #${tableIndex}) enviado al organizador para ${validation.patternName}!`,
    claim: newClaim,
    eventId: state.eventId,
  };
}
