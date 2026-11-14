/** Admin-controlled announcement strip (text from store settings). */
export function AnnouncementBar({ text }: { text: string }) {
  return (
    <div className="bg-ink text-paper">
      <p className="container-site py-2 text-center text-[10px] font-medium tracking-label uppercase sm:text-[11px]">
        {text}
      </p>
    </div>
  );
}
