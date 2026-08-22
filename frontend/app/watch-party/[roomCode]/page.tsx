export default async function WatchPartyPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center space-y-4 pt-10 text-center">
      <span className="rounded-xl bg-neutral-900 px-8 py-4 font-mono text-3xl tracking-[0.3em] text-white">
        {roomCode.toUpperCase()}
      </span>
      <p className="text-sm text-neutral-400">Mã phòng xem chung</p>
      <div className="w-full max-w-2xl space-y-3 rounded-2xl border border-dashed border-neutral-700 p-10">
        <h1 className="text-lg font-semibold text-neutral-200">Phòng xem chung sắp ra mắt 🎬</h1>
        <p className="text-sm leading-relaxed text-neutral-500">
          Trang này sẽ là Watch Party hoàn chỉnh: Player đồng bộ real-time qua Socket.IO, chat và
          reaction. Đang chờ Backend (NestJS + WebSocket) hoàn thiện.
        </p>
      </div>
    </div>
  );
}
