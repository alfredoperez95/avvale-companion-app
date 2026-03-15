import { redirect } from 'next/navigation';

export default function ActivationsRedirect() {
  redirect('/launcher/activations/activate');
}
