import { avatarUrlFor } from "./user-content";

export type PublicProfile = {
  id: string;
  user_no: number;
  name: string;
  username: string;
  avatar_url: string | null;
  verified: boolean;
  followers: number;
  following: number;
  created_at: string;
};

const AVATAR_BUCKET = "user-avatars";

async function admin() {
  const { authSupabaseAdmin } = await import("@/integrations/auth-supabase/client.server");
  return authSupabaseAdmin as any;
}

export function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

export function validateUsername(u: string): string | null {
  if (!/^[a-z0-9_.]{3,20}$/.test(normalizeUsername(u)))
    return "Username hanya boleh huruf, angka, titik, dan underscore (3-20 karakter).";
  return null;
}

async function followerCounts(db: any, id: string, fake: number) {
  const [{ count: followers }, { count: following }] = await Promise.all([
    db.from("follows").select("*", { count: "exact", head: true }).eq("following_id", id),
    db.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
  ]);
  return { followers: (followers ?? 0) + Number(fake ?? 0), following: following ?? 0 };
}

function toPublic(row: any, counts: { followers: number; following: number }): PublicProfile {
  return {
    id: row.id,
    user_no: Number(row.user_no),
    name: row.name,
    username: row.username,
    avatar_url: row.avatar_url ?? null,
    verified: !!row.verified,
    created_at: row.created_at,
    ...counts,
  };
}

export async function registerAccount(input: {
  name: string;
  username: string;
  email: string;
  password: string;
}) {
  const db = await admin();
  const username = normalizeUsername(input.username);

  const { data: taken } = await db
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (taken) throw new Error("Username telah digunakan.");

  const { data: created, error } = await db.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name.trim(), username },
  });
  if (error || !created?.user) {
    const msg = error?.message ?? "Gagal membuat akun.";
    throw new Error(/already/i.test(msg) ? "Email telah digunakan." : msg);
  }

  const { data: profile, error: pErr } = await db
    .from("profiles")
    .insert({ id: created.user.id, name: input.name.trim(), username })
    .select("*")
    .single();
  if (pErr) {
    await db.auth.admin.deleteUser(created.user.id);
    throw new Error(/duplicate/i.test(pErr.message) ? "Username telah digunakan." : pErr.message);
  }

  // First ever account owns the site.
  if (Number(profile.user_no) === 1) {
    await db.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
  }

  return { email: created.user.email as string, user_no: Number(profile.user_no) };
}

export async function emailForIdentifier(identifier: string) {
  const id = identifier.trim();
  if (id.includes("@")) return { email: id.toLowerCase() };
  const db = await admin();
  const { data } = await db
    .from("profiles")
    .select("id")
    .ilike("username", normalizeUsername(id))
    .maybeSingle();
  if (!data) throw new Error("Akun tidak ditemukan.");
  const { data: user } = await db.auth.admin.getUserById(data.id);
  if (!user?.user?.email) throw new Error("Akun tidak ditemukan.");
  return { email: user.user.email as string };
}

/** Create a profile row for a user that signed in via OAuth (no register form). */
async function ensureProfile(userId: string) {
  const db = await admin();
  const { data: user } = await db.auth.admin.getUserById(userId);
  const meta = (user?.user?.user_metadata ?? {}) as Record<string, unknown>;
  const email = (user?.user?.email as string | undefined) ?? "";
  const rawName =
    (meta.name as string) || (meta.full_name as string) || email.split("@")[0] || "Pengguna";
  const base = normalizeUsername(
    (meta.username as string) || email.split("@")[0] || "user",
  ).replace(/[^a-z0-9_.]/g, "");
  let candidate = (base || "user").slice(0, 16);
  if (candidate.length < 3) candidate = `user${candidate}`;
  for (let i = 0; i < 12; i++) {
    const username = i === 0 ? candidate : `${candidate}${Math.floor(Math.random() * 10000)}`;
    const { data: taken } = await db
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    if (taken) continue;
    const { data: profile, error } = await db
      .from("profiles")
      .insert({ id: userId, name: rawName.slice(0, 40), username })
      .select("*")
      .single();
    if (!error && profile) {
      // Google/OAuth avatars: copy the provider picture into our own storage
      // so it is served from galileouserscontent.visora.my.id.
      const picture =
        (meta.avatar_url as string) || (meta.picture as string) || "";
      if (picture.startsWith("http")) {
        try {
          const res = await setAvatarFromUrl(userId, picture);
          profile.avatar_url = res.avatar_url;
        } catch {
          /* avatar is optional; keep the account usable */
        }
      }
      if (Number(profile.user_no) === 1) {
        await db.from("user_roles").insert({ user_id: userId, role: "admin" });
      }
      return profile;
    }
    if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
  }
  return null;
}

