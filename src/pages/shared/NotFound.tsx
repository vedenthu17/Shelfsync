import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { homeFor } from '@/lib/permissions';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';

export default function NotFound() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <Card>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you are looking for does not exist or you do not have access to it."
        action={<Button onClick={() => navigate(user ? homeFor(user.role) : '/')}>Go to dashboard</Button>}
      />
    </Card>
  );
}
