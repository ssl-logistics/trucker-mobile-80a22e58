import { supabase } from "@/integrations/supabase/client";

export interface TaladMessage {
  id: string;
  job_id: string;
  direction: string;
  message: string;
  image_url: string | null;
  sender_name: string;
  sender_id?: string | null;
  created_at: string;
  pending?: boolean;
}

export interface TaladThread {
  job_id: string;
  job_title: string | null;
  last_message: TaladMessage | null;
  unread: number;
  message_count: number;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await supabase.functions.invoke("talad-chat", { body });
  if (error) {
    console.error("[taladChat] invoke error", error);
    return null;
  }
  return data as T;
}

export async function fetchTaladThreads(jobIds: string[], driverId?: string) {
  const res = await invoke<{ ok: boolean; threads: TaladThread[] }>({
    action: "threads",
    job_ids: jobIds,
    driver_id: driverId,
  });
  return res?.threads ?? [];
}

export async function fetchTaladMessages(jobId: string, driverId?: string) {
  const res = await invoke<{ ok: boolean; messages: TaladMessage[] }>({
    action: "messages",
    job_id: jobId,
    driver_id: driverId,
    limit: 100,
  });
  return res?.messages ?? [];
}

export async function sendTaladMessage(params: {
  jobId: string;
  message: string;
  driverId?: string;
  senderName?: string;
}) {
  return invoke<{
    ok: boolean;
    delivered: boolean;
    upstream_reason: string | null;
    message: TaladMessage;
  }>({
    action: "send",
    job_id: params.jobId,
    message: params.message,
    driver_id: params.driverId,
    sender_name: params.senderName,
  });
}
