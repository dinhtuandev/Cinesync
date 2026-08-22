import { notFound } from "next/navigation";
import { WatchPartyRoom } from "@/components/watch/WatchPartyRoom";

export const metadata = {
  title: "Phòng xem chung",
};

const ROOM_CODE_PATTERN = /^[A-Za-z0-9]{6,10}$/;

export default async function WatchPartyPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;
  if (!ROOM_CODE_PATTERN.test(roomCode)) notFound();

  return <WatchPartyRoom roomCode={roomCode} />;
}
