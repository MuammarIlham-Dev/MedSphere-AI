import { formatDate } from '@/lib/utils';
import { Appointment } from'@/types';

export function downloadIcs(appointment: Appointment) {
 const start = new Date(appointment.scheduled_at);
 const duration = appointment.duration_min || 15;
 const end = new Date(start.getTime() + duration * 60000);

 const formatDate = (date: Date) => {
 return (date.toISOString().replace(/[-:]/g,'').split('.')[0] ?? '') +'Z';
 };

 const icsContent = [
'BEGIN:VCALENDAR',
'VERSION:2.0',
'PRODID:-//MedSphere AI//EN',
'BEGIN:VEVENT',
 `UID:${appointment.id}`,
 `DTSTAMP:${formatDate(new Date())}`,
 `DTSTART:${formatDate(start)}`,
 `DTEND:${formatDate(end)}`,
 `SUMMARY:Consultation with ${appointment.doctor_name ||'Doctor'}`,
  `DESCRIPTION:Consultation Type: ${appointment.type}. Token: ${appointment.token_number.toString()}`,
'END:VEVENT',
'END:VCALENDAR'
 ].join('\r\n');

 const blob = new Blob([icsContent], { type:'text/calendar;charset=utf-8' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = `appointment-${appointment.id}.ics`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
}
