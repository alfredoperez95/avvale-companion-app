import type { ComponentType, SVGProps } from 'react';
import {
  BedRegular,
  BoxRegular,
  DeleteRegular,
  AttachRegular,
  FlashRegular,
  FoodRegular,
  GasPumpRegular,
  LaptopRegular,
  PaymentRegular,
  PenRegular,
  PhoneRegular,
  ReceiptRegular,
  TicketDiagonalRegular,
  VehicleCabRegular,
  VehicleCarParkingRegular,
  VehicleCarRegular,
  WrenchRegular,
} from '@fluentui/react-icons';
import styles from './expenses-process.module.css';

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

type FluentIcon = ComponentType<SVGProps<SVGSVGElement> & { primaryFill?: string; fontSize?: number }>;

const EXPENSE_CATEGORY_SET = new Set<string>(EXPENSE_CATEGORIES);

export function isExpenseCategory(value: string | null | undefined): value is ExpenseCategory {
  return typeof value === 'string' && EXPENSE_CATEGORY_SET.has(value);
}

const CATEGORY_ICON: Record<ExpenseCategory, FluentIcon> = {
  'Travel Lodging': BedRegular,
  'Meals for External Activities': FoodRegular,
  Taxi: VehicleCabRegular,
  'Car Hire/Rental': VehicleCarRegular,
  Tolls: TicketDiagonalRegular,
  Parking: VehicleCarParkingRegular,
  'Company/Rent car fuel': GasPumpRegular,
  'Computer and other equipment': LaptopRegular,
  'Dues and Subscriptions': PaymentRegular,
  'Office Supplies': PenRegular,
  'Postage and Delivery': BoxRegular,
  'Repairs and Maintenance': WrenchRegular,
  'PHONE and Internet expense': PhoneRegular,
  Utilities: FlashRegular,
};

const CATEGORY_TONE_CLASS: Record<ExpenseCategory, string> = {
  'Travel Lodging': styles.categoryIconTravel,
  'Meals for External Activities': styles.categoryIconMeals,
  Taxi: styles.categoryIconTaxi,
  'Car Hire/Rental': styles.categoryIconCar,
  Tolls: styles.categoryIconTolls,
  Parking: styles.categoryIconParking,
  'Company/Rent car fuel': styles.categoryIconFuel,
  'Computer and other equipment': styles.categoryIconComputer,
  'Dues and Subscriptions': styles.categoryIconDues,
  'Office Supplies': styles.categoryIconOffice,
  'Postage and Delivery': styles.categoryIconPostage,
  'Repairs and Maintenance': styles.categoryIconRepairs,
  'PHONE and Internet expense': styles.categoryIconPhone,
  Utilities: styles.categoryIconUtilities,
};

const ICON_SIZE = 16;

export function ExpenseCategoryIcon({
  category,
  className,
}: {
  category: string | null | undefined;
  className?: string;
}) {
  if (!isExpenseCategory(category)) return null;

  const Icon = CATEGORY_ICON[category];

  return (
    <span
      className={[styles.categoryIcon, CATEGORY_TONE_CLASS[category], className].filter(Boolean).join(' ')}
      aria-hidden
    >
      <Icon fontSize={ICON_SIZE} aria-hidden />
    </span>
  );
}

export function ExpenseCategoryLabel({
  category,
  pendingLabel = 'Pendiente de revisar',
  className,
  iconClassName,
  labelClassName,
  pendingClassName,
}: {
  category: string | null | undefined;
  pendingLabel?: string;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  pendingClassName?: string;
}) {
  if (!category) {
    return <span className={[pendingClassName, className].filter(Boolean).join(' ')}>{pendingLabel}</span>;
  }

  return (
    <span className={[styles.categoryLabel, className].filter(Boolean).join(' ')}>
      <ExpenseCategoryIcon category={category} className={iconClassName} />
      <span className={labelClassName}>{category}</span>
    </span>
  );
}

export function expenseCategoryLabel(category: string | null | undefined, pendingLabel = 'Pendiente de revisar'): string {
  if (!category) return pendingLabel;
  return category;
}

export function ExpenseAttachmentIcon({ className }: { className?: string }) {
  return <AttachRegular className={className} fontSize={ICON_SIZE} aria-hidden />;
}

export function ExpenseDeleteIcon({ className }: { className?: string }) {
  return <DeleteRegular className={className} fontSize={ICON_SIZE} aria-hidden />;
}

/** Icono genérico para recibos / tolls cuando haga falta fuera del mapa de categorías. */
export function ExpenseReceiptIcon({ className }: { className?: string }) {
  return <ReceiptRegular className={className} fontSize={ICON_SIZE} aria-hidden />;
}
