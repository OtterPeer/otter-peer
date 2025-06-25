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

/**
 * Estimates birth date based on age, setting the birth date to today's date minus the user's age.
 * @param age - The user's age in years.
 * @returns An object containing estimated birthDay, birthMonth, and birthYear.
 * @throws Error if age is invalid (negative or not a number).
 */
export function estimateBirthdayDateBasedOnAge(age: number): { estimatedBirthDay: number; estimatedBirthMonth: number; estimatedBirthYear: number } {
    if (!Number.isInteger(age) || age < 0) {
        throw new Error("Invalid age: must be a non-negative integer");
    }

    const today = new Date();
    const estimatedBirthYear = today.getFullYear() - age;
    const estimatedBirthMonth = today.getMonth() + 1; // JavaScript months are 0-based, convert to 1-based
    const estimatedBirthDay = 1; // always set to 1st of the month to avoid problems related to non-leap years etc.

    // Validate the estimated birth date
    const birthDate = new Date(estimatedBirthYear, estimatedBirthMonth - 1, estimatedBirthDay);
    if (isNaN(birthDate.getTime()) || 
        birthDate.getFullYear() !== estimatedBirthYear || 
        birthDate.getMonth() !== estimatedBirthMonth - 1 || 
        birthDate.getDate() !== estimatedBirthDay) {
        throw new Error("Estimated birth date is invalid");
    }

    return { estimatedBirthDay, estimatedBirthMonth, estimatedBirthYear };
}