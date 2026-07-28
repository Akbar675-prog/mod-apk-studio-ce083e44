import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAccountAuth } from "@/integrations/auth-supabase/auth-middleware";
import {
  registerAccount,
  emailForIdentifier,
  getMyProfile,
  getProfileByUserNo,
  changeUsername,
  changeName,
  setAvatarFromBytes,
  setAvatarFromUrl,
  toggleFollow,
  submitVerification,
  myVerificationStatus,
  listVerificationRequests,
  decideVerification,
  adminSearchUsers,
  adminUpdateUser,
} from "./account.server";

export type { PublicProfile } from "./account.server";

export const registerAccountFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(40),
        username: z.string().trim().min(3).max(20),
        email: z.string().trim().email().max(255),
        password: z.string().min(6).max(72),
      })
      .parse(d),
  )
  .handler(async ({ data }) => registerAccount(data));

export const resolveLoginEmailFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ identifier: z.string().trim().min(1).max(255) }).parse(d))
  .handler(async ({ data }) => emailForIdentifier(data.identifier));

export const myProfileFn = createServerFn({ method: "GET" })
  .middleware([requireAccountAuth])
  .handler(async ({ context }) => getMyProfile(context.userId));

export const userProfileFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ userNo: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => getProfileByUserNo(data.userNo));

export const followStateFn = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((d: unknown) => z.object({ userNo: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await getProfileByUserNo(data.userNo, context.userId);
    return { is_self: !!p?.is_self, is_following: !!p?.is_following };
  });

export const toggleFollowFn = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((d: unknown) => z.object({ userNo: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => toggleFollow(context.userId, data.userNo));

export const changeUsernameFn = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((d: unknown) => z.object({ username: z.string().trim().min(3).max(20) }).parse(d))
  .handler(async ({ data, context }) => changeUsername(context.userId, data.username));

export const changeNameFn = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().trim().min(2).max(40) }).parse(d))
  .handler(async ({ data, context }) => changeName(context.userId, data.name));

export const setAvatarUrlFn = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().trim().url().max(2000) }).parse(d))
  .handler(async ({ data, context }) => setAvatarFromUrl(context.userId, data.url));

export const uploadAvatarFn = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        base64: z.string().min(10).max(7_000_000),
        contentType: z.string().min(3).max(80),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const bin = atob(data.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return setAvatarFromBytes(context.userId, bytes, data.contentType);
  });

export const submitVerificationFn = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((d: unknown) =>
    z.object({ reason: z.string().trim().min(10).max(1000), links: z.string().trim().max(500).default("") }).parse(d),
  )
  .handler(async ({ data, context }) => submitVerification(context.userId, data.reason, data.links));

export const myVerificationFn = createServerFn({ method: "GET" })
  .middleware([requireAccountAuth])
  .handler(async ({ context }) => myVerificationStatus(context.userId));

export const listVerificationRequestsFn = createServerFn({ method: "GET" })
  .middleware([requireAccountAuth])
  .handler(async ({ context }) => listVerificationRequests(context.userId));

export const decideVerificationFn = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => decideVerification(context.userId, data.id, data.approve));

export const adminSearchUsersFn = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().max(80).default("") }).parse(d))
  .handler(async ({ data, context }) => adminSearchUsers(context.userId, data.q));

export const adminUpdateUserFn = createServerFn({ method: "POST" })
  .middleware([requireAccountAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        target: z.string().uuid(),
        verified: z.boolean().optional(),
        fake_followers: z.number().min(0).max(1e15).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    adminUpdateUser(context.userId, data.target, {
      verified: data.verified,
      fake_followers: data.fake_followers,
    }),
  );
