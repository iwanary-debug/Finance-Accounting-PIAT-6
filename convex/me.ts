import { query } from "./_generated/server";
import { requireUser } from "./lib/authz";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return { _id: user._id, name: user.name ?? "Pengguna PIAT 6", email: user.email ?? "", role: user.appRole, status: user.status };
  },
});
