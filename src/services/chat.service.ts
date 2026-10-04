import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import { publish } from '@/lib/ably';
import type { ChatMessage, Conversation } from '@/types';

export const chatService = {
  async forAppointment(appointmentId: string): Promise<Conversation> {
    return unwrap<Conversation>(supabase.rpc('get_or_create_appointment_conversation', {
      p_appointment_id: appointmentId,
    }));
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
