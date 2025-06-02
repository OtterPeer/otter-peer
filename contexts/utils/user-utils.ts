export const INVALID_NAME_SYMBOLS_REGEX: RegExp = /[-_@#$%&*+=\[\]{}|\\\/^~`,.?!:;"<>()]/;

/**
 * Calculates a person's age based on their birth date.
 * @param birthDay - The day of birth (1-31).
 * @param birthMonth - The month of birth (1-12).
 * @param birthYear - The year of birth (e.g., 1990).
 * @returns The calculated age in years.
 * @throws Error if the date is invalid or missing.
 */
export function calculateAge(birthDay: number, birthMonth: number, birthYear: number): number {
    if (!birthYear || !birthMonth || !birthDay) {
        throw new Error("Coudln't calculate bithday date: one or more properties are missing");
    }

    const today = new Date();
    const birthDate = new Date(birthYear, birthMonth - 1, birthDay);

    // Validate the birth date
    if (isNaN(birthDate.getTime()) || 
        birthDate.getFullYear() !== birthYear || 
        birthDate.getMonth() !== birthMonth - 1 || 
        birthDate.getDate() !== birthDay) {
        throw new Error("Validation of birthday date failed");
    }

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age--;
    }

    return age;
}
