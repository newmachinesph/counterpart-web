import { api } from '@/lib/api/client';
import { getStore } from '@/lib/data/store';
import type { Notification } from "@/lib/domain/types";
import { createReadModel } from './read-model';

export async function listNotifications(userId: string): Promise<Notification[]> { return createReadModel(await getStore()).listNotifications(userId); }
export async function unreadCount(userId: string): Promise<number> { return createReadModel(await getStore()).unreadCount(userId); }
export async function listOutbox() { return createReadModel(await getStore()).listOutbox(); }
export async function markAllRead(_userId: string): Promise<void> { void _userId; return api('/notifications/read', {}); }
