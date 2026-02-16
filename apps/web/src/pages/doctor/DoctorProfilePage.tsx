import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doctorApi } from '../../api/services';
import { useAuth } from '../../auth/AuthProvider';
import { SpecializationPicker } from '../../components/SpecializationPicker';
import { StatusPill } from '../../components/dashboard';
import { CameraCaptureModal, MediaIconButton, MediaViewerModal } from '../../components/media';
import type { DoctorProfile } from '../../types';
import { dataUrlToBase64, fileToDataUrl, resolveStoredDocumentPreview } from '../../utils/base64';
import {
  loadCachedResource,
  readCachedResource,
  writeCachedResource,
} from '../../utils/resourceCache';
import styles from './DoctorProfilePage.module.css';

const emptyPayload = {
  doctor_name: '',
  doctor_email: '',
  doctor_phone: '',
  hospital_id: '',
  hospital_logo_base64: '',
  specializations: [] as string[],
  qualification: '',
  license: '',
  profile_image_base64: '',
  verification_docs_base64: [] as string[],
};

type DoctorProfileViewData = {
  profile: DoctorProfile | null;
  payload: typeof emptyPayload;
  syncedAt: number;
};

type PreviewModalState = {
  src: string;
  kind: 'image' | 'pdf' | 'other';
  title: string;
};

type CameraTarget = 'profile' | 'hospital' | 'verification' | null;

function mapDoctorProfileToPayload(profile: DoctorProfile): typeof emptyPayload {
  return {
    doctor_name: profile.doctor_name,
    doctor_email: profile.doctor_email,
    doctor_phone: profile.doctor_phone,
    hospital_id: profile.hospital_id,
    hospital_logo_base64: profile.hospital_logo_base64 ?? '',
    specializations: profile.specializations,
    qualification: profile.qualification,
    license: profile.license,
    profile_image_base64: profile.profile_image_base64 ?? '',
    verification_docs_base64: profile.verification_docs_base64,
  };
}

