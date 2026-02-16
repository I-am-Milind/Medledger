import { randomBytes } from 'node:crypto';
import type { PatientsRepository } from '../modules/common/patients.repository';

function randomSegment(length = 8): string {
  return randomBytes(8)
    .toString('hex')
    .slice(0, length)
    .toUpperCase();
}

export async function generateUniquePatientIdentifier(
  patientsRepository: PatientsRepository,
): Promise<string> {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const candidate = `MLP-${new Date().getFullYear()}-${randomSegment()}`;
    const existing = await patientsRepository.findByIdentifier(candidate);
    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Unable to generate unique patient identifier.');
}
