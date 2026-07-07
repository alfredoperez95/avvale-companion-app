export const EXPENSE_CATEGORIES = [
  'Travel Lodging',
  'Meals for External Activities',
  'Taxi',
  'Car Hire/Rental',
  'Tolls',
  'Parking',
  'Company/Rent car fuel',
  'Computer and other equipment',
  'Dues and Subscriptions',
  'Office Supplies',
  'Postage and Delivery',
  'Repairs and Maintenance',
  'PHONE and Internet expense',
  'Utilities',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === 'string' && EXPENSE_CATEGORIES.includes(value as ExpenseCategory);
}
