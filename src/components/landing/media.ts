/** Where scripts/landing-media.mjs writes its captures, behind the basePath.
 *  A plain module, not the client one: a server component importing a value
 *  from a 'use client' file receives a client reference, not the string. */
export const LANDING_MEDIA = '/seder/landing';
