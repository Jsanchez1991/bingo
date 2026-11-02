import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { readGameState, findEventByCardToken, syncFromSupabase } from "@/lib/bingo-store";
import { supabase } from "@/lib/supabase-client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const room = searchParams.get("room"); // eventId
    const identity = searchParams.get("identity") || `user_${Math.random().toString(36).substring(7)}`;
    const role = searchParams.get("role") || "viewer"; // "publisher" (organizador) o "viewer" (jugador)
    const token = searchParams.get("token"); // cartón del jugador o auth token

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: "LiveKit no está configurado en el servidor." },
        { status: 500 }
      );
    }

    if (!room) {
      return NextResponse.json(
        { error: "Se requiere el ID de la sala (evento)." },
        { status: 400 }
      );
    }

    // Validación de seguridad para jugadores: verificar tanto en Supabase como en memoria
    if (role === "viewer" && token) {
      let authorized = false;

      // 1. Consulta directa y rápida en Supabase por secret_token o card_number
      try {
        const { data: cardMatches } = await supabase
          .from("cards")
          .select("id")
          .or(`secret_token.eq.${token},card_number.eq.${token}`)
          .limit(1);

        if (cardMatches && cardMatches.length > 0) {
          authorized = true;
        }
      } catch {}

      // 2. Fallback sincronizando el estado si aún no se encontró
      if (!authorized) {
        await syncFromSupabase();
        const found = findEventByCardToken(token);
        if (found) {
          authorized = true;
        } else if (room) {
          const state = readGameState(room);
          const hasCard = state?.cards?.some(
            (c) => c.secretToken === token || c.cardNumber === token
          );
          if (hasCard) authorized = true;
        }
      }

      if (!authorized) {
        return NextResponse.json(
          { error: "Cartón no autorizado para esta sala de bingo." },
          { status: 403 }
        );
      }
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: searchParams.get("name") || identity,
      ttl: "4h",
    });

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true, // Permite publicar audio cuando el organizador le dé la palabra
      canPublishData: true, // Permite enviar eventos de 'levantar la mano'
      canSubscribe: true,
    });

    const jwt = await at.toJwt();

    return NextResponse.json({
      token: jwt,
      url: wsUrl,
      room,
      identity,
      role,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al generar token de sala: " + String(error) },
      { status: 500 }
    );
  }
}
