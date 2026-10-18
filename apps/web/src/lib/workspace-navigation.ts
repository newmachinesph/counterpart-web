const WORKSPACE_ROOTS = ["/dashboard", "/pairings", "/ventures", "/notifications", "/settings", "/support", "/admin"];

export function isWorkspacePath(pathname: string) {
  return WORKSPACE_ROOTS.some(root => pathname === root || pathname.startsWith(`${root}/`));
}

export function userInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${Array.from(parts[0])[0]}${Array.from(parts[parts.length - 1])[0]}` : Array.from(parts[0] ?? "?").slice(0, 2).join("")).toLocaleUpperCase();
}
