import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../core/errors/AppError';
import type { DoctorApprovalStatus } from '../../domain/roles';
import { DOCTOR_APPROVAL_STATUS, ROLES } from '../../domain/roles';
import type { DoctorProfilesRepository } from '../common/doctorProfiles.repository';
import type { UsersRepository } from '../common/users.repository';

export class AdminService {
  public constructor(
    private readonly doctorProfilesRepository: DoctorProfilesRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  public async listDoctorApplications() {
    return this.doctorProfilesRepository.listByApprovalStatus(DOCTOR_APPROVAL_STATUS.PENDING);
  }

  public async decideDoctorApplication(doctorUid: string, status: DoctorApprovalStatus) {
    const doctorProfile = await this.doctorProfilesRepository.findByUid(doctorUid);
    if (!doctorProfile) {
      throw new AppError('Doctor profile not found', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    const user = await this.usersRepository.findByUid(doctorUid);
    if (!user) {
      throw new AppError('Doctor user not found', StatusCodes.NOT_FOUND, 'NOT_FOUND');
    }

    const now = new Date().toISOString();

    doctorProfile.approval_status = status;
    doctorProfile.updated_at = now;
    user.role = ROLES.DOCTOR;
    user.doctorApprovalStatus = status;
    user.updatedAt = now;

    await this.doctorProfilesRepository.upsert(doctorProfile);
    await this.usersRepository.upsert(user);

    return doctorProfile;
  }
}
