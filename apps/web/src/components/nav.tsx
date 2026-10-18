import { getSession } from "@/lib/auth/session";
import { unreadCount } from "@/lib/services/notifications";
import { Navigation } from "./navigation";
import { LiveNotifications } from "./live-notifications";

export async function Nav() {
  const user = await getSession();
  const unread = user ? await unreadCount(user.id) : 0;
  return <>
    {user && <LiveNotifications />}
    <Navigation user={user ? { name: user.name, email: user.email, roles: user.roles } : null} unread={unread} />
  </>;
}
