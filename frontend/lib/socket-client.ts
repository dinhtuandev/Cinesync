"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "";

export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${WS_URL}/watch-party`, {
      autoConnect: false,
      transports: ["websocket"],
    });
  }
  return socket;
}
