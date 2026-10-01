import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <p className="text-slate-500">This page doesn't exist in the MedSphere network.</p>
      <Link to="/app"><Button>Back to dashboard</Button></Link>
    </div>
  );
}