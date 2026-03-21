import { redirect } from 'next/navigation';

export default function ConfigurationFirmaRedirect() {
  redirect('/launcher/activations/configuration/email-signature');
}
