import { redirect } from 'next/navigation';

export default function NewActivationRedirect() {
  redirect('/launcher/activations/activate/new');
}