export function DoctorProfilePage() {
  const { appUser } = useAuth();
  const cacheKey = `doctor-profile:${appUser?.uid ?? 'anonymous'}`;
  const profileUploadInputRef = useRef<HTMLInputElement | null>(null);
  const hospitalUploadInputRef = useRef<HTMLInputElement | null>(null);
  const verificationUploadInputRef = useRef<HTMLInputElement | null>(null);
  const cachedProfile = readCachedResource<DoctorProfileViewData>(cacheKey);
  const [profile, setProfile] = useState<DoctorProfile | null>(cachedProfile?.profile ?? null);
  const [payload, setPayload] = useState(cachedProfile?.payload ?? emptyPayload);
  const [loading, setLoading] = useState(!cachedProfile);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [previewModal, setPreviewModal] = useState<PreviewModalState | null>(null);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>(null);
  const profilePreview = useMemo(
    () => resolveStoredDocumentPreview(payload.profile_image_base64),
    [payload.profile_image_base64],
  );
  const hospitalLogoPreview = useMemo(
    () => resolveStoredDocumentPreview(payload.hospital_logo_base64),
    [payload.hospital_logo_base64],
  );
  const verificationDocPreviews = useMemo(
    () =>
      payload.verification_docs_base64
        .map((document, index) => ({
          index,
          ...resolveStoredDocumentPreview(document),
        }))
        .filter((item) => Boolean(item.src)),
    [payload.verification_docs_base64],
  );

  const openPreview = useCallback(
    (source: { src: string; kind: 'image' | 'pdf' | 'other' }, title: string) => {
      if (!source.src) {
        return;
      }
      setPreviewModal({
        src: source.src,
        kind: source.kind,
        title,
      });
    },
    [],
  );

  const handleSingleImageUpload = useCallback(
    async (files: FileList | null, field: 'profile_image_base64' | 'hospital_logo_base64') => {
      const file = files?.[0] ?? null;
      if (!file) {
        setPayload((previous) => ({ ...previous, [field]: '' }));
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed in this field.');
        return;
      }
      const dataUrl = await fileToDataUrl(file);
      setPayload((previous) => ({ ...previous, [field]: dataUrl }));
    },
    [],
  );

  const handleVerificationDocsUpload = useCallback(async (files: FileList | null, append = false) => {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) {
      if (!append) {
        setPayload((previous) => ({ ...previous, verification_docs_base64: [] }));
      }
      return;
    }

    const dataUrls = await Promise.all(selectedFiles.map((file) => fileToDataUrl(file)));
    const docs = dataUrls.map((item) => dataUrlToBase64(item));
    setPayload((previous) => ({
      ...previous,
      verification_docs_base64: append ? [...previous.verification_docs_base64, ...docs] : docs,
    }));
  }, []);

  const handleCameraCapture = useCallback(
    (dataUrl: string) => {
      if (!cameraTarget) {
        return;
      }
      if (cameraTarget === 'profile') {
        setPayload((previous) => ({ ...previous, profile_image_base64: dataUrl }));
      } else if (cameraTarget === 'hospital') {
        setPayload((previous) => ({ ...previous, hospital_logo_base64: dataUrl }));
      } else {
        setPayload((previous) => ({
          ...previous,
          verification_docs_base64: [...previous.verification_docs_base64, dataUrlToBase64(dataUrl)],
        }));
      }
      setCameraTarget(null);
    },
    [cameraTarget],
  );

  const load = useCallback(
    async (options: { silent?: boolean; force?: boolean } = {}): Promise<void> => {
      const silent = options.silent ?? false;
      const force = options.force ?? false;
      const hasCached = Boolean(readCachedResource<DoctorProfileViewData>(cacheKey));

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
            const result = await doctorApi.getProfile();
            const profileDoc = result.profile ?? null;
            const payloadDoc = profileDoc
              ? mapDoctorProfileToPayload(profileDoc)
              : {
                  ...emptyPayload,
                  doctor_name: appUser?.displayName ?? '',
                  doctor_email: appUser?.email ?? '',
                  doctor_phone: appUser?.phone ?? '',
                };
            return {
              profile: profileDoc,
              payload: payloadDoc,
              syncedAt: Date.now(),
            };
          },
          { maxAgeMs: 60_000, force },
        );
        setProfile(next.profile);
        setPayload(next.payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load doctor profile');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appUser?.displayName, appUser?.email, appUser?.phone, cacheKey],
  );

  useEffect(() => {
    const latestCache = readCachedResource<DoctorProfileViewData>(cacheKey);
    if (latestCache) {
      setProfile(latestCache.profile);
      setPayload(latestCache.payload);
      setLoading(false);
      void load({ silent: true });
    } else {
      setProfile(null);
      setPayload({
        ...emptyPayload,
        doctor_name: appUser?.displayName ?? '',
        doctor_email: appUser?.email ?? '',
        doctor_phone: appUser?.phone ?? '',
      });
      setLoading(true);
      void load();
    }
  }, [appUser?.displayName, appUser?.email, appUser?.phone, cacheKey, load]);

  async function saveProfile(): Promise<void> {
    setSaving(true);
    setError('');
    setMessage('');
    const normalizedPayload = {
      ...payload,
      doctor_name: payload.doctor_name || appUser?.displayName || 'Doctor',
      doctor_email: payload.doctor_email || appUser?.email || '',
      doctor_phone: payload.doctor_phone || appUser?.phone || '',
    };
    try {
      const result = profile
        ? await doctorApi.updateProfile(normalizedPayload)
        : await doctorApi.apply(normalizedPayload);
      const nextProfile = result.profile;
      const nextPayload = mapDoctorProfileToPayload(nextProfile);

      setProfile(nextProfile);
      setPayload(nextPayload);
      writeCachedResource<DoctorProfileViewData>(cacheKey, {
        profile: nextProfile,
        payload: nextPayload,
        syncedAt: Date.now(),
      });
      setMessage(profile ? 'Doctor profile updated.' : 'Doctor profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save doctor profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <section className={styles.page}>Loading doctor profile...</section>;
  }

  return (
    <section className={styles.page}>
      <article className={styles.heroCard}>
        <header className={styles.heroHeader}>
          <div className={styles.titleWrap}>
            <h2 className={styles.title}>Doctor Profile</h2>
            <p className={styles.subtitle}>Professional hospital-linked identity and verification documents.</p>
            {refreshing ? <p className={styles.syncNote}>Refreshing latest profile...</p> : null}
          </div>
          <StatusPill label="enabled" tone="success" />
        </header>

        <section className={styles.identityCard}>
          <div className={styles.identityTop}>
            <div className={styles.avatarFrame}>
              {profilePreview.src ? (
                <img className={styles.avatar} src={profilePreview.src} alt="Doctor profile" />
              ) : (
                <div className={styles.avatarFallback} aria-hidden="true">
                  DR
                </div>
              )}
            </div>
            <div className={styles.identityMeta}>
              <p className={styles.identityName}>{payload.doctor_name || 'Doctor profile'}</p>
              <p className={styles.identityLine}>
                <strong>Email:</strong> {payload.doctor_email || 'Not available'}
              </p>
              <p className={styles.identityLine}>
                <strong>Phone:</strong> {payload.doctor_phone || 'Not provided'}
              </p>
              <p className={styles.identityLine}>
                <strong>Hospital:</strong> {payload.hospital_id || 'Not linked'}
              </p>
            </div>
          </div>

          <div className={styles.identityActions}>
            <div className={styles.iconRow}>
              <MediaIconButton
                type="view"
                label="View doctor profile image"
                onClick={() => openPreview(profilePreview, 'Doctor Profile Image')}
                disabled={!profilePreview.src}
              />
              <MediaIconButton
                type="camera"
                label="Capture doctor profile image"
                onClick={() => setCameraTarget('profile')}
              />
            </div>
            <button
              className={styles.uploadButton}
              type="button"
              onClick={() => profileUploadInputRef.current?.click()}
              disabled={saving}
            >
              Upload photo
            </button>
            <input
              ref={profileUploadInputRef}
              className={styles.hiddenInput}
              type="file"
              accept="image/*"
              onChange={(event) => {
                void handleSingleImageUpload(event.currentTarget.files, 'profile_image_base64');
                event.currentTarget.value = '';
              }}
            />
          </div>
        </section>
      </article>

      <div className={styles.formsGrid}>
        <article className={styles.panel}>
          <h3 className={styles.panelTitle}>Professional Details</h3>
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              Doctor Name
              <input
                className={styles.input}
                value={payload.doctor_name}
                onChange={(event) =>
                  setPayload((previous) => ({ ...previous, doctor_name: event.target.value }))
                }
              />
            </label>
            <label className={styles.field}>
              Contact Number
              <input
                className={styles.input}
                value={payload.doctor_phone}
                onChange={(event) =>
                  setPayload((previous) => ({ ...previous, doctor_phone: event.target.value }))
                }
              />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              Email
              <input
                className={styles.input}
                value={payload.doctor_email}
                onChange={(event) =>
                  setPayload((previous) => ({ ...previous, doctor_email: event.target.value }))
                }
              />
            </label>
            <label className={styles.field}>
              Qualification
              <input
                className={styles.input}
                value={payload.qualification}
                onChange={(event) =>
                  setPayload((previous) => ({ ...previous, qualification: event.target.value }))
                }
              />
            </label>
            <label className={styles.field}>
              Medical License
              <input
                className={styles.input}
                value={payload.license}
                onChange={(event) => setPayload((previous) => ({ ...previous, license: event.target.value }))}
              />
            </label>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              Specializations
              <SpecializationPicker
                value={payload.specializations}
                onChange={(next) => setPayload((previous) => ({ ...previous, specializations: next }))}
                disabled={saving}
              />
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <h3 className={styles.panelTitle}>Hospital + Verification</h3>
          <div className={styles.fieldGrid}>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              Hospital ID
              <input
                className={styles.input}
                value={payload.hospital_id}
                onChange={(event) =>
                  setPayload((previous) => ({ ...previous, hospital_id: event.target.value }))
                }
              />
            </label>

            <div className={`${styles.field} ${styles.fieldWide}`}>
              Hospital Logo (optional)
              <div className={styles.identityActions}>
                <div className={styles.iconRow}>
                  <MediaIconButton
                    type="view"
                    label="View hospital logo"
                    onClick={() => openPreview(hospitalLogoPreview, 'Hospital Logo')}
                    disabled={!hospitalLogoPreview.src}
                  />
                  <MediaIconButton
                    type="camera"
                    label="Capture hospital logo"
                    onClick={() => setCameraTarget('hospital')}
                  />
                </div>
                <button
                  className={styles.uploadButton}
                  type="button"
                  onClick={() => hospitalUploadInputRef.current?.click()}
                >
                  Upload logo
                </button>
                <input
                  ref={hospitalUploadInputRef}
                  className={styles.hiddenInput}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    void handleSingleImageUpload(event.currentTarget.files, 'hospital_logo_base64');
                    event.currentTarget.value = '';
                  }}
                />
              </div>
              {hospitalLogoPreview.src ? (
                <img className={styles.docPreview} src={hospitalLogoPreview.src} alt="Hospital logo preview" />
              ) : null}
            </div>

            <div className={`${styles.field} ${styles.fieldWide}`}>
              Verification Documents
              <div className={styles.identityActions}>
                <div className={styles.iconRow}>
                  <MediaIconButton
                    type="camera"
                    label="Capture verification document"
                    onClick={() => setCameraTarget('verification')}
                  />
                </div>
                <button
                  className={styles.uploadButton}
                  type="button"
                  onClick={() => verificationUploadInputRef.current?.click()}
                >
                  Upload documents
                </button>
                <input
                  ref={verificationUploadInputRef}
                  className={styles.hiddenInput}
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  multiple
                  onChange={(event) => {
                    void handleVerificationDocsUpload(event.currentTarget.files);
                    event.currentTarget.value = '';
                  }}
                />
              </div>
              <p className={styles.docHint}>{payload.verification_docs_base64.length} verification file(s)</p>

              {verificationDocPreviews.length > 0 ? (
                <div className={styles.docGrid}>
                  {verificationDocPreviews.map((item) => (
                    <article className={styles.docCard} key={`${item.index}-${item.src.length}`}>
                      {item.kind === 'image' ? (
                        <img
                          className={styles.docPreview}
                          src={item.src}
                          alt={`Verification document ${item.index + 1}`}
                        />
                      ) : item.kind === 'pdf' ? (
                        <object
                          className={styles.docPreview}
                          data={item.src}
                          type="application/pdf"
                          aria-label={`Verification document ${item.index + 1}`}
                        >
                          <a href={item.src} target="_blank" rel="noreferrer">
                            Open PDF
                          </a>
                        </object>
                      ) : (
                        <a href={item.src} target="_blank" rel="noreferrer">
                          Open document
                        </a>
                      )}
                      <p className={styles.docMeta}>Document {item.index + 1}</p>
                      <div className={styles.docActions}>
                        <MediaIconButton
                          type="view"
                          label={`View verification document ${item.index + 1}`}
                          onClick={() => openPreview(item, `Verification Document ${item.index + 1}`)}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </article>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.saveButton}
          type="button"
          disabled={saving}
          onClick={() => {
            void saveProfile();
          }}
        >
          {saving ? 'Saving...' : profile ? 'Update Profile' : 'Submit Profile'}
        </button>
        {message ? <p className={styles.statusMessage}>{message}</p> : null}
        {error ? <p className={styles.errorMessage}>{error}</p> : null}
      </div>

      <MediaViewerModal
        isOpen={Boolean(previewModal)}
        title={previewModal?.title ?? 'Document preview'}
        src={previewModal?.src ?? ''}
        kind={previewModal?.kind ?? 'other'}
        onClose={() => setPreviewModal(null)}
      />
      <CameraCaptureModal
        isOpen={cameraTarget !== null}
        title={
          cameraTarget === 'profile'
            ? 'Capture Doctor Profile Image'
            : cameraTarget === 'hospital'
              ? 'Capture Hospital Logo'
              : 'Capture Verification Document'
        }
        onClose={() => setCameraTarget(null)}
        onCapture={handleCameraCapture}
      />
    </section>
  );
}
