import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  readSaasDb,
  writeSaasDb,
  readGameState,
  writeGameState,
  findEventByCardToken,
  findEventBySellerCode,
  submitPlayerClaim,
  createBingoCardSheet,
  createNewEventState,
  syncFromSupabase,
  syncToSupabase,
  WinnerRecord,
  BingoCardSheet,
  SAAS_PLANS,
  SaasPlanId,
  SaasOrganizer,
  EventSeller,
} from "@/lib/bingo-store";
import { StageType, STAGES, validateTablePattern } from "@/lib/bingo-patterns";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

function buildSaasSummary(requestedEventId?: string | null) {
  const db = readSaasDb();
  const activeEventId =
    requestedEventId && db.events[requestedEventId]
      ? requestedEventId
      : db.activeDefaultEventId;
  const state = db.events[activeEventId] || Object.values(db.events)[0];
  const organizer =
    db.organizers.find((o) => o.id === state?.organizerId) || db.organizers[0];
  const plan = SAAS_PLANS[organizer?.planId || "PLAN_PRO"];

  const eventsList = Object.values(db.events).map((ev) => {
    const org = db.organizers.find((o) => o.id === ev.organizerId);
    return {
      eventId: ev.eventId,
      organizerId: ev.organizerId,
      organizerName: org?.organizationName || ev.event.organizedBy,
      planId: org?.planId || "PLAN_PRO",
      title: ev.event.title,
      dateTimeText: ev.event.dateTimeText,
      priceText: ev.event.priceText,
      status: ev.status || "EN_VIVO",
      cardsCount: ev.cards.length,
      sellersCount: (ev.sellers || []).length,
      drawnBallsCount: ev.drawnBalls.length,
    };
  });

  return {
    db,
    state,
    organizer,
    plan,
    eventsList,
  };
}

export async function GET(req: NextRequest) {
  await syncFromSupabase();
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const deviceId = searchParams.get("deviceId");
  const sellerCode = searchParams.get("sellerCode");
  const eventIdParam = searchParams.get("eventId");

  // 1. Si consulta un Vendedor / Cajero desde /vendedor/[code]
  if (sellerCode) {
    const foundSeller = findEventBySellerCode(sellerCode);
    if (!foundSeller) {
      return NextResponse.json(
        { error: "Enlace de vendedor no encontrado" },
        { status: 404 }
      );
    }
    const { state, seller, organizer } = foundSeller;
    const plan = SAAS_PLANS[organizer?.planId || "PLAN_PRO"];
    return NextResponse.json({
      state,
      seller,
      organizer,
      plan,
    });
  }

  // 2. Si consulta un Jugador desde /jugar/[token]
  if (token) {
    const found = findEventByCardToken(token);
    if (!found) {
      const fallbackState = readGameState(eventIdParam || undefined);
      return NextResponse.json(
        { error: "Cartón no encontrado", state: fallbackState },
        { status: 404 }
      );
    }

    const { state, playerCards } = found;
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "Celular Web";

    let accessAllowed = true;
    if (deviceId) {
      const primaryLock = playerCards[0].sessionLock;
      if (!primaryLock) {
        const lockObj = {
          deviceId,
          ipAddress: clientIp,
          userAgent,
          lockedAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
        };
        for (const pc of playerCards) {
          pc.sessionLock = { ...lockObj };
        }
        writeGameState(state, state.eventId);
        await syncToSupabase();
      } else if (primaryLock.deviceId === deviceId) {
        for (const pc of playerCards) {
          if (pc.sessionLock) {
            pc.sessionLock.lastSeenAt = new Date().toISOString();
            pc.sessionLock.ipAddress = clientIp;
          }
        }
        writeGameState(state, state.eventId);
        await syncToSupabase();
      } else {
        accessAllowed = false;
      }
    }

    return NextResponse.json({
      state,
      card: playerCards[0],
      playerCards,
      accessAllowed,
      clientIp,
    });
  }

  // 3. Consulta general (Cabina Organizador / Super-Admin / Landing)
  const { db, state, organizer, plan, eventsList } =
    buildSaasSummary(eventIdParam);

  return NextResponse.json({
    state,
    organizer,
    plan,
    eventsList,
    organizers: db.organizers,
    plans: SAAS_PLANS,
    activeDefaultEventId: db.activeDefaultEventId,
  });
}

export async function POST(req: NextRequest) {
  const res = await handlePostAction(req);
  await syncToSupabase();
  return res;
}

