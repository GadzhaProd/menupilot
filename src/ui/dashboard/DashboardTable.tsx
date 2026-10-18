import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Adapted from Origin UI Table, licensed MIT.
 * Source: https://21st.dev/@originui/components/table
 */
export const DashboardTable = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-x-auto">
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-sm', className)}
      {...props}
    />
  </div>
));
DashboardTable.displayName = 'DashboardTable';

export const DashboardTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn(className)} {...props} />
));
DashboardTableHeader.displayName = 'DashboardTableHeader';

export const DashboardTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
));
DashboardTableBody.displayName = 'DashboardTableBody';

export const DashboardTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-border transition-colors hover:bg-muted/50',
      className,
    )}
    {...props}
  />
));
DashboardTableRow.displayName = 'DashboardTableRow';

export const DashboardTableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-12 px-3 text-left align-middle font-medium text-muted-foreground',
      className,
    )}
    {...props}
  />
));
DashboardTableHead.displayName = 'DashboardTableHead';

export const DashboardTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('p-3 align-middle', className)}
    {...props}
  />
));
DashboardTableCell.displayName = 'DashboardTableCell';
