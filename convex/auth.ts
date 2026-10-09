import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

const PasswordProvider = Password({
  profile: (params: Record<string, unknown>) => {
    const email = String(params.email ?? "").trim().toLowerCase();
    return {
      email,
      name: String(params.name ?? email.split("@")[0] ?? "Pengguna PIAT 6"),
      status: "ACTIVE" as const,
    };
  },
  validatePasswordRequirements: (password: string) => {
    if (password.length < 10) throw new Error("Kata sandi minimal 10 karakter.");
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      throw new Error("Kata sandi harus memuat huruf besar, huruf kecil, dan angka.");
    }
  },
} as any);

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [PasswordProvider],
  callbacks: {
    createOrUpdateUser: async (ctx, { existingUserId, profile }) => {
      const email = typeof profile.email === "string" ? profile.email : undefined;
      const name = typeof profile.name === "string" ? profile.name : undefined;
      if (existingUserId) {
        const existing = await ctx.db.get(existingUserId);
        if (!existing) throw new Error("Pengguna tidak ditemukan.");
        await ctx.db.patch(existingUserId, {
          ...(email ? { email } : {}),
          ...(name ? { name } : {}),
          status: "ACTIVE",
        });
        return existingUserId;
      }

      const firstUser = await ctx.db.query("users").first();
      return await ctx.db.insert("users", {
        ...(email ? { email } : {}),
        ...(name ? { name } : {}),
        appRole: firstUser ? "BENDAHARA" : "SUPER_ADMIN",
        status: "ACTIVE",
      });
    },
  },
});
