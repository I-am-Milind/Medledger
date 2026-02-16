import { useCallback, useEffect, useRef, useState } from 'react';
import { patientApi } from '../../api/services';
import { useAuth } from '../../auth/AuthProvider';
import type { PatientProfile } from '../../types';
import { fileToBase64, resolveStoredDocumentPreview } from '../../utils/base64';
import {
  loadCachedResource,
  readCachedResource,
  writeCachedResource,
} from '../../utils/resourceCache';
import { DateInput } from '../../components/DateInput';
import styles from './PatientProfile.module.css';

const emptyProfilePayload: Omit<PatientProfile, 'owner_uid' | 'global_patient_identifier'> = {
  demographics: {
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
  },
  contact: {
    email: '',
    phone: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
  },
  blood_group: '',
  allergies: [],
  profile_image_base64: '',
  aadhaar_card_base64: '',
  hereditary_history: [],
};

type PatientProfileViewData = {
  identifier: string;
  payload: Omit<PatientProfile, 'owner_uid' | 'global_patient_identifier'>;
  syncedAt: number;
};

export function PatientProfilePage() {
  const { appUser } = useAuth();
  const cacheKey = `patient-profile:${appUser?.uid ?? 'anonymous'}`;
  const cachedProfile = readCachedResource<PatientProfileViewData>(cacheKey);
  const [payload, setPayload] =
    useState<Omit<PatientProfile, 'owner_uid' | 'global_patient_identifier'>>(
      cachedProfile?.payload ?? emptyProfilePayload,
    );
  const [identifier, setIdentifier] = useState(cachedProfile?.identifier ?? '');
  const [loading, setLoading] = useState(!cachedProfile);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isAadhaarPreviewOpen, setIsAadhaarPreviewOpen] = useState(false);
  const [openReportPreviews, setOpenReportPreviews] = useState<Record<number, boolean>>({});
  const [isHereditarySectionVisible, setIsHereditarySectionVisible] = useState(false);
  const [isProfileImageMenuOpen, setIsProfileImageMenuOpen] = useState(false);
  const [isProfileImagePreviewOpen, setIsProfileImagePreviewOpen] = useState(false);
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);
  const profileImagePreview = resolveStoredDocumentPreview(payload.profile_image_base64);
  const aadhaarPreview = resolveStoredDocumentPreview(payload.aadhaar_card_base64);

  const load = useCallback(
    async (options: { silent?: boolean; force?: boolean } = {}): Promise<void> => {
      const silent = options.silent ?? false;
      const force = options.force ?? false;
      const hasCached = Boolean(readCachedResource<PatientProfileViewData>(cacheKey));

      if (!silent && !hasCached) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError('');
      try {
        const next = await loadCachedResource(
          cacheKey,
          async () => {
            const { profile } = await patientApi.getProfile();
            return {
              identifier: profile.global_patient_identifier,
              payload: {
                demographics: profile.demographics,
                contact: profile.contact,
                blood_group: profile.blood_group,
                allergies: profile.allergies,
                profile_image_base64: profile.profile_image_base64,
                aadhaar_card_base64: profile.aadhaar_card_base64,
                hereditary_history: profile.hereditary_history,
              },
              syncedAt: Date.now(),
            };
          },
          { maxAgeMs: 60_000, force },
        );

        setIdentifier(next.identifier);
        setPayload(next.payload);
        if (!silent) {
          setIsAadhaarPreviewOpen(false);
          setIsProfileImageMenuOpen(false);
          setIsProfileImagePreviewOpen(false);
          setIsHereditarySectionVisible(false);
          setOpenReportPreviews({});
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cacheKey],
  );

  useEffect(() => {
    const latestCache = readCachedResource<PatientProfileViewData>(cacheKey);
    if (latestCache) {
      setIdentifier(latestCache.identifier);
      setPayload(latestCache.payload);
      setLoading(false);
      void load({ silent: true });
    } else {
      setIdentifier('');
      setPayload(emptyProfilePayload);
      setLoading(true);
      void load();
    }
  }, [cacheKey, load]);

  function toggleHereditarySection(): void {
    setIsHereditarySectionVisible((previous) => {
      const next = !previous;
      if (!next) {
        setOpenReportPreviews({});
      }
      return next;
    });
  }

  async function save(): Promise<void> {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const result = await patientApi.updateProfile(payload);
      const nextPayload = {
        demographics: result.profile.demographics,
        contact: result.profile.contact,
        blood_group: result.profile.blood_group,
        allergies: result.profile.allergies,
        profile_image_base64: result.profile.profile_image_base64,
        aadhaar_card_base64: result.profile.aadhaar_card_base64,
        hereditary_history: result.profile.hereditary_history,
      };
      const nextIdentifier = result.profile.global_patient_identifier;

      setPayload(nextPayload);
      setIdentifier(nextIdentifier);
      writeCachedResource<PatientProfileViewData>(cacheKey, {
        identifier: nextIdentifier,
        payload: nextPayload,
        syncedAt: Date.now(),
      });
      setIsProfileImageMenuOpen(false);
      setOpenReportPreviews({});
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <section className={styles.wrap}>Loading profile...</section>;
  }

  return (
    <section className={styles.wrap}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Patient Profile ({identifier})</h2>
          <p className={styles.subtitle}>Owner-controlled profile with protected identity fields.</p>
          {refreshing ? <p className={styles.subtitle}>Refreshing latest profile...</p> : null}
        </div>
      </div>

      <section className={styles.profileHero}>
        <div className={styles.identityCard}>
          <div className={styles.avatarPanel}>
            <button
              className={styles.avatarAction}
              type="button"
              onClick={() => setIsProfileImageMenuOpen((previous) => !previous)}
              aria-expanded={isProfileImageMenuOpen}
              aria-controls="patient-profile-avatar-menu"
            >
              {profileImagePreview.src ? (
                <img className={styles.heroAvatar} src={profileImagePreview.src} alt="Patient profile" />
              ) : (
                <div className={styles.heroAvatarFallback} aria-hidden="true">
                  PT
                </div>
              )}
              <span className={styles.avatarEditBadge}>Edit</span>
            </button>

            <input
              ref={profileImageInputRef}
              className={styles.hiddenFileInput}
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) {
                  return;
                }
                void fileToBase64(file).then((value) => {
                  setPayload((previous) => ({ ...previous, profile_image_base64: value }));
                  setIsProfileImagePreviewOpen(true);
                  setIsProfileImageMenuOpen(false);
                });
              }}
            />

            {isProfileImageMenuOpen ? (
              <div className={styles.avatarMenu} id="patient-profile-avatar-menu" role="menu">
                <button
                  className={styles.avatarMenuButton}
                  type="button"
                  onClick={() => {
                    setIsProfileImagePreviewOpen((previous) => !previous);
                    setIsProfileImageMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  {isProfileImagePreviewOpen ? 'Hide current photo' : 'View current photo'}
                </button>
                <button
                  className={styles.avatarMenuButton}
                  type="button"
                  onClick={() => profileImageInputRef.current?.click()}
                  role="menuitem"
                >
                  Update photo
                </button>
              </div>
            ) : null}
          </div>
          <p className={styles.identityLabel}>Profile Photo</p>
        </div>

        <div className={styles.summaryPanel}>
          <h3 className={styles.summaryTitle}>Identity Snapshot</h3>
          <div className={styles.summaryGrid}>
            <p className={styles.summaryLine}>
              <span>Contact Email</span>
              <strong>{payload.contact.email || 'Not set'}</strong>
            </p>
            <p className={styles.summaryLine}>
              <span>Gender</span>
              <strong>{payload.demographics.gender || 'Not set'}</strong>
            </p>
            <p className={styles.summaryLine}>
              <span>Blood Group</span>
              <strong>{payload.blood_group || 'Not set'}</strong>
            </p>
          </div>
          <div className={styles.summaryActions}>
            {payload.aadhaar_card_base64 ? (
              <button
                className={styles.docButton}
                type="button"
                onClick={() => setIsAadhaarPreviewOpen((previous) => !previous)}
              >
                {isAadhaarPreviewOpen ? 'Hide Aadhaar Document' : 'View Aadhaar Document'}
              </button>
            ) : (
              <p className={styles.docHint}>Aadhaar document is attached and locked after onboarding.</p>
            )}
            <button className={styles.docButton} type="button" onClick={toggleHereditarySection}>
              {isHereditarySectionVisible ? 'Hide Family Hereditary' : 'Show Family Hereditary'}
            </button>
          </div>

          {isHereditarySectionVisible ? (
            <section className={`${styles.hereditarySection} ${styles.summaryHereditarySection}`}>
              <h3 className={styles.hereditaryTitle}>Family Hereditary Structure</h3>
              {payload.hereditary_history.length === 0 ? (
                <p className={styles.hereditaryEmpty}>No hereditary records saved.</p>
              ) : null}
              {payload.hereditary_history.map((item, index) => {
                const reportPreview = resolveStoredDocumentPreview(item.doctor_report_image_base64);

                return (
                  <article key={`hereditary-${index}`} className={styles.card}>
                    <div className={styles.hereditaryInfoGrid}>
                      <p className={styles.hereditaryInfoItem}>
                        <span>Relation</span>
                        <strong>{item.relation || 'Not provided'}</strong>
                      </p>
                      <p className={styles.hereditaryInfoItem}>
                        <span>Condition</span>
                        <strong>{item.condition || 'Not provided'}</strong>
                      </p>
                      <p className={styles.hereditaryInfoItem}>
                        <span>Age Of Detection</span>
                        <strong>{item.age_of_detection ?? 'Not provided'}</strong>
                      </p>
                      <p className={styles.hereditaryInfoItem}>
                        <span>Status</span>
                        <strong>{item.status || 'Not provided'}</strong>
                      </p>
                      <p className={styles.hereditaryInfoItem}>
                        <span>Who Has This Condition</span>
                        <strong>{item.affected_person_name || 'Not provided'}</strong>
                      </p>
                      <p className={styles.hereditaryInfoItem}>
                        <span>How Many People Have This</span>
                        <strong>{item.affected_people_count ?? 'Not provided'}</strong>
                      </p>
                    </div>

                    <p className={styles.hereditaryNotes}>
                      <span>Notes</span>
                      <strong>{item.notes || 'No notes provided.'}</strong>
                    </p>

                    {reportPreview.src ? (
                      <button
                        className={styles.docButton}
                        type="button"
                        onClick={() =>
                          setOpenReportPreviews((previous) => ({
                            ...previous,
                            [index]: !previous[index],
                          }))
                        }
                      >
                        {openReportPreviews[index] ? 'Hide Doctor Report' : 'View Doctor Report'}
                      </button>
                    ) : null}
                    {reportPreview.src && openReportPreviews[index] ? (
                      <div className={styles.previewCard}>
                        {reportPreview.kind === 'image' ? (
                          <img
                            className={styles.previewImage}
                            src={reportPreview.src}
                            alt={`Doctor report ${index + 1}`}
                          />
                        ) : reportPreview.kind === 'pdf' ? (
                          <object
                            className={styles.previewFrame}
                            data={reportPreview.src}
                            type="application/pdf"
                            aria-label={`Doctor report ${index + 1}`}
                          >
                            <a href={reportPreview.src} target="_blank" rel="noreferrer">
                              Open Doctor Report PDF
                            </a>
                          </object>
                        ) : (
                          <a href={reportPreview.src} target="_blank" rel="noreferrer">
                            Open doctor report document
                          </a>
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>
          ) : null}
        </div>
      </section>

      {profileImagePreview.src && isProfileImagePreviewOpen ? (
        <div className={styles.previewCard}>
          <img className={styles.previewImage} src={profileImagePreview.src} alt="Patient profile preview" />
        </div>
      ) : null}

      {payload.aadhaar_card_base64 && isAadhaarPreviewOpen ? (
        <div className={styles.previewCard}>
          {aadhaarPreview.kind === 'image' ? (
            <img
              className={styles.previewImage}
              src={aadhaarPreview.src}
              alt="Aadhaar card preview"
            />
          ) : aadhaarPreview.kind === 'pdf' ? (
            <object
              className={styles.previewFrame}
              data={aadhaarPreview.src}
              type="application/pdf"
              aria-label="Aadhaar card preview"
            >
              <a href={aadhaarPreview.src} target="_blank" rel="noreferrer">
                Open Aadhaar PDF
              </a>
            </object>
          ) : (
            <a href={aadhaarPreview.src} target="_blank" rel="noreferrer">
              Open Aadhaar document
            </a>
          )}
        </div>
      ) : null}

      <div className={styles.grid}>
        <div className={styles.row}>
          <label className={styles.label}>
            First Name
            <input
              className={styles.input}
              value={payload.demographics.first_name}
              onChange={(event) =>
                setPayload((previous) => ({
                  ...previous,
                  demographics: { ...previous.demographics, first_name: event.target.value },
                }))
              }
            />
          </label>
          <label className={styles.label}>
            Last Name
            <input
              className={styles.input}
              value={payload.demographics.last_name}
              onChange={(event) =>
                setPayload((previous) => ({
                  ...previous,
                  demographics: { ...previous.demographics, last_name: event.target.value },
                }))
              }
            />
          </label>
        </div>

        <div className={styles.row}>
          <div className={styles.label}>
            <label htmlFor="patient-profile-date-of-birth">Date of Birth</label>
            <DateInput
              id="patient-profile-date-of-birth"
              value={payload.demographics.date_of_birth}
              inputClassName={`${styles.input} ${styles.lockedInput}`}
              maxDate={new Date()}
              placeholder="Select date of birth"
              disabled
              onChange={() => undefined}
            />
          </div>
          <label className={styles.label}>
            Gender
            <input
              className={`${styles.input} ${styles.lockedInput}`}
              value={payload.demographics.gender}
              readOnly
            />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>
            Contact Email
            <input
              className={`${styles.input} ${styles.lockedInput}`}
              type="email"
              value={payload.contact.email}
              readOnly
            />
          </label>
          <label className={styles.label}>
            Phone
            <input
              className={styles.input}
              value={payload.contact.phone}
              onChange={(event) =>
                setPayload((previous) => ({
                  ...previous,
                  contact: { ...previous.contact, phone: event.target.value },
                }))
              }
            />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>
            Address Line 1
            <input
              className={styles.input}
              value={payload.contact.address_line_1}
              onChange={(event) =>
                setPayload((previous) => ({
                  ...previous,
                  contact: { ...previous.contact, address_line_1: event.target.value },
                }))
              }
            />
          </label>
          <label className={styles.label}>
            Address Line 2
            <input
              className={styles.input}
              value={payload.contact.address_line_2}
              onChange={(event) =>
                setPayload((previous) => ({
                  ...previous,
                  contact: { ...previous.contact, address_line_2: event.target.value },
                }))
              }
            />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>
            City
            <input
              className={styles.input}
              value={payload.contact.city}
              onChange={(event) =>
                setPayload((previous) => ({
                  ...previous,
                  contact: { ...previous.contact, city: event.target.value },
                }))
              }
            />
          </label>
          <label className={styles.label}>
            State
            <input
              className={styles.input}
              value={payload.contact.state}
              onChange={(event) =>
                setPayload((previous) => ({
                  ...previous,
                  contact: { ...previous.contact, state: event.target.value },
                }))
              }
            />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>
            Country
            <input
              className={styles.input}
              value={payload.contact.country}
              onChange={(event) =>
                setPayload((previous) => ({
                  ...previous,
                  contact: { ...previous.contact, country: event.target.value },
                }))
              }
            />
          </label>
          <label className={styles.label}>
            Postal Code
            <input
              className={styles.input}
              value={payload.contact.postal_code}
              onChange={(event) =>
                setPayload((previous) => ({
                  ...previous,
                  contact: { ...previous.contact, postal_code: event.target.value },
                }))
              }
            />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>
            Blood Group
            <input
              className={`${styles.input} ${styles.lockedInput}`}
              value={payload.blood_group}
              readOnly
            />
          </label>
          <label className={styles.label}>
            Allergies (comma separated)
            <input
              className={`${styles.input} ${styles.lockedInput}`}
              value={payload.allergies.length > 0 ? payload.allergies.join(', ') : 'None'}
              readOnly
            />
          </label>
        </div>

        <div className={styles.actions}>
          <button className={styles.button} type="button" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>

        <p>{message}</p>
        <p className={styles.error}>{error}</p>
      </div>
    </section>
  );
}
