import { useState } from "react";
import { Image as ImageIcon, User2 } from "lucide-react";
import EditableSection from "../../components/EditableSection";
import { Row, SectionCard, TextCell, Cell, formMetrics } from "../../lib/cells";
import { ImageUploadField } from "../../lib/ui";
import { useAuth } from "../../lib/auth";
import { useRefData } from "../../lib/data";
import { ApiError, apiUpdateProfile, apiUploadSelfImage } from "../../lib/api";
import { avatarUrl, initialsOf } from "../../lib/user";
import { ROLE_MAP, roleLabel } from "../../lib/roles";
import { validateEmail, validatePhone, validateRequired } from "../../lib/validators";
import { maskPhone } from "../../lib/masks";

interface ProfileForm {
  firstName: string;
  lastName:  string;
  email:     string;
  phone:     string;
  address:   string;
}

function profileFormOf(user: ReturnType<typeof useAuth>["user"]): ProfileForm {
  return {
    firstName: user?.firstName ?? "",
    lastName:  user?.lastName  ?? "",
    email:     user?.email     ?? "",
    phone:     maskPhone(user?.phone ?? ""),
    address:   user?.address   ?? "",
  };
}

/**
 * The first problem a draft hits, as a sentence.
 *
 * EditableSection shows whatever onSave throws in the section header and
 * leaves the section open, so one clear message beats threading a per-field
 * error map back out of a draft the section owns.
 */
function firstProblem(form: ProfileForm): string | null {
  if (validateRequired(form.firstName)) return "Enter a first name.";
  if (validateRequired(form.lastName))  return "Enter a last name.";
  if (validateEmail(form.email))        return "Enter a valid email address.";
  if (validatePhone(form.phone))        return "Enter a valid phone number.";
  return null;
}

export default function AccountSettings() {
  const { user, refresh } = useAuth();
  const { data: refData } = useRefData();

  const [photoBusy,  setPhotoBusy]  = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const initials = initialsOf(user);
  const role     = (user?.roles ?? []).find(r => r in ROLE_MAP);

  async function withPhotoBusy(work: () => Promise<unknown>) {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      await work();
      await refresh();
    } catch (e) {
      setPhotoError(e instanceof ApiError ? e.message : "Upload failed. Please try again.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function saveProfile(draft: ProfileForm) {
    const problem = firstProblem(draft);
    if (problem) throw new Error(problem);

    await apiUpdateProfile({
      firstName: draft.firstName,
      lastName:  draft.lastName,
      email:     draft.email,
      phone:     draft.phone,
      address:   draft.address,
    });
    await refresh();
  }

  return (
    <>
      <SectionCard
        icon={ImageIcon}
        title="Photo"
        style={formMetrics}
        meta={photoError && (
          <span className="text-[length:var(--cell-hint-fs)] font-mono text-red-400 truncate max-w-[16rem]" title={photoError}>
            {photoError}
          </span>
        )}
      >
        <ImageUploadField
          shape="round"
          imageUrl={avatarUrl(user, refData?.imagesHost)}
          fallback={initials}
          busy={photoBusy}
          hint="Shown in the sidebar and beside your name across the app."
          onUpload={file => withPhotoBusy(() => apiUploadSelfImage(file))}
          onRemove={user?.imageHash ? () => withPhotoBusy(() => apiUpdateProfile({ imageHash: null })) : undefined}
        />
      </SectionCard>

      <EditableSection value={profileFormOf(user)} onSave={saveProfile}>
        {(draft, patch) => (
          <SectionCard icon={User2} title="Profile" style={formMetrics}>
            <Row>
              <TextCell
                label="First name"
                value={draft.firstName}
                required
                onChange={v => patch({ firstName: v })}
              />
              <TextCell
                label="Last name"
                value={draft.lastName}
                required
                onChange={v => patch({ lastName: v })}
              />
            </Row>
            <Row>
              <TextCell
                label="Email"
                type="email"
                value={draft.email}
                required
                hint="This is what you sign in with. Changes take effect immediately."
                onChange={v => patch({ email: v })}
              />
              <TextCell
                label="Phone"
                type="tel"
                value={draft.phone}
                onChange={v => patch({ phone: maskPhone(v) })}
              />
            </Row>
            <Row cols={1}>
              <TextCell
                label="Address"
                value={draft.address}
                hint="Home or base address. Used for scheduling."
                onChange={v => patch({ address: v })}
              />
            </Row>
            <Row cols={1}>
              <Cell label="Role" as="div" hint="Roles are assigned by an administrator under Workers.">
                {role ? (
                  <span
                    className="inline-block text-xs font-mono px-2 py-0.5 rounded border"
                    style={{
                      color:           ROLE_MAP[role].color,
                      backgroundColor: `${ROLE_MAP[role].color}15`,
                      borderColor:     `${ROLE_MAP[role].color}50`,
                    }}
                  >
                    {ROLE_MAP[role].label}
                  </span>
                ) : (
                  <span className="text-[length:var(--cell-fs)] text-muted-foreground/40">{roleLabel(user?.roles)}</span>
                )}
              </Cell>
            </Row>
          </SectionCard>
        )}
      </EditableSection>
    </>
  );
}
