/**
 * Centralized type-safe IPC utilities
 *
 * @example
 * import { fileSystem, http, dialog, app } from '@/libs';
 *
 * // File operations
 * const data = await fileSystem.readJSON<Profile>('profile.json');
 * await fileSystem.writeJSON('profile.json', data);
 *
 * // HTTP requests
 * const response = await http.get<User[]>('https://api.example.com/users');
 *
 * // Dialogs
 * const file = await dialog.pickM3UFile();
 *
 * // App paths
 * const userPath = await app.getUserDataPath();
 */

export { fileSystem, handleFileError } from './fileSystem';
export { http } from './http';
export { dialog, FILE_FILTERS } from './dialog';
export { app } from './app';