async function handlePostAction(req: NextRequest): Promise<NextResponse> {
  try {
    await syncFromSupabase();
    const body = await req.json();
    const { action } = body;
    const requestedEventId = body.eventId as string | undefined;

    // =========================================================================
    // ACCIONES SAAS (AUTENTICACIÓN, SUPER-ADMIN, MULTI-ORGANIZADOR, VENDEDORES)
    // =========================================================================

    // A0. Inicio de sesión unificado (Auto-detecta Super-Admin, Organizador, Vendedor o Jugador)
    if (action === "LOGIN") {
      const db = readSaasDb();
      const role = String(body.role || "AUTO").toUpperCase();
      const identifier = String(body.identifier || "").trim().toLowerCase();
      const accessCode = String(body.accessCode || "").trim();

      // 1. Verificar si es Super-Admin
      const isSuperAdminCreds =
        accessCode.toUpperCase() === "MASTER2025" &&
        (!identifier ||
          identifier === "superadmin@bingo.ec" ||
          identifier === "admin@bingo.ec" ||
          identifier === "superadmin" ||
          identifier === "admin");

      if (role === "SUPERADMIN" || (role === "AUTO" && isSuperAdminCreds)) {
        if (
          accessCode.toUpperCase() === "MASTER2025" ||
          accessCode.toUpperCase() === "SUPERADMIN"
        ) {
          return NextResponse.json({
            ok: true,
            redirectTo: "/saas",
            session: {
              role: "SUPERADMIN",
              name: "Administrador General SaaS",
              email: identifier || "superadmin@bingo.ec",
              loggedInAt: new Date().toISOString(),
            },
          });
        }
        if (role === "SUPERADMIN") {
          return NextResponse.json(
            {
              ok: false,
              message: "Credenciales de Super-Admin incorrectas.",
            },
            { status: 401 }
          );
        }
      }

      // 2. Verificar si es Organizador
      if (role === "ORGANIZER" || role === "AUTO") {
        const matchedOrg = db.organizers.find((o) => {
          const codeMatch =
            o.accessCode.toLowerCase() === accessCode.toLowerCase();
          if (!codeMatch) return false;
          if (!identifier) return true;
          return (
            o.email.toLowerCase() === identifier ||
            o.phone.replace(/\D/g, "") === identifier.replace(/\D/g, "") ||
            o.id.toLowerCase() === identifier ||
            o.name.toLowerCase().includes(identifier) ||
            o.organizationName.toLowerCase().includes(identifier)
          );
        });

        if (matchedOrg) {
          if (matchedOrg.status === "SUSPENDIDO") {
            return NextResponse.json(
              {
                ok: false,
                message:
                  "Esta cuenta de organizador se encuentra suspendida. Contacte al administrador.",
              },
              { status: 403 }
            );
          }

          const orgEvents = Object.values(db.events).filter(
            (ev) => ev.organizerId === matchedOrg.id
          );
          const firstEvent = orgEvents[0];
          if (firstEvent) {
            db.activeDefaultEventId = firstEvent.eventId;
            writeSaasDb(db);
          }

          return NextResponse.json({
            ok: true,
            redirectTo: "/admin",
            session: {
              role: "ORGANIZER",
              organizerId: matchedOrg.id,
              name: matchedOrg.name,
              email: matchedOrg.email,
              organizationName: matchedOrg.organizationName,
              planId: matchedOrg.planId,
              defaultEventId: firstEvent?.eventId || db.activeDefaultEventId,
              loggedInAt: new Date().toISOString(),
            },
          });
        }

        if (role === "ORGANIZER") {
          return NextResponse.json(
            {
              ok: false,
              message: "Usuario o contraseña incorrectos.",
            },
            { status: 401 }
          );
        }
      }

      // 3. Verificar si es Vendedor / Cajero
      if (role === "SELLER" || role === "AUTO") {
        const sellerCandidate =
          findEventBySellerCode(accessCode) ||
          findEventBySellerCode(identifier);
        if (sellerCandidate) {
          return NextResponse.json({
            ok: true,
            redirectTo: `/vendedor/${sellerCandidate.seller.sellerCode}`,
            session: {
              role: "SELLER",
              name: sellerCandidate.seller.name,
              sellerCode: sellerCandidate.seller.sellerCode,
              defaultEventId: sellerCandidate.state.eventId,
              loggedInAt: new Date().toISOString(),
            },
          });
        }

        if (role === "SELLER") {
          return NextResponse.json(
            {
              ok: false,
              message: "Código de vendedor no válido.",
            },
            { status: 404 }
          );
        }
      }

      // 4. Verificar si ingresó un código de Cartón de Jugador
      if (role === "AUTO") {
        const cardCandidate =
          findEventByCardToken(accessCode) || findEventByCardToken(identifier);
        if (cardCandidate) {
          return NextResponse.json({
            ok: true,
            redirectTo: `/jugar/${cardCandidate.matchedCard.secretToken}`,
            session: null,
          });
        }
      }

      return NextResponse.json(
        {
          ok: false,
          message:
            "Usuario o contraseña incorrectos. Verifique sus credenciales e intente nuevamente.",
        },
        { status: 401 }
      );
    }

    // A1. Cambiar el evento activo en el panel
    if (action === "SWITCH_ACTIVE_EVENT") {
      const db = readSaasDb();
      const targetId = String(body.targetEventId || "");
      if (db.events[targetId]) {
        db.activeDefaultEventId = targetId;
        writeSaasDb(db);
      }
      const summary = buildSaasSummary(targetId);
      return NextResponse.json({
        ok: true,
        state: summary.state,
        organizer: summary.organizer,
        plan: summary.plan,
        eventsList: summary.eventsList,
        organizers: summary.db.organizers,
        activeDefaultEventId: summary.db.activeDefaultEventId,
      });
    }

    // A2. Crear un nuevo Evento de Bingo para un Organizador
    if (action === "CREATE_EVENT") {
      const db = readSaasDb();
      const organizerId = String(body.organizerId || "org-01");
      const organizer =
        db.organizers.find((o) => o.id === organizerId) || db.organizers[0];
      const plan = SAAS_PLANS[organizer.planId];

      const currentOrgEvents = Object.values(db.events).filter(
        (e) => e.organizerId === organizer.id
      );
      if (currentOrgEvents.length >= plan.maxEvents) {
        return NextResponse.json(
          {
            ok: false,
            limitReached: true,
            message: `Tu ${plan.name} permite hasta ${plan.maxEvents} evento(s). Actualiza tu plan para crear más eventos simultáneos.`,
          },
          { status: 400 }
        );
      }

      const shortId = crypto.randomBytes(2).toString("hex");
      const newEventId = `evt-${shortId}`;
      const newEvent = createNewEventState({
        eventId: newEventId,
        organizerId: organizer.id,
        title: String(body.title || "NUEVO GRAN BINGO SOLIDARIO"),
        organizedBy: String(body.organizedBy || organizer.organizationName),
        priceText: String(body.priceText || "$2.00"),
        dateTimeText: String(body.dateTimeText || "Domingo 20h00"),
        address: String(
          body.address || "Transmisión en Vivo por Facebook Live y TikTok"
        ),
        phones: String(body.phones || organizer.phone),
      });

      db.events[newEventId] = newEvent;
      db.activeDefaultEventId = newEventId;
      writeSaasDb(db);

      const summary = buildSaasSummary(newEventId);
      return NextResponse.json({
        ok: true,
        newEventId,
        state: summary.state,
        organizer: summary.organizer,
        plan: summary.plan,
        eventsList: summary.eventsList,
        organizers: summary.db.organizers,
        activeDefaultEventId: summary.db.activeDefaultEventId,
      });
    }

    // A3. Crear un nuevo Organizador (Cliente SaaS desde Super-Admin o Registro)
    if (action === "CREATE_ORGANIZER") {
      const db = readSaasDb();
      const planId = (body.planId as SaasPlanId) || "DEMO_GRATIS";
      const plan = SAAS_PLANS[planId] || SAAS_PLANS.DEMO_GRATIS;
      const orgId = `org-${String(db.organizers.length + 1).padStart(2, "0")}-${crypto
        .randomBytes(2)
        .toString("hex")}`;

      const newOrg: SaasOrganizer = {
        id: orgId,
        name: String(body.name || "Organizador").trim(),
        organizationName: String(
          body.organizationName || body.name || "Mi Organización de Bingo"
        ).trim(),
        email: String(body.email || "contacto@bingo.ec").trim(),
        phone: String(body.phone || "0990000000").trim(),
        accessCode: String(
          body.accessCode ||
            `BINGO${Math.floor(1000 + Math.random() * 9000)}`
        ).trim(),
        planId: plan.id,
        status: "ACTIVO",
        totalPaidUsd: plan.priceUsd,
        createdAt: new Date().toISOString(),
      };

      db.organizers.unshift(newOrg);

      // Crear su primer evento listo para usar
      const firstEventId = `evt-${crypto.randomBytes(2).toString("hex")}`;
      const firstEvent = createNewEventState({
        eventId: firstEventId,
        organizerId: newOrg.id,
        title: String(
          body.firstEventTitle || `GRAN BINGO ${newOrg.organizationName}`
        ),
        organizedBy: newOrg.organizationName,
        priceText: String(body.priceText || "$2.00"),
        phones: newOrg.phone,
      });

      db.events[firstEventId] = firstEvent;
      db.activeDefaultEventId = firstEventId;
      writeSaasDb(db);

      const summary = buildSaasSummary(firstEventId);
      return NextResponse.json({
        ok: true,
        newOrganizer: newOrg,
        newEventId: firstEventId,
        state: summary.state,
        organizer: summary.organizer,
        plan: summary.plan,
        eventsList: summary.eventsList,
        organizers: summary.db.organizers,
        activeDefaultEventId: summary.db.activeDefaultEventId,
      });
    }

    // A4. Cambiar el Plan o Estado de un Organizador (Upgrade de Plan SaaS)
    if (action === "UPDATE_ORGANIZER_PLAN") {
      const db = readSaasDb();
      const targetOrg = db.organizers.find((o) => o.id === body.organizerId);
      if (!targetOrg) {
        return NextResponse.json(
          { ok: false, message: "Organizador no encontrado" },
          { status: 404 }
        );
      }

      if (body.planId && SAAS_PLANS[body.planId as SaasPlanId]) {
        const newPlan = SAAS_PLANS[body.planId as SaasPlanId];
        if (targetOrg.planId !== newPlan.id && newPlan.priceUsd > 0) {
          targetOrg.totalPaidUsd += newPlan.priceUsd;
        }
        targetOrg.planId = newPlan.id;
      }
      if (body.status === "ACTIVO" || body.status === "SUSPENDIDO") {
        targetOrg.status = body.status;
      }

      writeSaasDb(db);
      const summary = buildSaasSummary(requestedEventId);
      return NextResponse.json({
        ok: true,
        state: summary.state,
        organizer: summary.organizer,
        plan: summary.plan,
        eventsList: summary.eventsList,
        organizers: summary.db.organizers,
      });
    }

    // A5. Crear un Vendedor / Comisionista para el Evento
    if (action === "CREATE_SELLER") {
      const { state, organizer, plan } = buildSaasSummary(requestedEventId);
      if (!plan.allowSellers) {
        return NextResponse.json(
          {
            ok: false,
            limitReached: true,
            message: `Tu ${plan.name} no incluye accesos para Vendedores/Comisionistas. Actualiza al Plan Básico ($15) o Plan Pro ($35) para habilitar vendedores.`,
          },
          { status: 400 }
        );
      }

      const name = String(body.name || "Vendedor").trim();
      const phone = String(body.phone || "").trim();
      const commissionPercent = Math.max(
        0,
        Math.min(50, Number(body.commissionPercent) || 10)
      );
      const slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 12);
      const shortCode = crypto.randomBytes(2).toString("hex");
      const sellerCode = `vend-${slug || "caja"}-${shortCode}`;

      const newSeller: EventSeller = {
        id: `sel-${Date.now()}`,
        sellerCode,
        name,
        phone,
        commissionPercent,
        active: true,
        createdAt: new Date().toISOString(),
      };

      if (!state.sellers) state.sellers = [];
      state.sellers.push(newSeller);
      writeGameState(state, state.eventId);

      return NextResponse.json({
        ok: true,
        seller: newSeller,
        state,
        organizer,
        plan,
      });
    }

    // A6. Activar / Pausar acceso de un Vendedor
    if (action === "TOGGLE_SELLER_STATUS") {
      const state = readGameState(requestedEventId);
      const targetSeller = (state.sellers || []).find(
        (s) => s.id === body.sellerId
      );
      if (targetSeller) {
        targetSeller.active = !targetSeller.active;
        writeGameState(state, state.eventId);
      }
      return NextResponse.json({ ok: true, state });
    }

    // =========================================================================
    // ACCIONES DE JUEGO EN VIVO Y CARTONES (SOBRE EL EVENTO CORRESPONDIENTE)
    // =========================================================================
    const state = readGameState(requestedEventId);

    // 1. Marcar o desmarcar bolilla cantada en el bolillero del organizador (1 al 75)
    if (action === "TOGGLE_BALL") {
      const ballNumber = Number(body.ballNumber);
      if (ballNumber >= 1 && ballNumber <= 75) {
        const idx = state.drawnBalls.indexOf(ballNumber);
        if (idx >= 0) {
          state.drawnBalls.splice(idx, 1);
        } else {
          state.drawnBalls.push(ballNumber);
        }
        for (const cl of state.claims) {
          if (
            cl.tableIndex === state.activeTable &&
            cl.stage === state.activeStage
          ) {
            cl.validation = validateTablePattern(
              cl.gridSnapshot,
              cl.tableIndex,
              cl.stage,
              state.drawnBalls,
              cl.markedNumbers
            );
            if (cl.validation.isValidOfficial && cl.status === "PENDIENTE") {
              cl.status = "VALIDO";
            }
          }
        }
        writeGameState(state, state.eventId);
      }
      return NextResponse.json({ ok: true, state });
    }

    // 2. Cambiar sub-juego / etapa DENTRO de la misma tabla (sin borrar bolillas ni marcas)
    if (action === "SET_STAGE") {
      const newStage = body.stage as StageType;
      if (STAGES[newStage]) {
        state.activeStage = newStage;
        const stagePrize =
          state.event.prizesByTableStage?.[String(state.activeTable)]?.[
            newStage
          ];
        if (body.prizeName !== undefined) {
          state.currentPrizeName = body.prizeName;
        } else if (stagePrize) {
          state.currentPrizeName = stagePrize;
        }
        state.isPausedForVerification = false;
        state.tieBreak = null;
        writeGameState(state, state.eventId);
      }
      return NextResponse.json({ ok: true, state });
    }

    // 3. Cambiar de Tabla (ej. pasar de Tabla #1 a Tabla #2 reiniciando las 75 bolillas)
    if (action === "CHANGE_TABLE") {
      const nextTable = Number(body.tableIndex);
      const resetBalls = body.resetBalls !== false;
      if (nextTable >= 1 && nextTable <= 6) {
        const nextStage: StageType =
          (body.stage as StageType) || (nextTable === 6 ? "LLENA" : "LETRA");
        state.activeTable = nextTable;
        state.activeStage = nextStage;
        const stagePrize =
          state.event.prizesByTableStage?.[String(nextTable)]?.[nextStage] ||
          state.event.prizesByTable?.[String(nextTable)];
        if (body.prizeName) {
          state.currentPrizeName = body.prizeName;
        } else if (stagePrize) {
          state.currentPrizeName = stagePrize;
        } else {
          state.currentPrizeName =
            nextTable === 6
              ? "Premio Mayor - Tabla #6 Llena"
              : `Premio Tabla #${nextTable}`;
        }
        if (resetBalls) {
          state.drawnBalls = [];
        }
        state.isPausedForVerification = false;
        state.tieBreak = null;
        writeGameState(state, state.eventId);
      }
      return NextResponse.json({ ok: true, state });
    }

    // 4. Jugador pinta o despinta un número en una de sus hojas (`cardNumber` + `tableIndex`)
    if (action === "MARK_NUMBER") {
      const { token, cardNumber, tableIndex, number } = body;
      const found = findEventByCardToken(token || cardNumber);
      const targetState = found ? found.state : state;

      const card = targetState.cards.find((c) =>
        cardNumber
          ? c.cardNumber === cardNumber &&
            (!token || c.secretToken === token || c.cardNumber === token)
          : c.secretToken === token || c.cardNumber === token
      );
      if (!card) {
        return NextResponse.json(
          { ok: false, message: "Cartón no encontrado" },
          { status: 404 }
        );
      }
      const key = String(tableIndex);
      if (!card.markedByTable[key]) {
        card.markedByTable[key] = [];
      }
      const list = card.markedByTable[key];
      const idx = list.indexOf(Number(number));
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.push(Number(number));
      }
      writeGameState(targetState, targetState.eventId);
      const playerCards = targetState.cards.filter(
        (c) => c.secretToken === card.secretToken
      );
      return NextResponse.json({
        ok: true,
        card,
        playerCards,
        state: targetState,
      });
    }

    // 5. Jugador envía "¡BINGO! Enviar Verificación" de una hoja específica (`cardNumber`)
    if (action === "SUBMIT_CLAIM") {
      const { token, cardNumber, tableIndex } = body;
      const result = submitPlayerClaim(
        token,
        Number(tableIndex),
        cardNumber,
        requestedEventId
      );
      const updatedState = readGameState(result.eventId || requestedEventId);
      return NextResponse.json({ ...result, state: updatedState });
    }

    // 6. Simulación rápida de empate (3 cartones diferentes completan línea en el sorteo)
    if (action === "SIMULATE_TIE_DEMO") {
      state.activeTable = 1;
      state.activeStage = "LINEA";
      const uniqueBuyerCards: BingoCardSheet[] = [];
      const seenTokens = new Set<string>();
      for (const c of state.cards) {
        if (!seenTokens.has(c.secretToken)) {
          seenTokens.add(c.secretToken);
          uniqueBuyerCards.push(c);
        }
        if (uniqueBuyerCards.length === 3) break;
      }

      for (const card of uniqueBuyerCards) {
        const t1 = card.tables.find((t) => t.tableIndex === 1);
        if (!t1) continue;
        const row0Balls = t1.grid[0].filter((n) => n > 0);
        const currentMarks = new Set(card.markedByTable["1"] || []);
        for (const b of row0Balls) {
          if (!state.drawnBalls.includes(b)) {
            state.drawnBalls.push(b);
          }
          currentMarks.add(b);
        }
        card.markedByTable["1"] = Array.from(currentMarks);
      }

      state.claims = state.claims.filter(
        (c) => !(c.tableIndex === 1 && c.stage === "LINEA")
      );
      writeGameState(state, state.eventId);

      for (const card of uniqueBuyerCards) {
        submitPlayerClaim(
          card.secretToken,
          1,
          card.cardNumber,
          state.eventId
        );
      }
      const updated = readGameState(state.eventId);
      return NextResponse.json({
        ok: true,
        message: "Demo de 3 ganadores simultáneos activada.",
        state: updated,
      });
    }

    // 7. Cambiar estado de un reclamo (VALIDO / RECHAZADO)
    if (action === "UPDATE_CLAIM_STATUS") {
      const { claimId, status } = body;
      const claim = state.claims.find((c) => c.id === claimId);
      if (claim) {
        claim.status = status;
        writeGameState(state, state.eventId);
      }
      return NextResponse.json({ ok: true, state });
    }

    // 8. Confirmar 1 ganador directo (cuando no hay empate)
    if (action === "CONFIRM_DIRECT_WINNER") {
      const { claimId } = body;
      const claim = state.claims.find((c) => c.id === claimId);
      if (claim) {
        claim.status = "VALIDO";
        const record: WinnerRecord = {
          id: `WIN-${Date.now()}`,
          tableIndex: claim.tableIndex,
          stage: claim.stage,
          prizeName: state.currentPrizeName,
          cardNumber: claim.cardNumber,
          buyerName: claim.buyerName,
          patternName: claim.validation.patternName,
          wonViaTieBreak: false,
          highBallNumber: null,
          confirmedAt: new Date().toISOString(),
        };
        state.winnersHistory.unshift(record);
        state.isPausedForVerification = false;
        writeGameState(state, state.eventId);
      }
      return NextResponse.json({ ok: true, state });
    }

    // 9. Iniciar Desempate "Al Número Mayor"
    if (action === "START_TIE_BREAK") {
      const validClaims = state.claims.filter(
        (c) =>
          c.tableIndex === state.activeTable &&
          c.stage === state.activeStage &&
          c.status === "VALIDO"
      );
      if (validClaims.length < 2) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Se necesitan al menos 2 cartones válidos para iniciar el desempate al número mayor.",
          },
          { status: 400 }
        );
      }

      state.tieBreak = {
        id: `DESEMPATE-${Date.now()}`,
        active: true,
        tableIndex: state.activeTable,
        stage: state.activeStage,
        prizeName: state.currentPrizeName,
        candidates: validClaims.map((vc) => ({
          claimId: vc.id,
          cardNumber: vc.cardNumber,
          buyerName: vc.buyerName,
          tableIndex: vc.tableIndex,
          drawnNumber: null,
          drawnAt: null,
          drawnBy: null,
        })),
        winnerClaimId: null,
        winnerCardNumber: null,
        winnerName: null,
        winningHighNumber: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      };
      writeGameState(state, state.eventId);
      return NextResponse.json({ ok: true, state });
    }

    // 10. Sacar bolilla en el Desempate "Al Número Mayor"
    if (action === "DRAW_TIE_BREAK_BALL") {
      const { cardNumber, manualNumber, drawnBy, token } = body;
      const found = token ? findEventByCardToken(token) : null;
      const targetState = found ? found.state : state;

      if (!targetState.tieBreak || !targetState.tieBreak.active) {
        return NextResponse.json(
          { ok: false, message: "No hay un desempate activo." },
          { status: 400 }
        );
      }

      const candidate = targetState.tieBreak.candidates.find(
        (c) => c.cardNumber === cardNumber
      );
      if (!candidate || candidate.drawnNumber !== null) {
        return NextResponse.json({ ok: true, state: targetState });
      }

      const usedNumbers = new Set(
        targetState.tieBreak.candidates
          .map((c) => c.drawnNumber)
          .filter((n): n is number => n !== null)
      );

      let chosenNumber: number;
      if (
        manualNumber !== undefined &&
        manualNumber !== null &&
        Number(manualNumber) >= 1 &&
        Number(manualNumber) <= 75 &&
        !usedNumbers.has(Number(manualNumber))
      ) {
        chosenNumber = Number(manualNumber);
      } else {
        const available: number[] = [];
        for (let i = 1; i <= 75; i++) {
          if (!usedNumbers.has(i)) available.push(i);
        }
        chosenNumber =
          available[Math.floor(Math.random() * available.length)];
      }

      candidate.drawnNumber = chosenNumber;
      candidate.drawnAt = new Date().toISOString();
      candidate.drawnBy = drawnBy === "ORGANIZADOR" ? "ORGANIZADOR" : "JUGADOR";

      const allDrawn = targetState.tieBreak.candidates.every(
        (c) => c.drawnNumber !== null
      );
      if (allDrawn) {
        let best = targetState.tieBreak.candidates[0];
        for (const c of targetState.tieBreak.candidates) {
          if ((c.drawnNumber || 0) > (best.drawnNumber || 0)) {
            best = c;
          }
        }
        targetState.tieBreak.winnerClaimId = best.claimId;
        targetState.tieBreak.winnerCardNumber = best.cardNumber;
        targetState.tieBreak.winnerName = best.buyerName;
        targetState.tieBreak.winningHighNumber = best.drawnNumber;
        targetState.tieBreak.completedAt = new Date().toISOString();

        const record: WinnerRecord = {
          id: `WIN-${Date.now()}`,
          tableIndex: targetState.tieBreak.tableIndex,
          stage: targetState.tieBreak.stage,
          prizeName: targetState.tieBreak.prizeName,
          cardNumber: best.cardNumber,
          buyerName: best.buyerName,
          patternName: `Desempate Al Número Mayor (Bolilla #${best.drawnNumber})`,
          wonViaTieBreak: true,
          highBallNumber: best.drawnNumber,
          confirmedAt: new Date().toISOString(),
        };
        targetState.winnersHistory.unshift(record);
      }

      writeGameState(targetState, targetState.eventId);
      return NextResponse.json({ ok: true, state: targetState });
    }

    // 11. Cerrar modal de desempate
    if (action === "CLOSE_TIE_BREAK") {
      state.tieBreak = null;
      state.isPausedForVerification = false;
      writeGameState(state, state.eventId);
      return NextResponse.json({ ok: true, state });
    }

    // 12. Liberar candado de Dispositivo / IP de todas las tablas de ese comprador
    if (action === "UNLOCK_CARD_DEVICE") {
      const { cardNumber, secretToken } = body;
      const targetCard = state.cards.find(
        (c) => c.cardNumber === cardNumber || c.secretToken === secretToken
      );
      if (targetCard) {
        for (const c of state.cards) {
          if (c.secretToken === targetCard.secretToken) {
            c.sessionLock = null;
          }
        }
        writeGameState(state, state.eventId);
      }
      return NextResponse.json({ ok: true, state });
    }

    // 13. Crear 1 o VARIAS tablas (hojas de 6 juegos) validando el Plan SaaS y registrando Vendedor
    if (action === "CREATE_CARD") {
      // Si viene desde un link de Vendedor (/vendedor/[sellerCode])
      let targetState = state;
      let sellerObj: EventSeller | undefined;

      if (body.sellerCode) {
        const foundSeller = findEventBySellerCode(String(body.sellerCode));
        if (!foundSeller) {
          return NextResponse.json(
            { ok: false, message: "Código de vendedor inválido." },
            { status: 404 }
          );
        }
        if (!foundSeller.seller.active) {
          return NextResponse.json(
            {
              ok: false,
              message:
                "Tu acceso de vendedor ha sido pausado por el organizador.",
            },
            { status: 403 }
          );
        }
        targetState = foundSeller.state;
        sellerObj = foundSeller.seller;
      } else if (body.sellerId) {
        sellerObj = (targetState.sellers || []).find(
          (s) => s.id === body.sellerId
        );
      }

      const db = readSaasDb();
      const organizer =
        db.organizers.find((o) => o.id === targetState.organizerId) ||
        db.organizers[0];
      const plan = SAAS_PLANS[organizer?.planId || "PLAN_PRO"];

      if (organizer?.status === "SUSPENDIDO") {
        return NextResponse.json(
          {
            ok: false,
            limitReached: true,
            message:
              "La cuenta del organizador está suspendida. Contacta al administrador SaaS.",
          },
          { status: 403 }
        );
      }

      const buyerName = (body.buyerName || "Participante Invitado").trim();
      const buyerPhone = (body.buyerPhone || "").trim();
      const quantity = Math.max(1, Math.min(25, Number(body.quantity) || 1));
      const existingSecretToken = body.existingSecretToken as
        | string
        | undefined;

      // Validar límite de tablas del Plan SaaS
      if (targetState.cards.length + quantity > plan.maxCardsPerEvent) {
        return NextResponse.json(
          {
            ok: false,
            limitReached: true,
            message: `Límite alcanzado: Tu ${plan.name} permite hasta ${plan.maxCardsPerEvent} tablas por evento (actualmente tienes ${targetState.cards.length}). Sube al Plan Básico ($15) o Plan Pro ($35) para vender más tablas.`,
          },
          { status: 400 }
        );
      }

      const firstCardNum = targetState.cards.length + 1;
      const shortHash = crypto.randomBytes(3).toString("hex");
      const sharedToken =
        existingSecretToken ||
        `${targetState.eventId}-${String(firstCardNum).padStart(
          5,
          "0"
        )}-${shortHash}`;

      const existingClientCard = existingSecretToken
        ? targetState.cards.find((c) => c.secretToken === existingSecretToken)
        : undefined;

      const createdCards: BingoCardSheet[] = [];
      for (let i = 0; i < quantity; i++) {
        const nextNum = targetState.cards.length + 1;
        const newCard = createBingoCardSheet(
          nextNum,
          existingClientCard ? existingClientCard.buyerName : buyerName,
          existingClientCard ? existingClientCard.buyerPhone : buyerPhone,
          targetState.cards,
          sharedToken,
          {
            eventId: targetState.eventId,
            soldBySellerId:
              sellerObj?.id || existingClientCard?.soldBySellerId,
            soldBySellerName:
              sellerObj?.name || existingClientCard?.soldBySellerName,
          }
        );
        if (existingClientCard?.sessionLock) {
          newCard.sessionLock = { ...existingClientCard.sessionLock };
        }
        targetState.cards.push(newCard);
        createdCards.push(newCard);
      }

      writeGameState(targetState, targetState.eventId);
      return NextResponse.json({
        ok: true,
        newCard: createdCards[0],
        createdCards,
        state: targetState,
      });
    }

    // 14. Actualizar premio o datos del evento
    if (action === "UPDATE_EVENT_INFO") {
      if (body.event) {
        state.event = {
          ...state.event,
          ...body.event,
          prizesByTable: {
            ...(state.event.prizesByTable || {}),
            ...(body.event.prizesByTable || {}),
          },
          prizesByTableStage: {
            ...(state.event.prizesByTableStage || {}),
            ...(body.event.prizesByTableStage || {}),
          },
        };
        const activeStagePrize =
          state.event.prizesByTableStage?.[String(state.activeTable)]?.[
            state.activeStage
          ] || state.event.prizesByTable?.[String(state.activeTable)];
        if (activeStagePrize && body.currentPrizeName === undefined) {
          state.currentPrizeName = activeStagePrize;
        }
      }
      if (body.currentPrizeName !== undefined) {
        state.currentPrizeName = body.currentPrizeName;
        if (!state.event.prizesByTableStage) {
          state.event.prizesByTableStage = {};
        }
        const tKey = String(state.activeTable);
        if (!state.event.prizesByTableStage[tKey]) {
          state.event.prizesByTableStage[tKey] = {};
        }
        state.event.prizesByTableStage[tKey][state.activeStage] =
          body.currentPrizeName;
      }
      writeGameState(state, state.eventId);
      return NextResponse.json({ ok: true, state });
    }

    return NextResponse.json(
      { ok: false, message: "Acción no reconocida" },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: String(err) },
      { status: 500 }
    );
  }
}
