import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { readGameState, findEventByCardToken } from "@/lib/bingo-store";

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

    // Validación de seguridad para jugadores: el token debe existir en el evento
    if (role === "viewer" && token) {
      const found = findEventByCardToken(token);
      if (!found && room) {
        // Fallback si la sala existe
        const state = readGameState(room);
        const hasCard = state?.cards?.some((c) => c.secretToken === token || c.cardNumber === token);
        if (!hasCard) {
          return NextResponse.json(
            { error: "Cartón no autorizado para esta sala de bingo." },
            { status: 403 }
          );
        }
      }
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: searchParams.get("name") || identity,
      ttl: "4h",
    });

    const isPublisher = role === "publisher";

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: isPublisher,
      canPublishData: true,
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
