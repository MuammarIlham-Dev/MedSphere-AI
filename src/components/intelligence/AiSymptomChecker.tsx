import { useState } from'react';
import { useSymptomChecker } from'@/hooks/queries/useAiQueries';
import { Card, CardHeader } from'@/components/ui/Card';
import { Button } from'@/components/ui/Button';
import { Input } from'@/components/ui/Input';
import { Badge } from'@/components/ui/Badge';
import { IoAlertCircleOutline, IoPulseOutline, IoChatbubbleEllipsesOutline } from'react-icons/io5';
import ReactMarkdown from'react-markdown';
import { Link } from'react-router-dom';

export function AiSymptomChecker() {
 const { mutate, isPending, data } = useSymptomChecker();
 const [step, setStep] = useState<'form' |'chat'>('form');
 const [form, setForm] = useState({ symptoms:'', duration:'', severity:'Moderate' });
 const [chatInput, setChatInput] = useState('');
 const [history, setHistory] = useState<{ role:'user'|'ai', content: string }[]>([]);

 const handleInitialSubmit = (e: React.SyntheticEvent) => {
 e.preventDefault();
 setStep('chat');
 mutate(form, {
 onSuccess: (res) => {
 setHistory([
 { role:'user', content: `Symptoms: ${form.symptoms}. Duration: ${form.duration}. Severity: ${form.severity}.` },
 { role:'ai', content: res.guidance }
 ]);
 }
 });
 };

 const handleChatSubmit = (e: React.SyntheticEvent) => {
 e.preventDefault();
 if (!chatInput.trim() || isPending) return;
 
 const newHistory = [...history, { role:'user' as const, content: chatInput }];
 setHistory(newHistory);
 setChatInput('');
 
 // We send the whole history as context to the API
 mutate({ ...form, history: JSON.stringify(newHistory) }, {
 onSuccess: (res) => {
 setHistory(prev => [...prev, { role:'ai', content: res.guidance }]);
 }
 });
 };

 return (
 <Card className="flex flex-col h-[600px] max-h-[80vh] bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
 <CardHeader 
 title="AI Symptom Checker" 
 subtitle="Powered by MedSphere AI Intelligence"
 action={<Badge tone="brand">Beta</Badge>}
 />
 
 {data?.disclaimer && (
 <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/50 p-3 px-5 flex items-start gap-3">
 <IoAlertCircleOutline className="text-amber-600 mt-0.5 flex-shrink-0" />
 <p className="text-xs text-amber-800 dark:text-amber-400">
 <strong>Disclaimer:</strong> This is an AI-generated assessment for informational purposes only. It is not a medical diagnosis. Always consult a healthcare professional.
 </p>
 </div>
 )}

 <div className="flex-1 overflow-y-auto p-5 space-y-6">
 {step ==='form' ? (
 <form id="symptom-form" onSubmit={handleInitialSubmit} className="space-y-4">
 <div>
 <label className="block text-sm font-medium mb-1">What are your main symptoms?</label>
 <Input 
 placeholder="e.g. Headache, fever, and slight cough" 
 value={form.symptoms} onChange={e => { setForm({...form, symptoms: e.target.value}); }} 
 required 
 />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium mb-1">Duration</label>
 <Input 
 placeholder="e.g. 3 days" 
 value={form.duration} onChange={e => { setForm({...form, duration: e.target.value}); }} 
 required 
 />
 </div>
 <div>
 <label className="block text-sm font-medium mb-1">Severity</label>
 <select 
 className="w-full flex h-10 rounded-xl border border-border bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900"
 value={form.severity} onChange={e => { setForm({...form, severity: e.target.value}); }}
 >
 <option>Mild</option>
 <option>Moderate</option>
 <option>Severe</option>
 </select>
 </div>
 </div>
 </form>
 ) : (
 <div className="space-y-4">
 {history.map((msg, idx) => (
 <div key={idx} className={`flex ${msg.role ==='user' ?'justify-end' :'justify-start'}`}>
 <div className={`max-w-[85%] rounded-2xl p-4 text-sm ${
 msg.role ==='user' 
 ?'bg-brand-500 text-white rounded-br-none' 
 :'bg-white dark:bg-slate-800 border border-slate-100 shadow-sm rounded-bl-none'
 }`}>
 {msg.role ==='user' ? (
 msg.content
 ) : (
 <div className="prose prose-sm dark:prose-invert max-w-none">
 <ReactMarkdown>{msg.content}</ReactMarkdown>
 </div>
 )}
 </div>
 </div>
 ))}
 {isPending && (
 <div className="flex justify-start">
 <div className="bg-white dark:bg-slate-800 border border-slate-100 shadow-sm rounded-2xl rounded-bl-none p-4 flex items-center gap-2">
 <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce"></span>
 <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce delay-75"></span>
 <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce delay-150"></span>
 </div>
 </div>
 )}
 </div>
 )}
 </div>

 <div className="p-4 border-t border-slate-100 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
 {step ==='form' ? (
 <Button form="symptom-form" type="submit" className="w-full" disabled={isPending}>
 <IoPulseOutline className="mr-2" />
 Analyze Symptoms
 </Button>
 ) : (
 <div className="space-y-3">
 {data && (
 <div className="flex items-center justify-between text-xs px-1">
 <div className="flex items-center gap-2 text-muted-foreground">
 <span>AI Confidence:</span>
 <Badge tone={data.confidence ==='High' ?'success' : data.confidence ==='Medium' ?'warning' :'danger'}>
 {data.confidence}
 </Badge>
 </div>
 <Link to="/app/appointments" className="text-brand-600 hover:underline font-medium">
 Escalate to Professional
 </Link>
 </div>
 )}
 <form onSubmit={handleChatSubmit} className="flex gap-2">
 <Input 
 placeholder="Ask follow-up questions..." 
 value={chatInput} onChange={e => { setChatInput(e.target.value); }}
 className="flex-1"
 disabled={isPending}
 />
 <Button type="submit" disabled={isPending || !chatInput.trim()} className="px-4">
 <IoChatbubbleEllipsesOutline />
 </Button>
 </form>
 </div>
 )}
 </div>
 </Card>
 );
}