export async function getMyProfile(userId: string) {
  const db = await admin();
  let { data } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!data) data = await ensureProfile(userId);
  if (!data) return null;
  const counts = await followerCounts(db, userId, data.fake_followers);
  const { count: nameChanges } = await db
    .from("name_changes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("changed_at", new Date(Date.now() - 86400000).toISOString());
  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", userId);
  return {
    ...toPublic(data, counts),
    username_changed_at: data.username_changed_at as string | null,
    name_changes_today: nameChanges ?? 0,
    is_admin: (roles ?? []).some((r: any) => r.role === "admin"),
  };
}

export async function getProfileByUserNo(userNo: number, viewerId?: string) {
  const db = await admin();
  const { data } = await db.from("profiles").select("*").eq("user_no", userNo).maybeSingle();
  if (!data) return null;
  const counts = await followerCounts(db, data.id, data.fake_followers);
  let isFollowing = false;
  if (viewerId && viewerId !== data.id) {
    const { data: f } = await db
      .from("follows")
      .select("follower_id")
      .eq("follower_id", viewerId)
      .eq("following_id", data.id)
      .maybeSingle();
    isFollowing = !!f;
  }
  return { ...toPublic(data, counts), is_self: viewerId === data.id, is_following: isFollowing };
}

export async function changeUsername(userId: string, next: string) {
  const err = validateUsername(next);
  if (err) throw new Error(err);
  const db = await admin();
  const username = normalizeUsername(next);
  const { data: me } = await db.from("profiles").select("*").eq("id", userId).single();
  if (me.username === username) throw new Error("Username sama dengan sekarang.");
  if (me.username_changed_at) {
    const next7 = Date.parse(me.username_changed_at) + 7 * 86400000;
    if (Date.now() < next7) {
      const days = Math.ceil((next7 - Date.now()) / 86400000);
      throw new Error(`Username baru bisa diganti lagi dalam ${days} hari.`);
    }
  }
  const { data: taken } = await db
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (taken) throw new Error("Username telah digunakan.");
  const { error } = await db
    .from("profiles")
    .update({ username, username_changed_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function changeName(userId: string, name: string) {
  const clean = name.trim();
  if (clean.length < 2 || clean.length > 40) throw new Error("Nama harus 2-40 karakter.");
  const db = await admin();
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await db
    .from("name_changes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("changed_at", since);
  if ((count ?? 0) >= 5) throw new Error("Batas ganti nama tercapai (5x per hari).");
  const { error } = await db.from("profiles").update({ name: clean }).eq("id", userId);
  if (error) throw new Error(error.message);
  await db.from("name_changes").insert({ user_id: userId });
  return { ok: true, remaining: 4 - (count ?? 0) };
}

export async function setAvatarFromBytes(userId: string, bytes: Uint8Array, contentType: string) {
  if (bytes.byteLength > 4 * 1024 * 1024) throw new Error("Gambar maksimal 4MB.");
  if (!/^image\//.test(contentType)) throw new Error("File harus berupa gambar.");
  const db = await admin();
  const ext = contentType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await db.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Gagal upload: ${error.message}`);
  const url = avatarUrlFor(path);
  await db.from("profiles").update({ avatar_url: url }).eq("id", userId);
  return { avatar_url: url };
}

export async function setAvatarFromUrl(userId: string, url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL gambar tidak valid.");
  }
  if (parsed.protocol !== "https:") throw new Error("URL gambar harus https.");
  const res = await fetch(parsed.toString());
  if (!res.ok) throw new Error("Gambar tidak bisa diambil dari URL itu.");
  const type = res.headers.get("content-type") ?? "image/png";
  if (!/^image\//.test(type)) throw new Error("URL itu bukan gambar.");
  const buf = new Uint8Array(await res.arrayBuffer());
  return setAvatarFromBytes(userId, buf, type.split(";")[0]);
}

export async function readAvatar(path: string) {
  const db = await admin();
  const { data, error } = await db.storage.from(AVATAR_BUCKET).download(path);
  if (error || !data) return null;
  return { bytes: await data.arrayBuffer(), type: data.type || "image/png" };
}

export async function toggleFollow(userId: string, targetUserNo: number) {
  const db = await admin();
  const { data: target } = await db
    .from("profiles")
    .select("id")
    .eq("user_no", targetUserNo)
    .maybeSingle();
  if (!target) throw new Error("Akun tidak ditemukan.");
  if (target.id === userId) throw new Error("Tidak bisa mengikuti diri sendiri.");
  const { data: existing } = await db
    .from("follows")
    .select("follower_id")
    .eq("follower_id", userId)
    .eq("following_id", target.id)
    .maybeSingle();
  if (existing) {
    await db.from("follows").delete().eq("follower_id", userId).eq("following_id", target.id);
    return { following: false };
  }
  await db.from("follows").insert({ follower_id: userId, following_id: target.id });
  return { following: true };
}

export async function submitVerification(userId: string, reason: string, links: string) {
  if (reason.trim().length < 10) throw new Error("Alasan minimal 10 karakter.");
  const db = await admin();
  const { data: pending } = await db
    .from("verification_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) throw new Error("Permintaan kamu masih diproses.");
  const { error } = await db
    .from("verification_requests")
    .insert({ user_id: userId, reason: reason.trim(), links: links.trim() || null });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function myVerificationStatus(userId: string) {
  const db = await admin();
  const { data } = await db
    .from("verification_requests")
    .select("status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: profile } = await db.from("profiles").select("verified").eq("id", userId).single();
  return { latest: data ?? null, verified: !!profile?.verified };
}

export async function requireAdmin(userId: string) {
  const db = await admin();
  const { data } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Khusus owner.");
  return db;
}

export async function listVerificationRequests(userId: string) {
  const db = await requireAdmin(userId);
  const { data } = await db
    .from("verification_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const ids = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
  const { data: profiles } = ids.length
    ? await db.from("profiles").select("id, name, username, user_no, avatar_url, verified").in("id", ids)
    : { data: [] as any[] };
  const map = new Map<string, any>((profiles ?? []).map((p: any) => [p.id as string, p]));
  return (data ?? []).map((r: any) => ({
    id: r.id as string,
    user_id: r.user_id as string,
    reason: r.reason as string,
    links: (r.links ?? null) as string | null,
    status: r.status as string,
    created_at: r.created_at as string,
    profile: (map.get(r.user_id) ?? null) as {
      id: string;
      name: string;
      username: string;
      user_no: number;
      avatar_url: string | null;
      verified: boolean;
    } | null,
  }));
}

export async function decideVerification(userId: string, id: string, approve: boolean) {
  const db = await requireAdmin(userId);
  const { data: req } = await db
    .from("verification_requests")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (!req) throw new Error("Permintaan tidak ditemukan.");
  await db
    .from("verification_requests")
    .update({ status: approve ? "approved" : "rejected" })
    .eq("id", id);
  if (approve) await db.from("profiles").update({ verified: true }).eq("id", req.user_id);
  return { ok: true };
}

export async function adminSearchUsers(userId: string, q: string) {
  const db = await requireAdmin(userId);
  let query = db
    .from("profiles")
    .select("id, user_no, name, username, avatar_url, verified, fake_followers")
    .order("user_no", { ascending: true })
    .limit(50);
  if (q.trim()) query = query.or(`username.ilike.%${q.trim()}%,name.ilike.%${q.trim()}%`);
  const { data } = await query;
  const rows = data ?? [];
  const withEmail = await Promise.all(
    rows.map(async (r: any) => {
      const { data: u } = await db.auth.admin.getUserById(r.id);
      return { ...r, fake_followers: Number(r.fake_followers), email: u?.user?.email ?? null };
    }),
  );
  if (!q.trim() || rows.length) return withEmail;
  return withEmail;
}

export async function adminUpdateUser(
  userId: string,
  target: string,
  patch: { verified?: boolean; fake_followers?: number },
) {
  const db = await requireAdmin(userId);
  const update: Record<string, unknown> = {};
  if (patch.verified !== undefined) update.verified = patch.verified;
  if (patch.fake_followers !== undefined)
    update.fake_followers = Math.max(0, Math.floor(patch.fake_followers));
  const { error } = await db.from("profiles").update(update).eq("id", target);
  if (error) throw new Error(error.message);
  return { ok: true };
}
