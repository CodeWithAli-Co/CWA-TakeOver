export const locale = navigator.language;

type FormatDateForms = "default" | "short" | "week-day";

/**
 * Format the ms Date into Date based on locale timezone.
 *
 * @param date The Date in miliseconds ( ms )
 * @param form The format. Options: `default`, `short`, `week-day`
 * @returns Fomrated date with Month, Day and Year
 */
export const FormatDate = (date: number, form: FormatDateForms = "default") => {
  const stringDate = new Date(date);
  switch (form) {
    case "short":
      return stringDate.toLocaleDateString(locale, {
        month: "numeric",
        day: "numeric",
        year: "numeric",
      });
    case "week-day":
      return stringDate.toLocaleDateString(locale, {
        day: "numeric",
        weekday: "short",
      });
    default:
      return stringDate.toLocaleDateString(locale, {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
  }
};

/**
 * Format ms Date into Date and Time based on locale timezone.
 *
 * @example
 * // Output:
 * "June 05, 2025 at 5:00 PM"
 * @param date The Date in miliseconds ( ms )
 * @returns Formated date with Month, Day, Year and Time
 */
export const FormatDateTime = (date: number) => {
  // const { data, error } = UserPreferences();
  // const locale = data?.locale ?? locale;

  // if (error) {
  //   const stringDate = new Date(date);
  //   return stringDate.toLocaleDateString("en-US", {
  //     month: "long",
  //     day: "numeric",
  //     year: "numeric",
  //     hour: "numeric",
  //     minute: "numeric",
  //   });
  // }
  const stringDate = new Date(date);
  return stringDate.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
};

// export const FormatDate = (date: number) => {
//   const stringDate = new Date(date)
//   return stringDate.toLocaleDateString(undefined, {
//     month: "long",
//     day: "numeric",
//     year: "numeric",
//   });
// };
// const todaysDate = Date.now(); // Returns date in ms ( number ) --> This is what the input fields of forms need to return
// then format the date using FormatDate() and save it in DB so can display easily as string
// const stringDate = new Date(todaysDate) // Also returns timezone
// console.log('Stringified Date', stringDate)
// console.log(stringDate.toLocaleDateString(undefined, {
//   month: 'long',
//   day: 'numeric',
//   year: 'numeric'
// })) // Only prints out the month, day, year

/**
 * Calculate next payment date based on frequency
 * Used for recurring income sources
 *
 * **Note: Uses lastReceived ( or payPeriodStart ) to calculated nextPaymentDate ( or payPeriodEnd )*
 *
 * @param frequency The frequency of the Income Stream
 * @param startDate The lastReceived ( or payPeriodStart ) date in ms Date format
 * @returns The `nextPaymentDate` ( or `payPeriodEnd` ) in ms Date format
 */
export const getNextPaymentDate = (
  frequency: string,
  startDate: number
): number => {
  if (frequency === "one-time") {
    throw new Error(
      "This is a one-time income, cant calculate next payment date."
    );
  }

  const today = Date.now();
  const nextPayment = new Date(startDate || today);

  switch (frequency) {
    case "weekly":
      return nextPayment.setDate(nextPayment.getDate() + 7);
    case "bi-weekly":
      return nextPayment.setDate(nextPayment.getDate() + 14);
    case "monthly":
      return nextPayment.setMonth(nextPayment.getMonth() + 1);
    case "quarterly":
      return nextPayment.setMonth(nextPayment.getMonth() + 3);
    case "annually":
      return nextPayment.setFullYear(nextPayment.getFullYear() + 1);
    default:
      return nextPayment.setMonth(nextPayment.getMonth() + 1);
  }
};

/**
 * Calculate initial payment date based on frequency
 * Used for recurring income sources
 *
 * **Note: Uses payPeriodEnd to calculate payPeriodStart*
 *
 * @param frequency The frequency of the Income Stream
 * @param paidDate The payPeriodEnd date in ms Date format
 *
 * @returns The `payPeriodStart` in ms Date format
 */
export const getInitialPaymentDate = (
  frequency: string,
  paidDate: number
): number => {
  if (frequency === "one-time") return paidDate;

  const today = Date.now();
  const nextPayment = new Date(paidDate || today);

  switch (frequency) {
    case "weekly":
      return nextPayment.setDate(nextPayment.getDate() - 7);
    case "bi-weekly":
      return nextPayment.setDate(nextPayment.getDate() - 14);
    case "monthly":
      return nextPayment.setMonth(nextPayment.getMonth() - 1);
    case "quarterly":
      return nextPayment.setMonth(nextPayment.getMonth() - 3);
    case "annually":
      return nextPayment.setFullYear(nextPayment.getFullYear() - 1);
    default:
      return nextPayment.setMonth(nextPayment.getMonth() - 1);
  }
};
