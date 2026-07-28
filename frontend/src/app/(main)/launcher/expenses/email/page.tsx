import { redirect } from 'next/navigation';

/** La ayuda de gastos por email es un popup en la barra de pestañas; la ruta antigua redirige al listado. */
export default function ExpenseEmailFlowPage() {
  redirect('/launcher/expenses');
}
