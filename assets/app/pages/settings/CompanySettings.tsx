import { useState } from "react";
import { Building2, MapPin, Phone, Image as ImageIcon } from "lucide-react";
import EditableSection from "../../components/EditableSection";
import { Row, SectionCard, SelectCell, TextCell, formMetrics } from "../../lib/cells";
import { ImageUploadField } from "../../lib/ui";
import { useAuth } from "../../lib/auth";
import { useRefData } from "../../lib/data";
import { ApiError, apiUpdateCompany, apiUploadCompanyImage } from "../../lib/api";
import { companyInitials, companyLogoUrl } from "../../lib/user";
import { validateEmail, validatePhone, validateRequired, validateUrl, validateZip } from "../../lib/validators";
import { maskPhone, maskZip } from "../../lib/masks";

interface ProfileForm { name: string; url: string }
interface ContactForm { email: string; phone: string }
interface AddressForm {
  address: string; address2: string; city: string; state: string; zip: string;
}

export default function CompanySettings() {
  const { user, refresh } = useAuth();
  const { data: refData } = useRefData();
  const company = user?.company;

  const [logoBusy,  setLogoBusy]  = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  async function withLogoBusy(work: () => Promise<unknown>) {
    setLogoBusy(true);
    setLogoError(null);
    try {
      await work();
      await refresh();
    } catch (e) {
      setLogoError(e instanceof ApiError ? e.message : "Upload failed. Please try again.");
    } finally {
      setLogoBusy(false);
    }
  }

  /**
   * Save one section's worth of fields.
   *
   * Sections PATCH only what they own, so fixing a phone number cannot revert
   * an address someone else changed while this page was open.
   */
  async function save(patch: Parameters<typeof apiUpdateCompany>[1]) {
    if (!company?.id) throw new Error("No company is attached to your account.");
    await apiUpdateCompany(company.id, patch);
    await refresh();
  }

  return (
    <>
      <SectionCard
        icon={ImageIcon}
        title="Logo"
        style={formMetrics}
        meta={logoError && (
          <span className="text-[length:var(--cell-hint-fs)] font-mono text-red-400 truncate max-w-[16rem]" title={logoError}>
            {logoError}
          </span>
        )}
      >
        <ImageUploadField
          shape="square"
          imageUrl={companyLogoUrl(company, refData?.imagesHost)}
          fallback={companyInitials(company)}
          busy={logoBusy}
          hint="Used on documents and anywhere your company is shown."
          onUpload={file => withLogoBusy(() => apiUploadCompanyImage(file))}
          onRemove={company?.imageHash ? () => withLogoBusy(() => save({ imageHash: null })) : undefined}
        />
      </SectionCard>

      <EditableSection<ProfileForm>
        value={{ name: company?.name ?? "", url: company?.url ?? "" }}
        onSave={async draft => {
          if (validateRequired(draft.name)) throw new Error("Enter a company name.");
          if (validateUrl(draft.url))       throw new Error("Enter a valid website address.");
          await save({ name: draft.name, url: draft.url });
        }}
      >
        {(draft, patch) => (
          <SectionCard icon={Building2} title="Profile" style={formMetrics}>
            <Row>
              <TextCell label="Company name" value={draft.name} required onChange={v => patch({ name: v })} />
              <TextCell label="Website" type="url" value={draft.url} onChange={v => patch({ url: v })} />
            </Row>
          </SectionCard>
        )}
      </EditableSection>

      <EditableSection<ContactForm>
        value={{ email: company?.email ?? "", phone: maskPhone(company?.phone ?? "") }}
        onSave={async draft => {
          if (validateEmail(draft.email)) throw new Error("Enter a valid email address.");
          if (validatePhone(draft.phone)) throw new Error("Enter a valid phone number.");
          await save({ email: draft.email, phone: draft.phone });
        }}
      >
        {(draft, patch) => (
          <SectionCard icon={Phone} title="Contact" style={formMetrics}>
            <Row>
              <TextCell
                label="Email"
                type="email"
                value={draft.email}
                hint="Where account notifications are sent."
                onChange={v => patch({ email: v })}
              />
              <TextCell
                label="Phone"
                type="tel"
                value={draft.phone}
                onChange={v => patch({ phone: maskPhone(v) })}
              />
            </Row>
          </SectionCard>
        )}
      </EditableSection>

      <EditableSection<AddressForm>
        value={{
          address:  company?.address  ?? "",
          address2: company?.address2 ?? "",
          city:     company?.city     ?? "",
          state:    company?.state    ?? "",
          zip:      maskZip(company?.zip ?? ""),
        }}
        onSave={async draft => {
          if (validateZip(draft.zip)) throw new Error("Enter a valid ZIP code.");
          await save(draft);
        }}
      >
        {(draft, patch) => (
          <SectionCard icon={MapPin} title="Address" style={formMetrics}>
            <Row cols={1}>
              <TextCell label="Address line 1" value={draft.address} onChange={v => patch({ address: v })} />
            </Row>
            <Row cols={1}>
              <TextCell
                label="Address line 2"
                value={draft.address2}
                hint="Apartment, suite, unit, building, floor, etc."
                onChange={v => patch({ address2: v })}
              />
            </Row>
            <Row cols={3}>
              <TextCell label="City" value={draft.city} onChange={v => patch({ city: v })} />
              <SelectCell label="State" value={draft.state} onChange={v => patch({ state: v })}>
                <option value="">— Select —</option>
                {(refData?.states ?? []).map(st => (
                  <option key={st.value} value={st.value}>{st.value} — {st.label}</option>
                ))}
              </SelectCell>
              <TextCell label="ZIP" value={draft.zip} mono onChange={v => patch({ zip: maskZip(v) })} />
            </Row>
          </SectionCard>
        )}
      </EditableSection>
    </>
  );
}
