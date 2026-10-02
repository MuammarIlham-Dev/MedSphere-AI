import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import { publish } from '@/lib/ably';
import type { ChatMessage, Conversation } from '@/types';

export const chatService = {
  async forAppointment(appointmentId: string, participantIds: string[]): Promise<Conversation> {
    const { data: existing } = await supabase.from('conversations')
      .select('*').eq('appointment_id', appointmentId).maybeSingle();
    if (existing) return existing as Conversation;
    const conv = await unwrap<Conversation>(
      supabase.from('conversations').insert({ appointment_id: appointmentId, subject: 'Consultation' }).select().single());
    await supabase.from('conversation_participants')
      .insert(participantIds.map((user_id) => ({ conversation_id: conv.id, user_id })));
    return conv;
  },

  history: (conversationId: string) =>
    unwrap<ChatMessage[]>(supabase.from('messages').select('*')
      .eq('conversation_id', conversationId).order('created_at').limit(200)),

  async send(conversationId: string, body: string): Promise<ChatMessage> {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    const message = await unwrap<ChatMessage>(
      supabase.from('messages').insert({ conversation_id: conversationId, sender_id: uid, body }).select().single());
    await publish(`chat:${conversationId}`, 'chat:message', { message });
    return message;
  },
};
