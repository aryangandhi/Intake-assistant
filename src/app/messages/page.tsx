import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { formatShort } from "@/lib/answers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Text messages (simulated)" };

export default async function MessagesPage() {
  // Same patient sign-in as the simulated email inbox.
  const email = (await cookies()).get("proto_inbox")?.value;
  const referral = email ? await prisma.referral.findFirst({ where: { email } }) : null;
  const texts = referral ? await prisma.textMessage.findMany({ where: { referralId: referral.id }, orderBy: { sentAt: "desc" } }) : [];

  return (
    <div className="flex flex-1 flex-col bg-slate-100">
      <header className="flex items-center justify-between bg-slate-800 px-4 py-3 text-white">
        <div className="text-lg font-semibold">Messages <span className="text-sm font-normal text-slate-300">(simulated text messages)</span></div>
        <Link href="/inbox" className="text-sm underline">Email inbox</Link>
      </header>
      <main className="mx-auto w-full max-w-md px-4 py-8">
        {!referral ? (
          <p className="rounded-xl bg-white p-6 shadow">
            Please <Link href="/inbox" className="text-blue-800 underline">sign in to your inbox</Link> first to see your text messages.
          </p>
        ) : (
          <>
            <h1 className="mb-1 text-2xl font-bold">Text messages</h1>
            <p className="mb-4 text-sm text-gray-600">To {referral.phone}</p>
            {texts.length === 0 && <p className="text-gray-600">No text messages yet.</p>}
            <ul className="space-y-4">
              {texts.map((t) => (
                <li key={t.id} data-testid="text-message" className="rounded-2xl rounded-bl-sm bg-white p-4 text-lg shadow">
                  <div dangerouslySetInnerHTML={{ __html: t.bodyHtml.replace(/<a /g, '<a class="text-blue-800 underline" ') }} />
                  <p className="mt-2 text-xs text-gray-500">{formatShort(t.sentAt)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
