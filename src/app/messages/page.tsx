import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { INTAKE_TEXT_SENDER } from "@/content/intakeText";
import { PhoneMessages } from "./PhoneMessages";
import { PHONE_UNLOCK_COOKIE } from "@/lib/phone";

export const dynamic = "force-dynamic";
export const metadata = { title: "Text messages (simulated)" };

// iOS-style timestamp shown above a message, e.g. "Mon, Nov 23 at 9:41 AM".
function iosTimestamp(d: Date): string {
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} at ${time}`;
}

export default async function MessagesPage() {
  const store = await cookies();
  // Same patient sign-in as the simulated email inbox.
  const email = store.get("proto_inbox")?.value;
  const unlocked = store.get(PHONE_UNLOCK_COOKIE)?.value === "1";
  const referral = email ? await prisma.referral.findFirst({ where: { email } }) : null;
  // Oldest first, newest at the bottom, like the iPhone Messages app.
  const texts = referral ? await prisma.textMessage.findMany({ where: { referralId: referral.id }, orderBy: { sentAt: "asc" } }) : [];

  return (
    <div className="flex flex-1 flex-col bg-slate-100">
      <header className="flex items-center justify-between bg-slate-800 px-4 py-3 text-white">
        <div className="text-lg font-semibold">Messages <span className="text-sm font-normal text-slate-300">(simulated text messages)</span></div>
      </header>
      <main className="flex flex-1 flex-col items-center px-4 py-6">
        <PhoneMessages
          initiallyUnlocked={unlocked}
          signedIn={!!referral}
          sender={INTAKE_TEXT_SENDER}
          texts={texts.map((t) => ({ id: t.id, html: t.bodyHtml, time: iosTimestamp(t.sentAt) }))}
        />
      </main>
    </div>
  );
}
