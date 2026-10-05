import { ArrowLeft, Compass } from 'lucide-react'
import { ButtonLink } from '../components/Button'
import { EmptyState } from '../components/EmptyState'

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass className="size-6" />}
      title="Page not found"
      description="The page you're looking for doesn't exist or was moved."
      action={
        <ButtonLink to="/" variant="primary" icon={<ArrowLeft className="size-4" />}>
          Back to dashboard
        </ButtonLink>
      }
    />
  )
}
