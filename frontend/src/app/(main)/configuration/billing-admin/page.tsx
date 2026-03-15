import { redirect } from 'next/navigation';

export default function ConfigurationBillingRedirect() {
  redirect('/launcher/activations/configuration/billing-admin');
}
