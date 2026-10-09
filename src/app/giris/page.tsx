import { redirect } from "next/navigation";
import { ErrorNote } from "@/components/ErrorNote";
import { loginAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Yalnızca uygulama içi göreli yollara yönlendir ("//başka-site" gibi adresleri reddet). */
const safeNext = (s: string) => (s.startsWith("/") && !s.startsWith("//") ? s : "/");

async function login(formData: FormData) {
  "use server";
  const next = safeNext(String(formData.get("sonra") ?? "/"));
  if (!(await loginAdmin(String(formData.get("password") ?? "")))) {
    redirect(`/giris?${new URLSearchParams({ hata: "Şifre yanlış", sonra: next })}`);
  }
  redirect(next);
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ hata?: string; sonra?: string }> }) {
  const { hata, sonra } = await searchParams;
  return (
    <div className="mx-auto max-w-sm space-y-4 pt-6">
      <h1 className="text-center">Salon sahibi girişi</h1>
      <ErrorNote message={hata} />
      <form action={login} className="card space-y-3">
        <input type="hidden" name="sonra" value={safeNext(sonra ?? "/")} />
        <div>
          <label className="label" htmlFor="password">Şifre</label>
          <input id="password" name="password" type="password" required autoFocus autoComplete="current-password" className="input w-full" />
        </div>
        <button className="btn btn-accent w-full">Giriş yap</button>
      </form>
      <p className="text-center text-sm text-zinc-500">
        Oyuncuysan salon sahibinin sana gönderdiği kişisel bağlantıyı aç; şifre gerekmez.
      </p>
    </div>
  );
}
